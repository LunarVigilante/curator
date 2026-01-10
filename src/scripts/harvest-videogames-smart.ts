
import 'dotenv/config';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { ImageService } from '@/lib/services/image/imageService';
import { SteamGridDBService } from '@/lib/services/steamgriddb';
import { rewriteDescription, generateEmbedding, generateTags, ensureTags, upsertItem, sleep, aiLimiter } from '@/lib/harvesters/shared';
import pLimit from 'p-limit';

// Config
const START_YEAR = 2025;
const END_YEAR = 1980;
const MAX_PAGES = 5; // Top 200 per year (40 * 5)
const PAGE_SIZE = 40;
const CONCURRENCY = 5;
const RAWG_BASE_URL = 'https://api.rawg.io/api';
const RAWG_API_KEY = process.env.RAWG_API_KEY;

// Rate Limiting
const DETAIL_DELAY_MS = 500;

if (!RAWG_API_KEY) {
    console.error('❌ Missing RAWG_API_KEY');
    process.exit(1);
}

const supabase = createServiceRoleClient();
const imageService = new ImageService('covers');
const sgdbService = new SteamGridDBService();
const limit = pLimit(CONCURRENCY);

// Types
interface TriageItem {
    id: string; // Supabase UUID
    isComplete: boolean;
}

// Map<rawg_id, TriageItem>
const triageMap = new Map<number, TriageItem>();

// ============================================================================
// HELPERS
// ============================================================================

async function fetchRawgList(year: number, page: number) {
    const dates = `${year}-01-01,${year}-12-31`;
    const url = `${RAWG_BASE_URL}/games?key=${RAWG_API_KEY}&dates=${dates}&page_size=${PAGE_SIZE}&page=${page}&ordering=-metacritic`;

    const res = await fetch(url);
    if (!res.ok) {
        if (res.status === 429) {
            console.warn('   ⚠️ Rate limited (List). Sleeping 10s...');
            await sleep(10000);
            return fetchRawgList(year, page);
        }
        throw new Error(`RAWG List Error ${res.status}`);
    }
    return await res.json();
}

async function fetchRawgDetails(id: number) {
    const url = `${RAWG_BASE_URL}/games/${id}?key=${RAWG_API_KEY}`;
    await sleep(Math.random() * DETAIL_DELAY_MS);

    const res = await fetch(url);
    if (!res.ok) {
        if (res.status === 429) {
            console.warn('   ⚠️ Rate limited (Details). Sleeping 10s...');
            await sleep(10000);
            return fetchRawgDetails(id);
        }
        if (res.status === 404) return null;
        throw new Error(`RAWG Details Error ${res.status}`);
    }
    return await res.json();
}

function stripHtml(html: string): string {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '').trim();
}

/**
 * Extracts Steam App ID from RAWG details stores
 */
function extractSteamId(details: any): number | undefined {
    // Look for store with id = 1 (Steam)
    const steamStore = details.stores?.find((s: any) => s.store?.id === 1);
    const url = steamStore?.url || ''; // e.g., "https://store.steampowered.com/app/123456/Game_Name/"

    if (!url) return undefined;

    const match = url.match(/\/app\/(\d+)/);
    return match ? parseInt(match[1]) : undefined;
}

function extractMetadata(details: any) {
    const platforms = details.parent_platforms?.map((p: any) => p.platform?.name) || [];
    const developers = details.developers?.map((d: any) => d.name) || [];
    const publishers = details.publishers?.map((p: any) => p.name) || [];
    const releaseYear = details.released ? new Date(details.released).getFullYear() : null;
    const rawDesc = details.description || details.description_raw || '';
    const cleanDesc = stripHtml(rawDesc);
    const steamId = extractSteamId(details);

    return {
        platforms,
        developers,
        publishers,
        playtime: details.playtime || 0,
        metacritic: details.metacritic,
        release_year: releaseYear,
        genres: details.genres?.map((g: any) => g.name) || [],
        steamAppId: steamId,

        // Base
        title: details.name,
        description_raw: cleanDesc,
        background_image: details.background_image,
        website: details.website,
        rating: details.rating, // 0-5
        raw_id: details.id
    };
}

// ============================================================================
// MAIN LOOP
// ============================================================================

