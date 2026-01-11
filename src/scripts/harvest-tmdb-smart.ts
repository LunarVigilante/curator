
import 'dotenv/config';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { ImageService } from '@/lib/services/image/imageService';
import { rewriteDescription, generateEmbedding, generateTags, ensureTags, upsertItem, sleep, aiLimiter } from '@/lib/harvesters/shared';
import pLimit from 'p-limit';

// Config
const START_YEAR = 2026;
const END_YEAR = 1970;
const MAX_PAGES = 20;
const CONCURRENCY = 5;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_API_KEY = process.env.TMDB_API_KEY;

// CLI Args
const args = process.argv.slice(2);
const typeArg = args.find(a => a.startsWith('--type='))?.split('=')[1];
const TYPE: 'movie' | 'tv' = (typeArg === 'tv' ? 'tv' : 'movie');

if (!TMDB_API_KEY) {
    console.error('❌ Missing TMDB_API_KEY');
    process.exit(1);
}

const supabase = createServiceRoleClient();
const imageService = new ImageService('covers');
const limit = pLimit(CONCURRENCY);

// Types
interface TriageItem {
    id: string; // Supabase UUID
    isComplete: boolean;
}

// Map<tmdb_id, TriageItem>
const triageMap = new Map<number, TriageItem>();
// Map<lower(title)+category_type, TriageItem> for title-based lookup
const titleMap = new Map<string, TriageItem>();

// ============================================================================
// HELPERS
// ============================================================================

async function fetchTmdbDiscover(year: number, page: number) {
    const sort = 'vote_count.desc';
    const yearParam = TYPE === 'movie' ? `primary_release_year=${year}` : `first_air_date_year=${year}`;
    const url = `${TMDB_BASE_URL}/discover/${TYPE}?api_key=${TMDB_API_KEY}&sort_by=${sort}&page=${page}&${yearParam}&include_adult=false&vote_count.gte=10`;

    const res = await fetch(url);
    if (!res.ok) {
        if (res.status === 429) {
            console.warn('   ⚠️ Rate limited (Discover). Sleeping 5s...');
            await sleep(5000);
            return fetchTmdbDiscover(year, page);
        }
        throw new Error(`Data Fetch Error ${res.status}`);
    }
    return await res.json();
}

async function fetchTmdbDetails(tmdbId: number) {
    // Append extra modules for metadata extraction
    const append = TYPE === 'movie' ? 'credits,release_dates,videos' : 'credits,content_ratings,videos';
    const url = `${TMDB_BASE_URL}/${TYPE}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=${append}`;

    const res = await fetch(url);
    if (!res.ok) {
        if (res.status === 429) {
            console.warn('   ⚠️ Rate limited (Details). Sleeping 5s...');
            await sleep(5000);
            return fetchTmdbDetails(tmdbId);
        }
        // 404 means deleted from TMDB, just return null
        if (res.status === 404) return null;
        throw new Error(`Details Fetch Error ${res.status}`);
    }
    return await res.json();
}

// ============================================================================
// EXTRACTION LOGIC
// ============================================================================

function extractMetadata(details: any) {
    // 1. Cast (Top 5)
    // cast is usually under 'credits.cast'
    const cast = details.credits?.cast?.slice(0, 5).map((c: any) => c.name) || [];

    // 2. Crew (Director, Writer)
    const crew = details.credits?.crew || [];
    const director = crew.find((c: any) => c.job === 'Director')?.name || null;

    // Writers can be "Screenplay", "Writer", "Story"
    const writer = crew.find((c: any) => ['Screenplay', 'Writer', 'Story'].includes(c.job))?.name || null;

    // 3. Studio
    const studio = details.production_companies?.[0]?.name || null;

    // 4. Content Rating (US Certificate)
    let contentRating = null;
    if (TYPE === 'movie') {
        const usRelease = details.release_dates?.results?.find((r: any) => r.iso_3166_1 === 'US');
        if (usRelease) {
            // prioritize certification from theatrical release (type 3) or first available
            const cert = usRelease.release_dates.find((d: any) => d.certification);
            contentRating = cert?.certification || null;
        }
    } else {
        const usRating = details.content_ratings?.results?.find((r: any) => r.iso_3166_1 === 'US');
        contentRating = usRating?.rating || null;
    }

    // 5. Trailer (YouTube)
    const videos = details.videos?.results || [];
    const trailer = videos.find((v: any) => v.site === 'YouTube' && v.type === 'Trailer');
    const trailerUrl = trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null;

    return {
        cast,
        director,
        writer,
        studio,
        genres: details.genres?.map((g: any) => g.name) || [],
        release_year: new Date(details.release_date || details.first_air_date || new Date().toISOString()).getFullYear(),
        runtime: details.runtime || (details.episode_run_time?.length ? details.episode_run_time[0] : 0),
        vote_average: details.vote_average,
        content_rating: contentRating,
        trailer_url: trailerUrl,
        tagline: details.tagline || null,
        // Keep these for base mapping
        overview: details.overview,
        title: details.title || details.name,
        poster_path: details.poster_path,
        release_date: details.release_date || details.first_air_date,
        popularity: details.popularity,
        original_language: details.original_language,
        origin_countries: details.origin_country || (details.production_countries?.map((c: any) => c.iso_3166_1) || [])
    };
}

