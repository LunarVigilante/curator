import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio'; // Much safer than regex for nested XML
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { ImageService } from '@/lib/services/image/imageService';
import { rewriteDescription, generateEmbedding, generateTags, ensureTags, sleep, aiLimiter } from '@/lib/harvesters/shared';
// @ts-ignore
import { fetchFromBgg } from '@/lib/harvesters/board-games';
import pLimit from 'p-limit';

// ============================================================================
// CONFIG
// ============================================================================
const BATCH_SIZE = 20;
const MAX_ID = 450000;
const MIN_VOTES = 50; // Lowered slightly to catch hidden gems
const RATE_LIMIT_DELAY = 3000;
const CURSOR_FILE = path.resolve('bgg-cursor.json');
const CONCURRENCY = 2; // AI processing concurrency

const supabase = createServiceRoleClient();
const imageService = new ImageService('covers');
const limit = pLimit(CONCURRENCY);

// ============================================================================
// TYPES
// ============================================================================

interface ParsedGame {
    id: number;
    type: string;
    name: string;
    description: string;
    image: string;
    thumbnail: string;
    yearPublished: number | null;

    // Stats
    rating: number;
    usersRated: number;
    weight: number; // Complexity 1-5
    rank: number | null;

    // Box Specs
    minPlayers: number;
    maxPlayers: number;
    minPlaytime: number;
    maxPlaytime: number;
    minAge: number;

    // Community Polls (The "Real" Specs)
    bestPlayers: string | null; // e.g., "4" or "3, 4"
    recommendedPlayers: string | null;
    communityMinAge: number | null;
    languageDependence: string | null;

    // Taxonomy
    mechanics: string[];
    categories: string[];
    families: string[]; // New: "Catan Series", "Kickstarter"

    // People
    designers: string[];
    artists: string[];
    publishers: string[];
}

// ============================================================================
// HELPERS
// ============================================================================

function getCursor(): number {
    if (fs.existsSync(CURSOR_FILE)) {
        const raw = fs.readFileSync(CURSOR_FILE, 'utf-8');
        return JSON.parse(raw).lastId || 1;
    }
    return 1;
}

function saveCursor(lastId: number) {
    fs.writeFileSync(CURSOR_FILE, JSON.stringify({ lastId }, null, 2));
}

function decodeHTMLEntities(text: string): string {
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/<br\s*\/?>/gi, '\n');
}

// ============================================================================
// BGG PARSING LOGIC
// ============================================================================

function parsePolls($item: any, $: any) {
    // 1. Player Count Poll
    let bestPlayers: string[] = [];
    let recPlayers: string[] = [];

    const playersPoll = $item.find('poll[name="suggested_numplayers"]');
    if (playersPoll.length) {
        playersPoll.find('results').each((_: number, results: any) => {
            const numPlayers = $(results).attr('numplayers');
            if (!numPlayers) return;

            // Get votes for each option
            const bestVotes = parseInt($(results).find('result[value="Best"]').attr('numvotes') || '0');
            const recVotes = parseInt($(results).find('result[value="Recommended"]').attr('numvotes') || '0');
            const notRecVotes = parseInt($(results).find('result[value="Not Recommended"]').attr('numvotes') || '0');
            const total = bestVotes + recVotes + notRecVotes;

            if (total > 0) {
                // Algorithm: If "Best" is the majority winner, add to Best. 
                // If "Best" + "Recommended" > "Not Rec", add to Recommended.
                if (bestVotes > recVotes && bestVotes > notRecVotes) {
                    bestPlayers.push(numPlayers);
                }
                if ((bestVotes + recVotes) > notRecVotes) {
                    recPlayers.push(numPlayers);
                }
            }
        });
    }

    // 2. Language Dependence Poll
    let langDep = null;
    const langPoll = $item.find('poll[name="language_dependence"]');
    if (langPoll.length) {
        let maxVotes = -1;
        langPoll.find('result').each((_: number, res: any) => {
            const votes = parseInt($(res).attr('numvotes') || '0');
            const value = $(res).attr('value'); // e.g. "No necessary in-game text"
            if (votes > maxVotes && value) {
                maxVotes = votes;
                langDep = value.split(' ').slice(0, 4).join(' ') + '...'; // Shorten it
            }
        });
    }

    // 3. Community Age Poll
    let commAge = null;
    const agePoll = $item.find('poll[name="suggested_playerage"]');
    if (agePoll.length) {
        let maxVotes = -1;
        agePoll.find('result').each((_: number, res: any) => {
            const votes = parseInt($(res).attr('numvotes') || '0');
            const value = $(res).attr('value');
            if (votes > maxVotes && value) {
                maxVotes = votes;
                commAge = parseInt(value);
            }
        });
    }

    return {
        bestPlayers: bestPlayers.join(', ') || null,
        recommendedPlayers: recPlayers.join(', ') || null,
        languageDependence: langDep,
        communityMinAge: commAge
    };
}

