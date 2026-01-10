
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { ImageService } from '@/lib/services/image/imageService';
import { rewriteDescription, generateEmbedding, generateTags, ensureTags, sleep, aiLimiter } from '@/lib/harvesters/shared';
import xml2js from 'xml2js';

// ============================================================================
// CONFIG
// ============================================================================
const BGG_API_BASE = 'https://boardgamegeek.com/xmlapi2/thing';
const BATCH_SIZE = 20;
const MAX_ID = 450000;
const MIN_VOTES = 100;
const RATE_LIMIT_DELAY = 3000; // 3s sleep strictly required
const CURSOR_FILE = path.resolve('bgg-cursor.json');

const supabase = createServiceRoleClient();
const imageService = new ImageService('covers');
const parser = new xml2js.Parser();

// ============================================================================
// TYPES & CURSOR
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

/**
 * Extract text value from XML node array (xml2js format)
 */
function val(node: any): string | null {
    return (node && node[0] && node[0]._) ? node[0]._ : (node && node[0] ? node[0] : null);
}

function attr(node: any, key: string): string | null {
    return (node && node[0] && node[0].$ && node[0].$[key]) ? node[0].$[key] : null;
}

function getLinks(item: any, typeName: string): string[] {
    if (!item.link) return [];
    return item.link
        .filter((l: any) => l.$ && l.$.type === typeName)
        .map((l: any) => l.$.value);
}

// ============================================================================
// MAIN PIPELINE
// ============================================================================

async function fetchBatch(ids: number[]) {
    const idString = ids.join(',');
    const url = `${BGG_API_BASE}?id=${idString}&stats=1`;

    try {
        const res = await fetch(url);
        if (!res.ok) {
            if (res.status === 429) {
                console.warn(`   ⚠️ Rate limit hit. Sleeping 10s...`);
                await sleep(10000);
                return fetchBatch(ids); // Retry
            }
            throw new Error(`BGG API Error: ${res.statusText}`);
        }
        const text = await res.text();
        const result = await parser.parseStringPromise(text);
        return result.items.item || [];
    } catch (e) {
        console.error(`   ❌ Fetch Error:`, e);
        return null;
    }
}