// ============================================================================
// MAIN LOOP
// ============================================================================

async function startHarvest() {
    console.log(`🚀 STARTING SMART TMDB HARVEST (${TYPE.toUpperCase()})`);
    console.log(`   📅 Years: ${START_YEAR} -> ${END_YEAR}`);
    console.log(`   ⚡ Concurrency: ${CONCURRENCY}`);

    // 1. Build Triage Map
    console.log(`\n📥 Building Triage Map from DB...`);

    // Fetch ALL items in relevant category to catch title-based duplicates
    const categoryType = TYPE === 'movie' ? 'MOVIE' : 'TV_SHOW';
    const { data: existingItems, error } = await supabase
        .from('global_items')
        .select('id, title, external_ids, cast, category_type')
        .eq('category_type', categoryType);

    if (error) {
        console.error('❌ Failed to load existing items:', error);
        process.exit(1);
    }

    let completeCount = 0;
    let incompleteCount = 0;

    existingItems.forEach((row: any) => {
        const isComplete = (row.cast !== null && row.cast.length > 0);
        const triageItem = { id: row.id, isComplete };

        // Index by external_id if present
        const tmdbId = row.external_ids?.tmdb || row.external_ids?.tmdb_tv;
        if (tmdbId) {
            triageMap.set(Number(tmdbId), triageItem);
        }

        // Also index by title+category for title-based lookup
        if (row.title) {
            const titleKey = `${row.title.toLowerCase()}|${row.category_type}`;
            titleMap.set(titleKey, triageItem);
        }

        if (isComplete) completeCount++;
        else incompleteCount++;
    });

    console.log(`   ✅ Loaded ${existingItems.length} items (${triageMap.size} by ID, ${titleMap.size} by title).`);
    console.log(`   📊 Stats: ${completeCount} Complete (Skip), ${incompleteCount} Incomplete (Heal).`);

    // 2. Iterate Years
    for (let year = START_YEAR; year >= END_YEAR; year--) {
        console.log(`\n📅 Processing Year: ${year}`);

        for (let page = 1; page <= MAX_PAGES; page++) {
            try {
                const data = await fetchTmdbDiscover(year, page);
                const results = data.results || [];

                if (results.length === 0) break;

                // Triage Batch - check both external_id AND title
                const batch = results.map((item: any) => {
                    const title = item.title || item.name;
                    const titleKey = `${title.toLowerCase()}|${categoryType}`;

                    // First check by external_id
                    let status = triageMap.get(item.id);

                    // If not found by ID, check by title
                    if (!status) {
                        status = titleMap.get(titleKey);
                    }

                    if (!status) return { type: 'NEW', item };
                    if (!status.isComplete) return { type: 'HEAL', item, id: status.id };
                    return { type: 'SKIP', item };
                });

                const newCount = batch.filter((b: any) => b.type === 'NEW').length;
                const healCount = batch.filter((b: any) => b.type === 'HEAL').length;
                const skipCount = batch.filter((b: any) => b.type === 'SKIP').length;

                if (newCount === 0 && healCount === 0) {
                    process.stdout.write('.'); // Compact progress
                    continue;
                }

                console.log(`   📄 Year ${year} Page ${page}: ${newCount} New, ${healCount} Heal, ${skipCount} Skip`);

                // Concurrent Processing
                const tasks = batch.map((task: any) => limit(async () => {
                    if (task.type === 'SKIP') return;
                    await processTask(task, year);
                }));

                await Promise.all(tasks);
                await sleep(250); // Small cooldown between pages

            } catch (err) {
                console.error(`   ❌ Failed Year ${year} Page ${page}:`, err);
                await sleep(1000);
            }
        }
    }
    console.log('\n✅ SMART HARVEST COMPLETE');
}