async function fetchBatch(ids: number[]): Promise<ParsedGame[]> {
    const idsParam = ids.join(',');
    const games: ParsedGame[] = [];

    try {
        const xml = await fetchFromBgg(`thing?id=${idsParam}&stats=1`);
        const $ = cheerio.load(xml, { xmlMode: true });

        $('item').each((_: number, el: any) => {
            const $item = $(el);
            const id = parseInt($item.attr('id') || '0');
            const type = $item.attr('type') || 'unknown';

            // Basic Info
            const name = $item.find('name[type="primary"]').attr('value') || 'Unknown';
            const desc = $item.find('description').text();
            const year = parseInt($item.find('yearpublished').attr('value') || '0');

            // Stats (Nested in statistics -> ratings)
            const stats = $item.find('statistics ratings');
            const rating = parseFloat(stats.find('average').attr('value') || '0');
            const usersRated = parseInt(stats.find('usersrated').attr('value') || '0');
            const weight = parseFloat(stats.find('averageweight').attr('value') || '0');

            // Rank (Find the "Board Game Rank", ignore sub-ranks)
            let rank = null;
            const rankObj = stats.find('ranks rank[name="boardgame"]');
            if (rankObj.attr('value') && rankObj.attr('value') !== 'Not Ranked') {
                rank = parseInt(rankObj.attr('value') || '0');
            }

            // Specs
            const minPlayers = parseInt($item.find('minplayers').attr('value') || '0');
            const maxPlayers = parseInt($item.find('maxplayers').attr('value') || '0');
            const minPlaytime = parseInt($item.find('minplaytime').attr('value') || '0');
            const maxPlaytime = parseInt($item.find('maxplaytime').attr('value') || '0');
            const minAge = parseInt($item.find('minage').attr('value') || '0');

            // Arrays (Links)
            const getLinks = (type: string) => $item.find(`link[type="${type}"]`).map((_: number, l: any) => $(l).attr('value')).get();

            const mechanics = getLinks('boardgamemechanic');
            const categories = getLinks('boardgamecategory');
            const families = getLinks('boardgamefamily');
            const designers = getLinks('boardgamedesigner');
            const artists = getLinks('boardgameartist');
            const publishers = getLinks('boardgamepublisher');

            // Advanced Polls
            const polls = parsePolls($item, $);

            if (id && name) {
                games.push({
                    id, type, name: decodeHTMLEntities(name), description: decodeHTMLEntities(desc),
                    image: $item.find('image').text(),
                    thumbnail: $item.find('thumbnail').text(),
                    yearPublished: year || null,
                    rating, usersRated, weight, rank,
                    minPlayers, maxPlayers, minPlaytime, maxPlaytime, minAge,
                    mechanics, categories, families, designers, artists, publishers,
                    ...polls
                });
            }
        });

    } catch (error) {
        console.error(`   ❌ BGG Fetch Error:`, error);
    }
    return games;
}

// ============================================================================
// PROCESSOR
// ============================================================================

