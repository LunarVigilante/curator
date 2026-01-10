
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { ImageService } from '@/lib/services/image/imageService';
import { rewriteDescription, generateEmbedding, generateTags, ensureTags, sleep, aiLimiter } from '@/lib/harvesters/shared';
import { fetchFromBgg } from '@/lib/harvesters/board-games';

// ============================================================================
// CONFIG
// ============================================================================
const BATCH_SIZE = 20;
const MAX_ID = 450000;
const MIN_VOTES = 100;
const RATE_LIMIT_DELAY = 3000; // 3s sleep strictly required
const CURSOR_FILE = path.resolve('bgg-cursor.json');

const supabase = createServiceRoleClient();
const imageService = new ImageService('covers');

// ============================================================================
// CURSOR STATE
// ============================================================================
interface Cursor {
    lastId: number;
}

function getCursor(): number {
    if (fs.existsSync(CURSOR_FILE)) {
        const raw = fs.readFileSync(CURSOR_FILE, 'utf-8');
        const data = JSON.parse(raw) as Cursor;
        return data.lastId || 1;
    }
    return 1;
}

function saveCursor(lastId: number) {
    fs.writeFileSync(CURSOR_FILE, JSON.stringify({ lastId }, null, 2));
}

// ============================================================================
// HELPERS
// ============================================================================

function decodeHTMLEntities(text: string): string {
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/&#10;/g, ' ')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '');  // Strip remaining HTML tags
}

interface ParsedGame {
    id: number;
    type: string;
    name: string;
    description: string;
    image: string;
    thumbnail: string;
    yearPublished: number | null;
    rating: number;
    usersRated: number;
    weight: number;
    minPlayers: number;
    maxPlayers: number;
    minPlaytime: number;
    maxPlaytime: number;
    minAge: number;
    mechanics: string[];
    categories: string[];
    designers: string[];
    artists: string[];
    publishers: string[];
}

async function fetchBatch(ids: number[]): Promise<ParsedGame[]> {
    const idsParam = ids.join(',');
    const games: ParsedGame[] = [];

    try {
        const xml = await fetchFromBgg(`thing?id=${idsParam}&stats=1`);

        // Parse XML (regex - consistent with existing board-games.ts)
        const items = xml.match(/<item[^>]*>[\s\S]*?<\/item>/g) || [];

        for (const itemXml of items) {
            const idMatch = itemXml.match(/id="(\d+)"/);
            const typeMatch = itemXml.match(/type="([^"]+)"/);
            const nameMatch = itemXml.match(/<name.*?type="primary".*?value="([^"]+)"/);
            const descMatch = itemXml.match(/<description>([\s\S]*?)<\/description>/);
            const imageMatch = itemXml.match(/<image>(.*?)<\/image>/);
            const thumbMatch = itemXml.match(/<thumbnail>(.*?)<\/thumbnail>/);
            const yearMatch = itemXml.match(/<yearpublished.*?value="(\d+)"/);
            const ratingMatch = itemXml.match(/<average.*?value="([\d.]+)"/);
            const usersRatedMatch = itemXml.match(/<usersrated.*?value="(\d+)"/);
            const weightMatch = itemXml.match(/<averageweight.*?value="([\d.]+)"/);
            const minPlayersMatch = itemXml.match(/<minplayers.*?value="(\d+)"/);
            const maxPlayersMatch = itemXml.match(/<maxplayers.*?value="(\d+)"/);
            const minPlaytimeMatch = itemXml.match(/<minplaytime.*?value="(\d+)"/);
            const maxPlaytimeMatch = itemXml.match(/<maxplaytime.*?value="(\d+)"/);
            const minAgeMatch = itemXml.match(/<minage.*?value="(\d+)"/);

            // Extract links
            const mechanicMatches = itemXml.matchAll(/<link type="boardgamemechanic".*?value="([^"]+)"/g);
            const categoryMatches = itemXml.matchAll(/<link type="boardgamecategory".*?value="([^"]+)"/g);
            const designerMatches = itemXml.matchAll(/<link type="boardgamedesigner".*?value="([^"]+)"/g);
            const artistMatches = itemXml.matchAll(/<link type="boardgameartist".*?value="([^"]+)"/g);
            const publisherMatches = itemXml.matchAll(/<link type="boardgamepublisher".*?value="([^"]+)"/g);

            if (idMatch && nameMatch) {
                games.push({
                    id: parseInt(idMatch[1]),
                    type: typeMatch?.[1] || 'unknown',
                    name: decodeHTMLEntities(nameMatch[1]),
                    description: decodeHTMLEntities(descMatch?.[1] || '').slice(0, 2000),
                    image: imageMatch?.[1] || '',
                    thumbnail: thumbMatch?.[1] || '',
                    yearPublished: yearMatch ? parseInt(yearMatch[1]) : null,
                    rating: parseFloat(ratingMatch?.[1] || '0'),
                    usersRated: parseInt(usersRatedMatch?.[1] || '0'),
                    weight: parseFloat(weightMatch?.[1] || '0'),
                    minPlayers: parseInt(minPlayersMatch?.[1] || '0'),
                    maxPlayers: parseInt(maxPlayersMatch?.[1] || '0'),
                    minPlaytime: parseInt(minPlaytimeMatch?.[1] || '0'),
                    maxPlaytime: parseInt(maxPlaytimeMatch?.[1] || '0'),
                    minAge: parseInt(minAgeMatch?.[1] || '0'),
                    mechanics: Array.from(mechanicMatches).map(m => m[1]),
                    categories: Array.from(categoryMatches).map(m => m[1]),
                    designers: Array.from(designerMatches).map(m => m[1]),
                    artists: Array.from(artistMatches).map(m => m[1]),
                    publishers: Array.from(publisherMatches).map(m => m[1]),
                });
            }
        }
    } catch (error) {
        console.error(`   ❌ BGG Fetch Error:`, error);
    }

    return games;
}

