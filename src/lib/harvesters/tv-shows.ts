/**
 * TV Shows Harvester - TMDB (Massive Import)
 * Fetches TV shows from TMDB using both top_rated and popular endpoints
 * Targets ~2,000 shows (50 pages × 2 endpoints × 20 per page)
 * 
 * Uses 3-Bucket Strategy for description generation:
 * - NARRATIVE: Drama, Comedy, Sci-Fi, etc.
 * - FORMAT: Game Shows, Reality Competition, Talk Shows
 * - OBSERVATIONAL: Documentary, Docu-series, Reality without competition
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { HarvestItem, HarvestResult, sleep, aiLimiter, upsertItem, generateEmbedding, generateTags, ensureTags } from './shared';
import { generateTvShowDescription } from '@/lib/ai/tv-show-description';
import { combineDescription, buildEmbeddingText } from '@/lib/ai/structured-description';

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const API_DELAY_MS = 250;  // 250ms between calls for rate limiting
const MAX_PAGES = 50;      // 50 pages per endpoint

// TMDB Genre ID to Name mapping for TV shows
const TMDB_TV_GENRES: Record<number, string> = {
    10759: 'Action & Adventure',
    16: 'Animation',
    35: 'Comedy',
    80: 'Crime',
    99: 'Documentary',
    18: 'Drama',
    10751: 'Family',
    10762: 'Kids',
    9648: 'Mystery',
    10763: 'News',
    10764: 'Reality',
    10765: 'Sci-Fi & Fantasy',
    10766: 'Soap',
    10767: 'Talk',
    10768: 'War & Politics',
    37: 'Western',
    10770: 'TV Movie'
};

// List endpoint show (basic data)
interface TMDBTvShowBasic {
    id: number;
    name: string;
    overview: string;
    poster_path: string | null;
    first_air_date: string;
    vote_average: number;
    vote_count: number;
    genre_ids: number[];
    popularity: number;
    original_language: string;
    origin_country?: string[];
}

// Detail endpoint show (full enrichment)
interface TMDBTvShowDetailed extends TMDBTvShowBasic {
    genres: { id: number; name: string }[];
    networks: { id: number; name: string; logo_path: string | null }[];
    status: string;
    tagline?: string;
    number_of_seasons: number;
    number_of_episodes: number;
    episode_run_time: number[];
    created_by: { id: number; name: string }[];
    credits?: {
        cast: { id: number; name: string; character: string; order: number }[];
        crew: { id: number; name: string; job: string; department: string }[];
    };
    keywords?: {
        results: { id: number; name: string }[];
    };
    content_ratings?: {
        results: { iso_3166_1: string; rating: string; descriptors?: string[] }[];
    };
    external_ids?: {
        imdb_id?: string;
        tvdb_id?: number;
    };
}

async function fetchTMDBTvPage(endpoint: 'top_rated' | 'popular', page: number): Promise<TMDBTvShowBasic[]> {
    const url = `https://api.themoviedb.org/3/tv/${endpoint}?api_key=${TMDB_API_KEY}&page=${page}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            if (response.status === 429) {
                console.warn('   ⏳ Rate limited, waiting 10s...');
                await sleep(10000);
                return fetchTMDBTvPage(endpoint, page);
            }
            throw new Error(`TMDB error: ${response.status}`);
        }
        const data = await response.json();
        return data.results || [];
    } catch (error) {
        console.error(`   ❌ TMDB fetch error (${endpoint} page ${page}):`, error);
        return [];
    }
}

/**
 * Fetch full show details with credits, keywords, networks, content_ratings
 */
async function fetchTMDBTvDetails(showId: number): Promise<TMDBTvShowDetailed | null> {
    const url = `https://api.themoviedb.org/3/tv/${showId}?api_key=${TMDB_API_KEY}&append_to_response=credits,keywords,external_ids,content_ratings`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            if (response.status === 429) {
                console.warn('   ⏳ Rate limited on details, waiting 10s...');
                await sleep(10000);
                return fetchTMDBTvDetails(showId);
            }
            return null;
        }
        return await response.json();
    } catch (error) {
        console.error(`   ❌ TMDB details fetch error for ${showId}:`, error);
        return null;
    }
}

/**
 * Extract US content rating and descriptors
 */
function extractContentRating(details: TMDBTvShowDetailed): { rating: string | null; descriptors: string[] } {
    const usRating = details.content_ratings?.results?.find(r => r.iso_3166_1 === 'US');
    return {
        rating: usRating?.rating || null,
        descriptors: usRating?.descriptors || []
    };
}