async function processGame(game: ParsedGame): Promise<boolean> {
    try {
        console.log(`\n   ╔════════════════════════════════════════════════════════════════`);
        console.log(`   ║ 🎲 PROCESSING: ${game.name}`);
        console.log(`   ╠════════════════════════════════════════════════════════════════`);
        console.log(`   ║ BGG ID: ${game.id}`);
        console.log(`   ║ Type: ${game.type}`);
        console.log(`   ║ Year: ${game.yearPublished || 'N/A'}`);
        console.log(`   ╟────────────────────────────────────────────────────────────────`);
        console.log(`   ║ 📊 METADATA COLLECTED:`);
        console.log(`   ║    Players: ${game.minPlayers}-${game.maxPlayers}`);
        console.log(`   ║    Playtime: ${game.minPlaytime}-${game.maxPlaytime} min`);
        console.log(`   ║    Age: ${game.minAge}+`);
        console.log(`   ║    Complexity: ${game.weight.toFixed(2)}/5`);
        console.log(`   ║    Rating: ${game.rating.toFixed(2)} (${game.usersRated} votes)`);
        console.log(`   ║    Rank: ${game.rank || 'Unranked'}`);
        console.log(`   ║    Best Players: ${game.bestPlayers || 'N/A'}`);
        console.log(`   ║    Designers: ${game.designers.slice(0, 3).join(', ') || 'N/A'}`);
        console.log(`   ║    Mechanics: ${game.mechanics.slice(0, 5).join(', ') || 'N/A'}`);
        console.log(`   ║    Categories: ${game.categories.slice(0, 5).join(', ') || 'N/A'}`);
        console.log(`   ╟────────────────────────────────────────────────────────────────`);

        // 1. Image
        const imageUrl = game.image || game.thumbnail;
        let finalImageUrl: string | null = null;
        if (imageUrl) {
            console.log(`   ║ 🖼️  UPLOADING IMAGE...`);
            console.log(`   ║    Source: ${imageUrl.slice(0, 60)}...`);
            const startImg = Date.now();
            finalImageUrl = await imageService.processAndUpload(imageUrl, 'boardgame');
            if (finalImageUrl) {
                console.log(`   ║    ✅ Uploaded in ${Date.now() - startImg}ms`);
                console.log(`   ║    Dest: ${finalImageUrl.slice(0, 60)}...`);
            } else {
                console.log(`   ║    ⚠️  Upload failed`);
            }
        } else {
            console.log(`   ║ ⚠️  No image available`);
        }

        // 2. AI Enrichment
        console.log(`   ╟────────────────────────────────────────────────────────────────`);
        console.log(`   ║ 🧠 GENERATING AI DESCRIPTION...`);
        // RICH CONTEXT
        const richContext = `
Title: ${game.name} (${game.yearPublished || 'N/A'})
Designers: ${game.designers.join(', ')}
Mechanics: ${game.mechanics.join(', ')}
Categories: ${game.categories.join(', ')}
Family: ${game.families.join(', ')}
Description: ${game.description}
        `.trim();

        const categoryType = 'BOARD_GAME';
        const startDesc = Date.now();
        const description = await aiLimiter(() =>
            rewriteDescription(supabase, game.name, richContext, categoryType)
        );
        console.log(`   ║    ✅ Generated in ${Date.now() - startDesc}ms`);
        console.log(`   ║    Result: ${description.slice(0, 80)}...`);

        // Include Families in tag generation context
        console.log(`   ╟────────────────────────────────────────────────────────────────`);
        console.log(`   ║ 🏷️  GENERATING TAGS...`);
        const contextTags = [...game.mechanics, ...game.categories, ...game.families].join(', ');
        const startTags = Date.now();
        const tagNames = await aiLimiter(() =>
            generateTags(supabase, game.name, `${description} Context: ${contextTags}`, categoryType)
        );
        const validTags = await ensureTags(supabase, tagNames);
        console.log(`   ║    ✅ Generated ${tagNames.length} tags in ${Date.now() - startTags}ms`);
        console.log(`   ║    Tags: ${tagNames.slice(0, 8).join(', ')}`);

        // Rich Vector Text
        console.log(`   ╟────────────────────────────────────────────────────────────────`);
        console.log(`   ║ 🧮 GENERATING EMBEDDING...`);
        const vectorText = `
            Title: ${game.name}
            Designers: ${game.designers.join(', ')}
            Mechanics: ${game.mechanics.join(', ')}
            Theme: ${game.categories.join(', ')}
            Complexity: ${game.weight.toFixed(1)} / 5
            Best Players: ${game.bestPlayers || 'N/A'}
            Description: ${description}
        `.trim();
        console.log(`   ║    Vector text length: ${vectorText.length} chars`);

        const startEmbed = Date.now();
        const embedding = await generateEmbedding(vectorText);
        if (embedding) {
            console.log(`   ║    ✅ Embedding generated in ${Date.now() - startEmbed}ms (${embedding.length} dimensions)`);
        } else {
            console.log(`   ║    ⚠️  No embedding generated`);
        }

        const isExpansion = game.type === 'boardgameexpansion';

        // 3. Payload
        console.log(`   ╟────────────────────────────────────────────────────────────────`);
        console.log(`   ║ 💾 SAVING TO DATABASE...`);
        const payload = {
            title: game.name,
            description: description,
            image_url: finalImageUrl,
            category_type: categoryType,
            source: 'bgg',
            external_id: String(game.id),
            external_ids: { bgg: game.id },

            // Board Game Columns
            min_players: game.minPlayers || null,
            max_players: game.maxPlayers || null,
            min_playtime: game.minPlaytime || null,
            max_playtime: game.maxPlaytime || null,
            min_age: game.minAge || null,

            // Rich Data
            mechanics: game.mechanics,
            categories: game.categories,
            families: game.families, // New
            complexity: game.weight || null,
            rank_overall: game.rank, // New

            // Community Data (New)
            best_players: game.bestPlayers, // e.g. "4"
            min_age_community: game.communityMinAge,
            language_dependence: game.languageDependence,

            // People
            designers: game.designers,
            artists: game.artists,
            publishers: game.publishers,

            is_expansion: isExpansion,
            bgg_id: game.id, // Legacy column support

            // Generic
            release_year: game.yearPublished,
            vote_average: game.rating ? parseFloat(game.rating.toFixed(2)) : null,

            metadata: {
                source: 'bgg_ultimate',
                users_rated: game.usersRated,
                recommended_players: game.recommendedPlayers,
                original_description: game.description.substring(0, 1000)
            },

            cached_tags: validTags,
            vector_text: JSON.stringify(embedding),
            last_metadata_update: new Date().toISOString()
        };

        // Safe Upsert Logic
        const { data: existingBgg } = await supabase
            .from('global_items')
            .select('id, description_parts')
            .eq('source', 'bgg')
            .eq('external_id', String(game.id))
            .maybeSingle();

        if (existingBgg) {
            // Update - STRICTLY preserving description/tags/vectors
            const updatePayload = { ...payload };
            delete (updatePayload as any).description;
            delete (updatePayload as any).description_parts;
            delete (updatePayload as any).cached_tags;
            delete (updatePayload as any).vector_text;
            delete (updatePayload as any).image_url;

            const { error } = await (supabase.from('global_items') as any)
                .update(updatePayload)
                .eq('id', (existingBgg as any).id);

            if (error) {
                console.log(`   ║ ❌ DB ERROR: ${error.message}`);
                console.log(`   ╚════════════════════════════════════════════════════════════════\n`);
                return false;
            }
        } else {
            // Insert
            const { error } = await supabase
                .from('global_items')
                .insert(payload as any);

            if (error) {
                console.log(`   ║ ❌ DB ERROR: ${error.message}`);
                console.log(`   ╚════════════════════════════════════════════════════════════════\n`);
                return false;
            }
        }

        console.log(`   ║ ✅ SAVED SUCCESSFULLY`);
        console.log(`   ╚════════════════════════════════════════════════════════════════\n`);
        return true;
    } catch (err: any) {
        console.log(`   ║ ❌ PROCESSING ERROR: ${err.message}`);
        console.log(`   ╚════════════════════════════════════════════════════════════════\n`);
        return false;
    }
}