async function processItem(item: any) {
    const bggId = Number(item.$.id);
    const type = item.$.type; // 'boardgame', 'boardgameexpansion'
    const name = val(item.name?.find((n: any) => n.$.type === 'primary_name') ? [item.name.find((n: any) => n.$.type === 'primary_name')] : item.name);

    // Filter: Type
    const isExpansion = type === 'boardgameexpansion';
    if (type !== 'boardgame' && !isExpansion) return null; // Strictly ignore RPGs, videogames

    // Filter: Votes
    const stats = item.statistics?.[0]?.ratings?.[0];
    const usersRated = Number(val(stats?.usersrated));
    if (!usersRated || usersRated < MIN_VOTES) return null;

    // Specs
    const minPlayers = Number(val(item.minplayers)) || null;
    const maxPlayers = Number(val(item.maxplayers)) || null;
    const minPlaytime = Number(val(item.minplaytime)) || null;
    const maxPlaytime = Number(val(item.maxplaytime)) || null;
    const minAge = Number(val(item.minage)) || null;
    const yearPublished = Number(val(item.yearpublished)) || null;

    // Metrics
    const complexity = parseFloat(val(stats?.averageweight) || '0') || null;
    const voteAvg = parseFloat(val(stats?.average) || '0') || null;

    // Lists
    const mechanics = getLinks(item, 'boardgamemechanic');
    const categories = getLinks(item, 'boardgamecategory');
    const designers = getLinks(item, 'boardgamedesigner');
    const artists = getLinks(item, 'boardgameartist');
    const publishers = getLinks(item, 'boardgamepublisher');

    // Description
    const rawDesc = val(item.description) || '';

    // Image
    const imageUrlRaw = val(item.image) || val(item.thumbnail);
    let finalImageUrl: string | null = null;

    if (imageUrlRaw) {
        finalImageUrl = await imageService.processAndUpload(imageUrlRaw, 'boardgame');
    }

    // AI Enrichment
    const categoryType = 'BOARDGAME';
    const description = await aiLimiter(() => rewriteDescription(supabase, name || 'Board Game', rawDesc, categoryType));
    const tagNames = await aiLimiter(() => generateTags(supabase, name || 'Board Game', description, categoryType));
    const validTags = await ensureTags(supabase, tagNames);
    const embedding = await generateEmbedding(`${name}: ${description}`);

    // Construct DB Object
    const dbItem = {
        title: name,
        description: description,
        image_url: finalImageUrl,
        category_type: 'boardgame',
        source: 'bgg', // Required for Unique Constraint
        external_id: String(bggId), // Required for Unique Constraint
        external_ids: { bgg: bggId },

        // Board Game Specifics
        min_players: minPlayers,
        max_players: maxPlayers,
        min_playtime: minPlaytime,
        max_playtime: maxPlaytime,
        min_age: minAge,
        mechanics: mechanics,
        categories: categories, // Maps to 'categories' column on global_items (which is TEXT[])
        complexity: complexity, // BGG Weight 1-5
        designers: designers,
        artists: artists,
        publishers: publishers,
        is_expansion: isExpansion,
        bgg_id: bggId,

        // Generic Metadata
        release_year: yearPublished,
        vote_average: voteAvg ? parseFloat(voteAvg.toFixed(2)) : null,
        metadata: {
            source: 'bgg_massive',
            users_rated: usersRated,
            original_description: rawDesc.substring(0, 1000) // Truncate generic meta if needed
        },
        cached_tags: validTags,
        ...(embedding ? { vector_text: JSON.stringify(embedding) } : {})
    };

    return dbItem;
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

    while (currentId <= MAX_ID) {
        const batchIds = [];
        for (let i = 0; i < BATCH_SIZE; i++) {
            if (currentId + i <= MAX_ID) {
                batchIds.push(currentId + i);
            }
        }

        if (batchIds.length === 0) break;

        process.stdout.write(`\n🔍 Batch ${batchIds[0]}-${batchIds[batchIds.length - 1]}... `);

        // Fetch
        const items = await fetchBatch(batchIds);

        if (items && items.length > 0) {
            let processedCount = 0;

            for (const item of items) {
                try {
                    const dbPayload = await processItem(item);

                    if (dbPayload) {
                        // Upsert
                        const { error } = await supabase
                            .from('global_items')
                            .upsert(dbPayload as any, { onConflict: 'source,external_id' } as any); // Cast for safety if types aren't perfect

                        // Also try regular insert if upsert fails on unique constraint logic
                        if (error && error.code !== '23505') {
                            // Fallback: Check if exists by BGG ID specifically?
                            // Actually, since we use `external_ids` in our logic but `source, external_id` key in DB...
                            // We should ensure `source` and `external_id` (legacy) might be set or we rely on unique index.
                            // Wait, schema has UNIQUE(source, external_id).
                            // We are not setting `source` and `external_id` (legacy) explicitly in `dbPayload` above?
                            // Ah, BGG ID is `bgg_id` column now, but we should probably ALSO set `source='bgg'` and `external_id=String(bggId)` for constraint compatibility.

                            console.error(`Error upserting ${dbPayload.title}:`, error);
                        } else if (!error) {
                            processedCount++;
                        }
                    }
                } catch (err: any) {
                    console.error(`Err processing item: ${err.message}`);
                }
            }
            process.stdout.write(`✅ Saved ${processedCount} notable items.`);
        } else {
            process.stdout.write(`(No data/Empty)`);
        }

        // Advance
        currentId += BATCH_SIZE;
        saveCursor(currentId);

        // Sleep
        await sleep(RATE_LIMIT_DELAY);
    }

    console.log(`\n🎉 HARVEST COMPLETE!`);
}

// Fix for legacy 'external_id' constraint:
// We should attach explicit source/external_id to the payload to satisfy the UNIQUE(source, external_id) constraint used for upserts.
// I'll wrap run() to catch top level errors.
run().catch(console.error);
