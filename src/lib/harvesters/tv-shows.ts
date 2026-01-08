/**
 * TV Shows Harvester - TMDB
 * Fetches top-rated TV shows from The Movie Database
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { HarvestItem, HarvestResult, sleep, aiLimiter, rewriteDescription, upsertItem, generateEmbedding } from './shared';

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const API_DELAY_MS = 300;
const LIMIT = 100;

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

export async function harvestTvShows(supabase: ReturnType<typeof createServiceRoleClient>): Promise<HarvestResult> {
    console.log('\n📺 HARVESTING TV SHOWS (TMDB)...');

    if (!TMDB_API_KEY) {
        console.error('❌ TMDB_API_KEY not set');
        return { success: 0, skipped: 0, failed: 0, category: 'TV Shows' };
    }

    const shows: TMDBTvShow[] = [];
    const pagesToFetch = Math.ceil(LIMIT / 20);

    // Fetch pages
    for (let page = 1; page <= pagesToFetch; page++) {
        const url = `https://api.themoviedb.org/3/tv/top_rated?api_key=${TMDB_API_KEY}&page=${page}`;
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`TMDB error: ${response.status}`);
            const data = await response.json();
            shows.push(...data.results);
            await sleep(API_DELAY_MS);
        } catch (error) {
            console.error(`❌ TMDB fetch error (page ${page}):`, error);
        }
    }

    const limitedShows = shows.slice(0, LIMIT);
    console.log(`📊 Fetched ${limitedShows.length} TV shows`);

    let success = 0, skipped = 0, failed = 0;

    for (let i = 0; i < limitedShows.length; i++) {
        const show = limitedShows[i];

        // AI rewrite with limiter
        const description = await aiLimiter(() =>
            rewriteDescription(supabase, show.name, show.overview, 'TV Show')
        );

        // Generate embedding
        const embedding = await generateEmbedding(`${show.name}: ${description}`);

        const item: HarvestItem = {
            title: show.name,
            description,
            image_url: show.poster_path ? `https://image.tmdb.org/t/p/w500${show.poster_path}` : null,
            category_type: 'TV_SHOW',
            external_ids: { tmdb_tv: show.id },
            metadata: {
                first_air_date: show.first_air_date,
                vote_average: show.vote_average,
                vote_count: show.vote_count,
                popularity: show.popularity,
                genre_ids: show.genre_ids,
                original_language: show.original_language,
                source: 'tmdb_harvest',
                original_overview: show.overview
            },
            ...(embedding ? { embedding } : {})
        };

        const result = await upsertItem(supabase, item, 'tmdb_tv', show.id);
        if (result) success++;
        else failed++;

        if ((i + 1) % 25 === 0) {
            console.log(`   📺 TV Shows: ${i + 1}/${limitedShows.length} (${success} added)`);
        }

        await sleep(100);
    }

    console.log(`✅ TV Shows: ${success} added, ${skipped} skipped, ${failed} failed`);
    return { success, skipped, failed, category: 'TV Shows' };
}
