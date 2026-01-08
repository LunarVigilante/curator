/**
 * Movies Harvester - TMDB
 * Fetches top-rated movies from The Movie Database
 * (Adapted from deep-import-tmdb.ts for the modular harvester pattern)
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { HarvestItem, HarvestResult, sleep, aiLimiter, rewriteDescription, upsertItem, generateEmbedding } from './shared';

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const API_DELAY_MS = 300;
const LIMIT = 100;
const MIN_VOTE_COUNT = 50;

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
}

export async function harvestMovies(supabase: ReturnType<typeof createServiceRoleClient>): Promise<HarvestResult> {
    console.log('\n🎬 HARVESTING MOVIES (TMDB)...');

    if (!TMDB_API_KEY) {
        console.error('❌ TMDB_API_KEY not set');
        return { success: 0, skipped: 0, failed: 0, category: 'Movies' };
    }

    const movies: TMDBMovie[] = [];
    const pagesToFetch = Math.ceil(LIMIT / 20);

    // Fetch top rated movies
    for (let page = 1; page <= pagesToFetch; page++) {
        const url = `https://api.themoviedb.org/3/movie/top_rated?api_key=${TMDB_API_KEY}&page=${page}`;
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`TMDB error: ${response.status}`);
            const data = await response.json();
            movies.push(...data.results);
            await sleep(API_DELAY_MS);
        } catch (error) {
            console.error(`❌ TMDB fetch error (page ${page}):`, error);
        }
    }

    // Filter by vote count and limit
    const qualifiedMovies = movies
        .filter(m => m.vote_count >= MIN_VOTE_COUNT)
        .slice(0, LIMIT);

    console.log(`📊 Fetched ${qualifiedMovies.length} movies (min ${MIN_VOTE_COUNT} votes)`);

    let success = 0, skipped = 0, failed = 0;

    for (let i = 0; i < qualifiedMovies.length; i++) {
        const movie = qualifiedMovies[i];

        // AI rewrite with limiter
        const description = await aiLimiter(() =>
            rewriteDescription(supabase, movie.title, movie.overview, 'Movie')
        );

        // Generate embedding
        const embedding = await generateEmbedding(`${movie.title}: ${description}`);

        const item: HarvestItem = {
            title: movie.title,
            description,
            image_url: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
            category_type: 'MOVIE',
            external_ids: { tmdb: movie.id },
            metadata: {
                release_date: movie.release_date,
                vote_average: movie.vote_average,
                vote_count: movie.vote_count,
                popularity: movie.popularity,
                genre_ids: movie.genre_ids,
                original_language: movie.original_language,
                source: 'tmdb_harvest',
                original_overview: movie.overview
            },
            ...(embedding ? { embedding } : {})
        };

        const result = await upsertItem(supabase, item, 'tmdb', movie.id);
        if (result) success++;
        else failed++;

        if ((i + 1) % 25 === 0) {
            console.log(`   🎬 Movies: ${i + 1}/${qualifiedMovies.length} (${success} added)`);
        }

        await sleep(100);
    }

    console.log(`✅ Movies: ${success} added, ${skipped} skipped, ${failed} failed`);
    return { success, skipped, failed, category: 'Movies' };
}