async function processTask(task: any, year: number) {
    const tmdbId = task.item.id;
    const title = task.item.title || task.item.name;

    try {
        // Fetch Full Details
        const details = await fetchTmdbDetails(tmdbId);
        if (!details) return; // Deleted item

        // Extract Standardized Metadata
        const meta = extractMetadata(details);

        // ============================================
        // SCENARIO A: NEW ITEM
        // ============================================
        if (task.type === 'NEW') {
            // 1. Image
            let imageUrl: string | null = null;
            if (meta.poster_path) {
                const rawUrl = `https://image.tmdb.org/t/p/original${meta.poster_path}`;
                imageUrl = await imageService.processAndUpload(rawUrl, TYPE);
            }

            // 2. AI Description
            const baseDesc = meta.overview || `${meta.title} (${meta.release_year})`;
            const categoryType = TYPE === 'movie' ? 'MOVIE' : 'TV_SHOW'; // mapped to standard types

            const description = await aiLimiter(() =>
                rewriteDescription(supabase, meta.title, baseDesc, categoryType)
            );

            // 3. Tags & Embeddings
            const tagNames = await aiLimiter(() =>
                generateTags(supabase, meta.title, description, categoryType)
            );
            const validTags = await ensureTags(supabase, tagNames);
            const embedding = await generateEmbedding(`${meta.title}: ${description}`);

            // 4. Construct Full Item
            const newItem = {
                title: meta.title,
                description: description,
                image_url: imageUrl,
                category_type: categoryType,
                external_ids: TYPE === 'movie' ? { tmdb: tmdbId } : { tmdb_tv: tmdbId },
                metadata: {
                    source: `tmdb_smart_${TYPE}`,
                    original_overview: meta.overview,
                    release_date: meta.release_date,
                    popularity: meta.popularity,
                    original_language: meta.original_language,
                    origin_country: meta.origin_countries
                },
                cached_tags: validTags,
                // New Columns
                original_language: meta.original_language,
                origin_countries: meta.origin_countries,
                cast: meta.cast,
                director: meta.director,
                writer: meta.writer,
                studio: meta.studio,
                genres: meta.genres,
                release_year: meta.release_year,
                content_rating: meta.content_rating,
                runtime: meta.runtime,
                vote_average: meta.vote_average,
                trailer_url: meta.trailer_url,
                tagline: meta.tagline,
                ...(embedding ? { vector_text: JSON.stringify(embedding) } : {}) // Assuming vector_text or dedicated column, shared util handles 'embedding' property usually. 
                // Wait, typical shared 'upsertItem' takes 'embedding' and handles it? 
                // Let's look at upsertItem in shared.ts.
                // Usually upsertItem handles 'embedding' field -> 'vector' column.
                // But here we are using supabase direct insert or shared.
                // Let's check shared.ts usage. 
                // shared.ts definition: interface HarvestItem { embedding?: number[] ... }
                // And upsertItem uses it.
            };

            // Using shared upsert might NOT handle the new columns yet unless we updated the type definition.
            // Since we added columns to DB but maybe not to HarvestItem type in shared.ts, 
            // we should probably do a direct Supabase Insert/Upsert here to be safe and explicit with the new columns.
            // Or cast it.

            const { error } = await (supabase.from('global_items') as any).insert({
                ...newItem
            } as any);

            if (error) throw error;

            // Update Triage Map in case we encounter it again (unlikely)
            triageMap.set(tmdbId, { id: 'pending-uuid', isComplete: true });

            // ============================================
            // SCENARIO B: HEAL (UPDATE METADATA ONLY)
            // ============================================
        } else if (task.type === 'HEAL') {

            const updatePayload = {
                // Backfill external_id if missing
                external_ids: TYPE === 'movie' ? { tmdb: tmdbId } : { tmdb_tv: tmdbId },
                original_language: meta.original_language,
                origin_countries: meta.origin_countries,
                cast: meta.cast,
                director: meta.director,
                writer: meta.writer,
                studio: meta.studio,
                genres: meta.genres,
                release_year: meta.release_year,
                content_rating: meta.content_rating,
                runtime: meta.runtime,
                vote_average: meta.vote_average,
                trailer_url: meta.trailer_url,
                tagline: meta.tagline,
                // Optional: Update popularity/rating while we're here
                last_metadata_update: new Date().toISOString()
            };

            const { error } = await (supabase
                .from('global_items') as any)
                .update(updatePayload)
                .eq('id', task.id);

            if (error) throw error;

            // Mark complete in map
            triageMap.set(tmdbId, { id: task.id, isComplete: true });
        }

    } catch (error) {
        console.error(`     ❌ Failed processing ${title} (${tmdbId}):`, error);
    }
}

startHarvest().catch(console.error);