export async function harvestTvShows(supabase: ReturnType<typeof createServiceRoleClient>): Promise<HarvestResult> {
    console.log('\n📺 HARVESTING TV SHOWS (TMDB - Full Enrichment)...');
    console.log(`   📋 Config: ${MAX_PAGES} pages × 2 endpoints = ~${MAX_PAGES * 40} shows target`);
    console.log(`   📦 Full enrichment: credits, keywords, networks, content_ratings`);

    if (!TMDB_API_KEY) {
        console.error('❌ TMDB_API_KEY not set');
        return { success: 0, skipped: 0, failed: 0, category: 'TV Shows' };
    }

    const showIds: number[] = [];
    const seenIds = new Set<number>();

    // Phase 1: Collect show IDs from list endpoints
    const endpoints: ('top_rated' | 'popular')[] = ['top_rated', 'popular'];

    for (const endpoint of endpoints) {
        console.log(`\n   🔄 Fetching ${endpoint} list...`);

        for (let page = 1; page <= MAX_PAGES; page++) {
            const pageShows = await fetchTMDBTvPage(endpoint, page);

            for (const show of pageShows) {
                if (!seenIds.has(show.id)) {
                    seenIds.add(show.id);
                    showIds.push(show.id);
                }
            }

            if ((page % 10 === 0) || page === MAX_PAGES) {
                console.log(`   📺 TV (${endpoint}): Page ${page}/${MAX_PAGES} (${showIds.length} total unique)`);
            }

            await sleep(API_DELAY_MS);
        }
    }

    console.log(`\n📊 Collected ${showIds.length} unique show IDs`);
    console.log(`\n🔍 Phase 2: Fetching full details for each show...`);

    let success = 0, failed = 0, skipped = 0;

    for (let i = 0; i < showIds.length; i++) {
        const showId = showIds[i];

        try {
            // Fetch full show details with all enrichment
            const details = await fetchTMDBTvDetails(showId);
            await sleep(API_DELAY_MS);

            if (!details) {
                console.log(`   ⏭️  [${i + 1}/${showIds.length}] Skipped ${showId} (no details)`);
                skipped++;
                continue;
            }

            // Extract genres as names
            const genres = details.genres?.map(g => g.name) || [];

            // Extract networks as names
            const networks = details.networks?.map(n => n.name) || [];

            // Extract keywords
            const keywords = details.keywords?.results?.map(k => k.name) || [];

            // Extract cast with characters (top 15)
            const castWithCharacters = details.credits?.cast
                ?.slice(0, 15)
                .map(c => ({ name: c.name, character: c.character })) || [];

            // Extract content rating
            const { rating: contentRating, descriptors: contentDescriptors } = extractContentRating(details);

            // Extract creators
            const creators = details.created_by?.map(c => c.name) || [];

            // Extract directors from crew
            const directors = details.credits?.crew
                ?.filter(c => c.job === 'Director' || c.department === 'Directing')
                .slice(0, 5)
                .map(c => c.name) || [];

            // Generate 5-part structured description using 3-bucket prompts
            const description_parts = await aiLimiter(() =>
                generateTvShowDescription(supabase, {
                    title: details.name,
                    originalDescription: details.overview,
                    type: 'TV Show',
                    metadata: {
                        first_air_date: details.first_air_date,
                        vote_average: details.vote_average,
                        origin_country: details.origin_country,
                        status: details.status,
                        networks
                    },
                    // Full grounding data for 3-bucket detection
                    genres,
                    keywords,
                    castWithCharacters,
                    contentDescriptors,
                    networks
                })
            );

            // Combine for backwards compatibility
            const description = combineDescription(description_parts);

            // Generate tags
            const tagNames = await aiLimiter(() =>
                generateTags(supabase, details.name, description, 'TV Show')
            );
            const validTags = await ensureTags(supabase, tagNames);

            // Extract runtime (average episode length)
            const runtime = details.episode_run_time?.length
                ? Math.round(details.episode_run_time.reduce((a, b) => a + b, 0) / details.episode_run_time.length)
                : null;

            const item: HarvestItem = {
                title: details.name,
                description,
                description_parts,
                image_url: details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : null,
                category_type: 'TV_SHOW',
                external_ids: {
                    tmdb_tv: details.id,
                    imdb: details.external_ids?.imdb_id,
                    tvdb: details.external_ids?.tvdb_id
                },
                original_language: details.original_language || null,
                origin_countries: details.origin_country || [],
                genres,
                keywords,
                director: creators[0] || directors[0] || undefined,
                cast: castWithCharacters.map(c => c.name),
                runtime: runtime ?? undefined,
                status: details.status,
                release_year: details.first_air_date ? parseInt(details.first_air_date.split('-')[0], 10) : null,
                metadata: {
                    release_date: details.first_air_date,
                    first_air_date: details.first_air_date,
                    vote_average: details.vote_average,
                    vote_count: details.vote_count,
                    popularity: details.popularity,
                    original_language: details.original_language,
                    origin_country: details.origin_country,
                    media_type: 'tv',
                    source: 'tmdb_harvest_full',
                    original_overview: details.overview,
                    // Full enrichment data
                    networks,
                    network_names: networks.join(', '),
                    creators,
                    directors,
                    cast_with_characters: castWithCharacters,
                    content_rating: contentRating,
                    content_descriptors: contentDescriptors,
                    tagline: details.tagline,
                    status: details.status,
                    number_of_seasons: details.number_of_seasons,
                    number_of_episodes: details.number_of_episodes,
                    episode_run_time: runtime,
                    // Filterable fields (per checklist Phase 4)
                    bucket_type: description_parts.bucketType,
                    production_tags: description_parts.productionTags
                },
                cached_tags: validTags
            };

            // Generate rich embedding from all item data (includes semanticSummary)
            const embeddingText = buildEmbeddingText(item);
            const embedding = await generateEmbedding(embeddingText);
            if (embedding) {
                item.embedding = embedding;
            }

            const result = await upsertItem(supabase, item, 'tmdb_tv', details.id);
            if (result) success++;
            else failed++;

            if ((i + 1) % 25 === 0) {
                console.log(`   📺 TV Shows: ${i + 1}/${showIds.length} (${success} ✓, ${failed} ✗, ${skipped} ⏭️)`);
            }
        } catch (error) {
            console.error(`   ❌ Failed to process show ${showId}:`, error);
            failed++;
        }

        await sleep(50);
    }

    console.log(`\n✅ TV Shows: ${success} added, ${skipped} skipped, ${failed} failed`);
    return { success, skipped, failed, category: 'TV Shows' };
}