async function processGame(game: ParsedGame): Promise<boolean> {
    try {
        // Image processing
        const imageUrl = game.image || game.thumbnail;
        let finalImageUrl: string | null = null;
        if (imageUrl) {
            finalImageUrl = await imageService.processAndUpload(imageUrl, 'boardgame');
        }

        // AI Enrichment
        const categoryType = 'BOARDGAME';
        const description = await aiLimiter(() =>
            rewriteDescription(supabase, game.name, game.description, categoryType)
        );

        const tagHints = [...game.mechanics, ...game.categories].join(', ');
        const tagNames = await aiLimiter(() =>
            generateTags(supabase, game.name, `${description} Features: ${tagHints}`, categoryType)
        );
        const validTags = await ensureTags(supabase, tagNames);
        const embedding = await generateEmbedding(`${game.name}: ${description}`);

        const isExpansion = game.type === 'boardgameexpansion';

        // Construct DB Object
        const dbItem = {
            title: game.name,
            description: description,
            image_url: finalImageUrl,
            category_type: 'boardgame',
            source: 'bgg',
            external_id: String(game.id),
            external_ids: { bgg: game.id },

            // Board Game Specifics
            min_players: game.minPlayers || null,
            max_players: game.maxPlayers || null,
            min_playtime: game.minPlaytime || null,
            max_playtime: game.maxPlaytime || null,
            min_age: game.minAge || null,
            mechanics: game.mechanics,
            categories: game.categories,
            complexity: game.weight || null,
            designers: game.designers,
            artists: game.artists,
            publishers: game.publishers,
            is_expansion: isExpansion,
            bgg_id: game.id,

            // Generic Metadata
            release_year: game.yearPublished,
            vote_average: game.rating ? parseFloat(game.rating.toFixed(2)) : null,
            metadata: {
                source: 'bgg_massive',
                users_rated: game.usersRated,
                original_description: game.description.substring(0, 1000)
            },
            cached_tags: validTags,
            ...(embedding ? { vector_text: JSON.stringify(embedding) } : {})
        };

        const { error } = await supabase
            .from('global_items')
            .upsert(dbItem as any, { onConflict: 'source,external_id' } as any);

        if (error) {
            console.error(`      ❌ DB Error for ${game.name}:`, error.message);
            return false;
        }

        return true;
    } catch (err: any) {
        console.error(`      ❌ Processing Error for ${game.name}:`, err.message);
        return false;
    }
}

// ============================================================================
// RUNNER
// ============================================================================

async function run() {
    let currentId = getCursor();
    console.log(`🚀 STARTING MASSIVE BGG HARVEST`);
    console.log(`   🏁 Start ID: ${currentId}`);
    console.log(`   🎯 Max ID: ${MAX_ID}`);
    console.log(`   📦 Batch Size: ${BATCH_SIZE}`);
    console.log(`   🎚️  Min Votes: ${MIN_VOTES}`);
    console.log(`   💡 Make sure BGG_API_KEY is set in .env`);

    while (currentId <= MAX_ID) {
        const batchIds: number[] = [];
        for (let i = 0; i < BATCH_SIZE; i++) {
            if (currentId + i <= MAX_ID) {
                batchIds.push(currentId + i);
            }
        }

        if (batchIds.length === 0) break;

        process.stdout.write(`\n🔍 Batch ${batchIds[0]}-${batchIds[batchIds.length - 1]}... `);

        // Fetch
        const games = await fetchBatch(batchIds);

        if (games.length > 0) {
            // Filter: Only 'boardgame' or 'boardgameexpansion' with >= MIN_VOTES
            const notable = games.filter(g =>
                (g.type === 'boardgame' || g.type === 'boardgameexpansion') &&
                g.usersRated >= MIN_VOTES
            );

            if (notable.length > 0) {
                process.stdout.write(`Found ${notable.length} notable. Processing... `);
                let saved = 0;
                for (const game of notable) {
                    const ok = await processGame(game);
                    if (ok) saved++;
                }
                process.stdout.write(`✅ Saved ${saved}.`);
            } else {
                process.stdout.write(`(0 notable)`);
            }
        } else {
            process.stdout.write(`(empty)`);
        }

        // Advance
        currentId += BATCH_SIZE;
        saveCursor(currentId);

        // Sleep
        await sleep(RATE_LIMIT_DELAY);
    }

    console.log(`\n\n🎉 HARVEST COMPLETE!`);
}

run().catch(console.error);
