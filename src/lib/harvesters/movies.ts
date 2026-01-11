/**
 * Movies Harvester - TMDB (Massive Import)
 * Fetches movies from TMDB using both top_rated and popular endpoints
 * Targets ~2,000 movies (50 pages × 2 endpoints × 20 per page)
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { HarvestItem, HarvestResult, sleep, aiLimiter, rewriteDescription, upsertItem, generateEmbedding, generateTags, ensureTags } from './shared';

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const API_DELAY_MS = 250;  // 250ms between calls for rate limiting
const MAX_PAGES = 50;      // 50 pages per endpoint
const MIN_VOTE_COUNT = 50; // Minimum votes to consider quality content

interface TMDBMovie {
    id: number;
    title: string;
    overview: string;
    poster_path: string | null;
    release_date: string;
    vote_count: number;
    vote_average: number;
    genre_ids: number[];
    popularity: number;
    original_language: string;
    origin_country?: string[];
}

async function fetchTMDBMoviePage(endpoint: 'top_rated' | 'popular', page: number): Promise<TMDBMovie[]> {
    const url = `https://api.themoviedb.org/3/movie/${endpoint}?api_key=${TMDB_API_KEY}&page=${page}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            if (response.status === 429) {
                console.warn('   ⏳ Rate limited, waiting 10s...');
                await sleep(10000);
                return fetchTMDBMoviePage(endpoint, page);
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

export async function harvestMovies(supabase: ReturnType<typeof createServiceRoleClient>): Promise<HarvestResult> {
    console.log('\n🎬 HARVESTING MOVIES (TMDB - Deep Import)...');
    console.log(`   📋 Config: ${MAX_PAGES} pages × 2 endpoints = ~${MAX_PAGES * 40} movies target`);

    if (!TMDB_API_KEY) {
        console.error('❌ TMDB_API_KEY not set');
        return { success: 0, skipped: 0, failed: 0, category: 'Movies' };
    }

    const movies: TMDBMovie[] = [];
    const movieIds = new Set<number>();

    // Fetch from both endpoints
    const endpoints: ('top_rated' | 'popular')[] = ['top_rated', 'popular'];

    for (const endpoint of endpoints) {
        console.log(`\n   🔄 Fetching ${endpoint}...`);

        for (let page = 1; page <= MAX_PAGES; page++) {
            const pageMovies = await fetchTMDBMoviePage(endpoint, page);

            // Dedupe by ID and filter by quality
            for (const movie of pageMovies) {
                if (!movieIds.has(movie.id) && movie.vote_count >= MIN_VOTE_COUNT) {
                    movieIds.add(movie.id);
                    movies.push(movie);
                }
            }

            if ((page % 10 === 0) || page === MAX_PAGES) {
                console.log(`   🎬 Movies (${endpoint}): Page ${page}/${MAX_PAGES} processed (${movies.length} total qualified)`);
            }

            await sleep(API_DELAY_MS);
        }
    }

    console.log(`\n📊 Fetched ${movies.length} unique movies (min ${MIN_VOTE_COUNT} votes)`);

    let success = 0, failed = 0;
    const skipped = 0;

    for (let i = 0; i < movies.length; i++) {
        const movie = movies[i];

        try {
            // AI rewrite with limiter
            const description = await aiLimiter(() =>
                rewriteDescription(supabase, movie.title, movie.overview, 'Movie')
            );

            // Generate tags
            const tagNames = await aiLimiter(() =>
                generateTags(supabase, movie.title, description, 'Movie')
            );
            const validTags = await ensureTags(supabase, tagNames);

            // Generate embedding
            const embedding = await generateEmbedding(`${movie.title}: ${description}`);

            const item: HarvestItem = {
                title: movie.title,
                description,
                image_url: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
                category_type: 'MOVIE',
                external_ids: { tmdb: movie.id },
                original_language: movie.original_language || null,
                origin_countries: movie.origin_country || [],
                metadata: {
                    release_date: movie.release_date,
                    vote_average: movie.vote_average,
                    vote_count: movie.vote_count,
                    popularity: movie.popularity,
                    genre_ids: movie.genre_ids,
                    original_language: movie.original_language,
                    origin_country: movie.origin_country,
                    media_type: 'movie',  // Distinguish from TV shows
                    source: 'tmdb_harvest',
                    original_overview: movie.overview
                },
                cached_tags: validTags,
                ...(embedding ? { embedding } : {})
            };

            const result = await upsertItem(supabase, item, 'tmdb', movie.id);
            if (result) success++;
            else failed++;
        } catch (error) {
            console.error(`   ❌ Failed to process "${movie.title}":`, error);
            failed++;
        }

        if ((i + 1) % 100 === 0) {
            console.log(`   🎬 Movies: ${i + 1}/${movies.length} (${success} added, ${failed} failed)`);
        }

        await sleep(50);  // Small delay between DB operations
    }

    console.log(`✅ Movies: ${success} added, ${skipped} skipped, ${failed} failed`);
    return { success, skipped, failed, category: 'Movies' };
}
