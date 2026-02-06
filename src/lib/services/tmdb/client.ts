/**
 * TMDB API Client
 * 
 * Low-level API functions for fetching data from The Movie Database (TMDB).
 * Handles rate limiting, retries, and basic response parsing.
 */

import { sleep } from '@/lib/utils/concurrency';
import type { TmdbDiscoverResult, TmdbAggregateCredit } from './types';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_API_KEY = process.env.TMDB_API_KEY;

// =============================================================================
// DISCOVER API
// =============================================================================

/**
 * Fetch TMDB discover results for movies or TV shows
 * 
 * @param type - 'movie' or 'tv'
 * @param year - Release/air year to filter
 * @param page - Page number (1-indexed)
 */
export async function fetchTmdbDiscover(
    type: 'movie' | 'tv',
    year: number,
    page: number
): Promise<TmdbDiscoverResult> {
    const sort = 'vote_count.desc';
    const yearParam = type === 'movie' ? `primary_release_year=${year}` : `first_air_date_year=${year}`;
    const url = `${TMDB_BASE_URL}/discover/${type}?api_key=${TMDB_API_KEY}&sort_by=${sort}&page=${page}&${yearParam}&include_adult=false&vote_count.gte=10`;

    const res = await fetch(url);
    if (!res.ok) {
        if (res.status === 429) {
            console.warn('   ⚠️ Rate limited (Discover). Sleeping 5s...');
            await sleep(5000);
            return fetchTmdbDiscover(type, year, page);
        }
        throw new Error(`TMDB Discover Error ${res.status}`);
    }
    return await res.json();
}

// =============================================================================
// DETAILS API
// =============================================================================

/**
 * Fetch full details for a movie or TV show
 * 
 * @param type - 'movie' or 'tv'
 * @param tmdbId - TMDB ID
 * @returns Full details object or null if not found
 */
export async function fetchTmdbDetails(type: 'movie' | 'tv', tmdbId: number): Promise<any | null> {
    const commonAppend = 'credits,videos,images,external_ids,keywords,watch/providers,recommendations';
    const append = type === 'movie'
        ? `${commonAppend},release_dates`
        : `${commonAppend},content_ratings`;

    const url = `${TMDB_BASE_URL}/${type}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=${append}`;

    const res = await fetch(url);
    if (!res.ok) {
        if (res.status === 429) {
            console.warn('   ⚠️ Rate limited (Details). Sleeping 5s...');
            await sleep(5000);
            return fetchTmdbDetails(type, tmdbId);
        }
        if (res.status === 404) return null;
        throw new Error(`TMDB Details Error ${res.status}`);
    }
    return await res.json();
}

// =============================================================================
// KEYWORD DISCOVERY
// =============================================================================

/**
 * Discover all TV shows with a specific TMDB keyword
 * Used for universe detection (e.g., all shows tagged "arrowverse")
 * 
 * @param keywordId - TMDB keyword ID
 * @param maxPages - Maximum pages to fetch (default: 5)
 * @returns Array of TMDB show IDs
 */
export async function discoverByKeyword(keywordId: number, maxPages: number = 5): Promise<number[]> {
    const results: number[] = [];
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages && page <= maxPages) {
        const url = `${TMDB_BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&with_keywords=${keywordId}&sort_by=first_air_date.asc&page=${page}`;

        try {
            const res = await fetch(url);
            if (!res.ok) {
                if (res.status === 429) {
                    console.warn('   ⚠️ Rate limited (Discover by Keyword). Sleeping 5s...');
                    await sleep(5000);
                    continue;
                }
                throw new Error(`TMDB Discover Error ${res.status}`);
            }

            const data = await res.json();
            results.push(...data.results.map((s: any) => s.id));
            totalPages = data.total_pages;
            page++;

        } catch (error) {
            console.error(`Failed to discover by keyword ${keywordId}:`, error);
            break;
        }
    }

    return results;
}

// =============================================================================
// AGGREGATE CREDITS
// =============================================================================

/**
 * Fetch aggregate credits for a TV show (full cast/crew across all seasons)
 * Used for building creator graphs
 * 
 * @param showId - TMDB show ID
 * @returns Array of credits with person ID, name, and role
 */
export async function fetchAggregateCredits(showId: number): Promise<TmdbAggregateCredit[]> {
    const url = `${TMDB_BASE_URL}/tv/${showId}/aggregate_credits?api_key=${TMDB_API_KEY}`;

    try {
        const res = await fetch(url);
        if (!res.ok) {
            if (res.status === 429) {
                await sleep(5000);
                return fetchAggregateCredits(showId);
            }
            return [];
        }

        const data = await res.json();
        const credits: TmdbAggregateCredit[] = [];

        // Process crew (creators, writers, directors, producers)
        for (const person of (data.crew || [])) {
            for (const job of (person.jobs || [])) {
                credits.push({
                    personId: person.id,
                    name: person.name,
                    role: job.job,
                    department: person.department || 'Unknown',
                    episodeCount: job.episode_count || 0
                });
            }
        }

        return credits;

    } catch {
        return [];
    }
}