async function startHarvest() {
    console.log(`🚀 STARTING SMART VIDEO GAME HARVEST (RAWG + STEAMGRIDDB)`);
    console.log(`   📅 Years: ${START_YEAR} -> ${END_YEAR}`);
    console.log(`   ⚡ Concurrency: ${CONCURRENCY}`);

    console.log(`\n📥 Building Triage Map from DB...`);
    const { data: existingItems, error } = await supabase
        .from('global_items')
        .select('id, external_ids, platforms')
        .not('external_ids', 'is', null);

    if (error) {
        console.error('❌ Failed to load existing items:', error);
        process.exit(1);
    }

    let completeCount = 0;
    let incompleteCount = 0;

    existingItems.forEach((row: any) => {
        if (row.external_ids?.rawg) {
            const rawgId = Number(row.external_ids.rawg);
            const isComplete = (row.platforms !== null && row.platforms.length > 0);

            triageMap.set(rawgId, { id: row.id, isComplete });

            if (isComplete) completeCount++;
            else incompleteCount++;
        }
    });

    console.log(`   ✅ Loaded ${triageMap.size} items.`);
    console.log(`   📊 Stats: ${completeCount} Complete (Skip), ${incompleteCount} Incomplete (Heal).`);

    for (let year = START_YEAR; year >= END_YEAR; year--) {
        console.log(`\n📅 Processing Year: ${year}`);

        for (let page = 1; page <= MAX_PAGES; page++) {
            try {
                const data = await fetchRawgList(year, page);
                const results = data.results || [];

                if (results.length === 0) break;

                const batch = results.map((game: any) => {
                    const status = triageMap.get(game.id);
                    if (!status) return { type: 'NEW', game };
                    if (!status.isComplete) return { type: 'HEAL', game, id: status.id };
                    return { type: 'SKIP', game };
                });

                const newCount = batch.filter((b: any) => b.type === 'NEW').length;
                const healCount = batch.filter((b: any) => b.type === 'HEAL').length;

                if (newCount === 0 && healCount === 0) {
                    process.stdout.write('.');
                    continue;
                }

                console.log(`   📄 Year ${year} Page ${page}: ${newCount} New, ${healCount} Heal`);

                const tasks = batch.map((task: any) => limit(async () => {
                    if (task.type === 'SKIP') return;
                    await processTask(task);
                }));

                await Promise.all(tasks);

            } catch (err) {
                console.error(`   ❌ Failed Year ${year} Page ${page}:`, err);
                await sleep(5000);
            }
        }
    }
    console.log('\n✅ SMART HARVEST COMPLETE');
}

async function processTask(task: any) {
    const rawgId = task.game.id;
    const title = task.game.name;

    try {
        const details = await fetchRawgDetails(rawgId);
        if (!details) return;

        const meta = extractMetadata(details);

        if (task.type === 'NEW') {
            // 1. Image Strategy (SteamGridDB -> Prioritize Vertical)
            let imageUrl: string | null = null;
            let targetImage = meta.background_image;

            try {
                // Try to find a better cover via SteamGridDB
                const sgdbCover = await sgdbService.getBestCoverArtInstance(meta.title, meta.steamAppId);
                if (sgdbCover) {
                    targetImage = sgdbCover;
                }
            } catch (sgdbErr) {
                console.warn(`      ⚠️ SGDB Lookup failed for ${meta.title}`, sgdbErr);
            }

            if (targetImage) {
                imageUrl = await imageService.processAndUpload(targetImage, 'game');
            }

            // 2. AI Description
            const categoryType = 'VIDEO_GAME';
            const baseDesc = meta.description_raw || `${meta.title} (${meta.release_year})`;

            const description = await aiLimiter(() =>
                rewriteDescription(supabase, meta.title, baseDesc, categoryType)
            );

            // 3. Tags & Embeddings
            const tagNames = await aiLimiter(() =>
                generateTags(supabase, meta.title, description, categoryType)
            );
            const validTags = await ensureTags(supabase, tagNames);
            const embedding = await generateEmbedding(`${meta.title}: ${description}`);

            // 4. Construct Item
            const newItem = {
                title: meta.title,
                description: description,
                image_url: imageUrl,
                category_type: categoryType,
                external_ids: { rawg: rawgId, steam: meta.steamAppId },
                metadata: {
                    source: `rawg_sgdb_smart`,
                    original_description: meta.description_raw,
                    rating: meta.rating,
                    website: meta.website,
                    steam_id: meta.steamAppId
                },
                cached_tags: validTags,
                release_year: meta.release_year,
                genres: meta.genres,
                platforms: meta.platforms,
                developers: meta.developers,
                studio: meta.developers?.[0] || null,
                publishers: meta.publishers,
                playtime: meta.playtime,
                metacritic: meta.metacritic,

                ...(embedding ? { vector_text: JSON.stringify(embedding) } : {})
            };

            const { error } = await (supabase.from('global_items') as any).insert(newItem);
            if (error) throw error;

            triageMap.set(rawgId, { id: 'pending-uuid', isComplete: true });

        } else if (task.type === 'HEAL') {
            const updatePayload = {
                platforms: meta.platforms,
                developers: meta.developers,
                studio: meta.developers?.[0] || null,
                publishers: meta.publishers,
                playtime: meta.playtime,
                metacritic: meta.metacritic,
                genres: meta.genres,
                release_year: meta.release_year,
                last_metadata_update: new Date().toISOString()
            };

            const { error } = await (supabase
                .from('global_items') as any)
                .update(updatePayload)
                .eq('id', task.id);

            if (error) throw error;

            triageMap.set(rawgId, { id: task.id, isComplete: true });
        }

    } catch (error) {
        console.error(`     ❌ Failed processing ${title} (${rawgId}):`, error);
    }
}

startHarvest().catch(console.error);