// ============================================================================
// RUNNER
// ============================================================================

async function run() {
    let currentId = getCursor();
    console.log(`🚀 STARTING ULTIMATE BGG HARVEST`);

    while (currentId <= MAX_ID) {
        const batchIds: number[] = [];
        for (let i = 0; i < BATCH_SIZE; i++) {
            if (currentId + i <= MAX_ID) batchIds.push(currentId + i);
        }

        if (batchIds.length === 0) break;
        process.stdout.write(`\n🔍 Batch ${batchIds[0]}... `);

        const games = await fetchBatch(batchIds);

        if (games.length > 0) {
            const notable = games.filter(g =>
                (g.type === 'boardgame' || g.type === 'boardgameexpansion') &&
                g.usersRated >= MIN_VOTES
            );

            if (notable.length > 0) {
                process.stdout.write(`Found ${notable.length}. Processing... `);

                // Concurrency Limiter
                const tasks = notable.map(game => limit(() => processGame(game)));
                await Promise.all(tasks);

                process.stdout.write(`✅ Done.`);
            } else {
                process.stdout.write(`(low votes)`);
            }
        } else {
            process.stdout.write(`(empty)`);
        }

        currentId += BATCH_SIZE;
        saveCursor(currentId);
        await sleep(RATE_LIMIT_DELAY);
    }
    console.log(`\n\n🎉 HARVEST COMPLETE!`);
}

run().catch(console.error);
