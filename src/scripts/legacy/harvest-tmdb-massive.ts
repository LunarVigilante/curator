
import 'dotenv/config';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { ImageService } from '@/lib/services/image/imageService';
import { rewriteDescription, generateEmbedding, generateTags, ensureTags, upsertItem, sleep, aiLimiter } from '@/lib/harvesters/shared';
import pLimit from 'p-limit';
import { HarvestItem } from '@/lib/harvesters/shared';

// CLI Args
const args = process.argv.slice(2);
const typeArg = args.find(a => a.startsWith('--type='))?.split('=')[1];
const TYPE: 'movie' | 'tv' = (typeArg === 'tv' ? 'tv' : 'movie');

// Config
const START_YEAR = 2026;
const END_YEAR = 1970;
const MAX_PAGES = 20; // Top 20 pages per year
const CONCURRENCY = 5;

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

if (!TMDB_API_KEY) {
    console.error('❌ Missing TMDB_API_KEY');
    process.exit(1);
}

const supabase = createServiceRoleClient();
// Initialize ImageService with 'covers' bucket as requested
const imageService = new ImageService('covers');
const limit = pLimit(CONCURRENCY);

async function fetchTmdbDiscover(year: number, page: number) {
    const sort = 'vote_count.desc';
    const yearParam = TYPE === 'movie' ? `primary_release_year=${year}` : `first_air_date_year=${year}`;

    // Ensure we filter out junk with low vote counts if needed, but sort by vote_count.desc helps
    const url = `${TMDB_BASE_URL}/discover/${TYPE}?api_key=${TMDB_API_KEY}&sort_by=${sort}&page=${page}&${yearParam}&include_adult=false&vote_count.gte=10`;

    const res = await fetch(url);
    if (!res.ok) {
        if (res.status === 429) {
            console.warn('   ⚠️ Rate limited. Sleeping 5s...');
            await sleep(5000);
            return fetchTmdbDiscover(year, page);
        }
        throw new Error(`TMDB Error ${res.status}: ${res.statusText}`);
    }
    return await res.json();
}

async function startHarvest() {
    console.log(`🚀 STARTING MASSIVE TMDB HARVEST (${TYPE.toUpperCase()})`);
    console.log(`   📅 Years: ${START_YEAR} -> ${END_YEAR}`);
    console.log(`   📄 Pages per year: ${MAX_PAGES}`);
    console.log(`   ⚡ Concurrency: ${CONCURRENCY}`);

    // 1. Load Existing IDs for correct Skip Logic
    console.log(`\n📥 Fetching all existing TMDB IDs from DB...`);
    const { data: existingItems, error } = await supabase
        .from('global_items')
        .select('external_ids')
        .not('external_ids', 'is', null);

    if (error) {
        console.error('❌ Failed to load existing items:', error);
        process.exit(1);
    }

    const existingIds = new Set<number>();
    existingItems.forEach((row: any) => {
        if (row.external_ids?.tmdb) {
            existingIds.add(Number(row.external_ids.tmdb));
        }
    });

    console.log(`   ✅ Loaded ${existingIds.size} existing items. Strict skipping enabled.`);

    // 2. Iterate Years
    for (let year = START_YEAR; year >= END_YEAR; year--) {
        console.log(`\n📅 Processing Year: ${year}`);

        for (let page = 1; page <= MAX_PAGES; page++) {
            try {
                const data = await fetchTmdbDiscover(year, page);
                const results = data.results || [];

                if (results.length === 0) {
                    console.log(`   ⚠️ No more results for ${year} page ${page}. Breaking year loop.`);
                    break;
                }

                const newItems = results.filter((item: any) => !existingIds.has(item.id));
                const skippedCount = results.length - newItems.length;

                if (newItems.length === 0) {
                    process.stdout.write('.'); // Compact progress for skipped pages
                    continue;
                }

                console.log(`   📄 Year ${year} Page ${page}: Found ${results.length} items (${skippedCount} skipped, ${newItems.length} new)`);

                // Process new items concurrently
                const tasks = newItems.map((tmdbItem: any) => limit(async () => {
                    await processItem(tmdbItem, year);
                }));

                await Promise.all(tasks);

                // Rate limiting between pages
                await sleep(250);

            } catch (err) {
                console.error(`   ❌ Failed Year ${year} Page ${page}:`, err);
                await sleep(1000);
            }
        }
    }

    console.log('\n✅ HARVEST COMPLETE');
}

async function processItem(tmdbItem: any, year: number) {
    const title = tmdbItem.title || tmdbItem.name;
    const overview = tmdbItem.overview;
    const tmdbId = tmdbItem.id;
    const categoryType = TYPE === 'movie' ? 'MOVIE' : 'TV';

    try {
        // 1. Image Pipeline
        let imageUrl: string | null = null;
        if (tmdbItem.poster_path) {
            const rawUrl = `https://image.tmdb.org/t/p/original${tmdbItem.poster_path}`;
            // Use 'covers' bucket logic via ImageService
            imageUrl = await imageService.processAndUpload(rawUrl, TYPE);
        }

        // 2. AI Description
        // We use the overview as base. If empty, we might skip or use basic info.
        const baseDesc = overview || `${title} (${year})`;
        const description = await aiLimiter(() =>
            rewriteDescription(supabase, title, baseDesc, categoryType)
        );

        // 3. Metadata & Tags
        // We could fetch deeper details here if needed (e.g. credits), but discover endpoint has basic info.
        // For 'massive' import, basic discover info is often enough to start.
        // To get genres, we need to map genre_ids, but let's rely on AI categorization/tagging for now or fetch details if critical.
        // Let's stick to discover data for speed unless requested otherwise.

        // Generate tags
        const tagNames = await aiLimiter(() =>
            generateTags(supabase, title, description, categoryType)
        );
        const validTags = await ensureTags(supabase, tagNames);

        // Generate embedding
        const embedding = await generateEmbedding(`${title}: ${description}`);

        const item: HarvestItem = {
            title,
            description,
            image_url: imageUrl,
            category_type: categoryType,
            external_ids: { tmdb: tmdbId },
            metadata: {
                year: year,
                release_date: tmdbItem.release_date || tmdbItem.first_air_date,
                popularity: tmdbItem.popularity,
                vote_average: tmdbItem.vote_average,
                vote_count: tmdbItem.vote_count,
                original_language: tmdbItem.original_language,
                source: `tmdb_massive_${TYPE}`,
                original_overview: overview
            },
            cached_tags: validTags,
            ...(embedding ? { embedding } : {})
        };

        // 4. Save
        await upsertItem(supabase, item, 'tmdb', tmdbId);

        // Add to Set to prevent re-processing in same run (unlikely but safe)
        // existingIds.add(tmdbId); // Not available in this scope, but fine.

    } catch (error) {
        console.error(`     ❌ Failed ${title} (${tmdbId}):`, error);
    }
}

startHarvest().catch(console.error);
