/**
 * TV Shows Harvester - TMDB (Massive Import)
 * Fetches TV shows from TMDB using both top_rated and popular endpoints
 * Targets ~2,000 shows (50 pages × 2 endpoints × 20 per page)
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { HarvestItem, HarvestResult, sleep, aiLimiter, rewriteDescription, upsertItem, generateEmbedding, generateTags, ensureTags } from './shared';

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const API_DELAY_MS = 250;  // 250ms between calls for rate limiting
const MAX_PAGES = 50;      // 50 pages per endpoint

interface TMDBTvShow {
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
}

async function fetchTMDBTvPage(endpoint: 'top_rated' | 'popular', page: number): Promise<TMDBTvShow[]> {
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

export async function harvestTvShows(supabase: ReturnType<typeof createServiceRoleClient>): Promise<HarvestResult> {
    console.log('\n📺 HARVESTING TV SHOWS (TMDB - Deep Import)...');
    console.log(`   📋 Config: ${MAX_PAGES} pages × 2 endpoints = ~${MAX_PAGES * 40} shows target`);

    if (!TMDB_API_KEY) {
        console.error('❌ TMDB_API_KEY not set');
        return { success: 0, skipped: 0, failed: 0, category: 'TV Shows' };
    }

    const shows: TMDBTvShow[] = [];
    const showIds = new Set<number>();

    // Fetch from both endpoints
    const endpoints: ('top_rated' | 'popular')[] = ['top_rated', 'popular'];

    for (const endpoint of endpoints) {
        console.log(`\n   🔄 Fetching ${endpoint}...`);

        for (let page = 1; page <= MAX_PAGES; page++) {
            const pageShows = await fetchTMDBTvPage(endpoint, page);

            // Dedupe by ID
            for (const show of pageShows) {
                if (!showIds.has(show.id)) {
                    showIds.add(show.id);
                    shows.push(show);
                }
            }

            if ((page % 10 === 0) || page === MAX_PAGES) {
                console.log(`   📺 TV (${endpoint}): Page ${page}/${MAX_PAGES} processed (${shows.length} total unique)`);
            }

            await sleep(API_DELAY_MS);
        }
    }

    console.log(`\n📊 Fetched ${shows.length} unique TV shows`);

    let success = 0, skipped = 0, failed = 0;

    for (let i = 0; i < shows.length; i++) {
        const show = shows[i];

        try {
            // AI rewrite with limiter
            const description = await aiLimiter(() =>
                rewriteDescription(supabase, show.name, show.overview, 'TV Show')
            );

            // Generate tags
            const tagNames = await aiLimiter(() =>
                generateTags(supabase, show.name, description, 'TV Show')
            );
            const validTags = await ensureTags(supabase, tagNames);

            // Generate embedding
            const embedding = await generateEmbedding(`${show.name}: ${description}`);

            const item: HarvestItem = {
                title: show.name,
                description,
                image_url: show.poster_path ? `https://image.tmdb.org/t/p/w500${show.poster_path}` : null,
                category_type: 'TV_SHOW',
                external_ids: { tmdb_tv: show.id },
                metadata: {
                    release_date: show.first_air_date,  // Mapped from first_air_date
                    first_air_date: show.first_air_date,
                    vote_average: show.vote_average,
                    vote_count: show.vote_count,
                    popularity: show.popularity,
                    genre_ids: show.genre_ids,
                    original_language: show.original_language,
                    media_type: 'tv',  // Distinguish from movies
                    source: 'tmdb_harvest',
                    original_overview: show.overview
                },
                cached_tags: validTags,
                ...(embedding ? { embedding } : {})
            };

            const result = await upsertItem(supabase, item, 'tmdb_tv', show.id);
            if (result) success++;
            else failed++;
        } catch (error) {
            console.error(`   ❌ Failed to process "${show.name}":`, error);
            failed++;
        }

        if ((i + 1) % 100 === 0) {
            console.log(`   📺 TV Shows: ${i + 1}/${shows.length} (${success} added, ${failed} failed)`);
        }

        await sleep(50);  // Small delay between DB operations
    }

    console.log(`✅ TV Shows: ${success} added, ${skipped} skipped, ${failed} failed`);
    return { success, skipped, failed, category: 'TV Shows' };
}
