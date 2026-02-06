/**
 * OMDb API Client
 * 
 * Fetch supplemental data from Open Movie Database (ratings, awards, etc.)
 */

import type { OmdbData } from './types';

const OMDB_BASE_URL = 'https://www.omdbapi.com';
const OMDB_API_KEY = process.env.OMDB_API_KEY;

/**
 * Parse OMDb response into normalized data structure
 */
function parseOmdbResponse(data: any): OmdbData {
    let rtScore: number | null = null;
    const rtSource = data.Ratings?.find((r: any) => r.Source === 'Rotten Tomatoes');
    if (rtSource?.Value) {
        rtScore = parseInt(rtSource.Value.replace('%', ''), 10);
    }

    return {
        imdb_rating: data.imdbRating && data.imdbRating !== 'N/A' ? parseFloat(data.imdbRating) : null,
        imdb_votes: data.imdbVotes ? parseInt(data.imdbVotes.replace(/,/g, ''), 10) : null,
        rotten_tomatoes_rating: rtScore,
        metacritic_rating: data.Metascore && data.Metascore !== 'N/A' ? parseInt(data.Metascore, 10) : null,
        awards: data.Awards && data.Awards !== 'N/A' ? data.Awards : null,
        rated: data.Rated && data.Rated !== 'N/A' ? data.Rated : null,
        writer: data.Writer && data.Writer !== 'N/A' ? data.Writer : null,
        box_office: data.BoxOffice && data.BoxOffice !== 'N/A' ? data.BoxOffice : null,
    };
}

/**
 * Fetch OMDb data by IMDb ID
 * 
 * @param imdbId - IMDb ID (e.g., "tt0903747")
 * @returns Parsed OMDb data or null if not found
 */
export async function fetchOmdbData(imdbId: string): Promise<OmdbData | null> {
    if (!OMDB_API_KEY || !imdbId) return null;

    const url = `${OMDB_BASE_URL}/?apikey=${OMDB_API_KEY}&i=${imdbId}&tomatoes=true`;
    try {
        const res = await fetch(url);
        if (!res.ok) return null;

        const data = await res.json();
        if (data.Response === 'False') return null;

        return parseOmdbResponse(data);
    } catch {
        return null;
    }
}

/**
 * Fetch OMDb data by title and year (fallback when IMDb ID unavailable)
 * 
 * @param title - Movie/show title
 * @param year - Release year
 * @returns Parsed OMDb data or null if not found
 */
export async function fetchOmdbDataByTitle(title: string, year: number): Promise<OmdbData | null> {
    if (!OMDB_API_KEY) return null;

    const url = `${OMDB_BASE_URL}/?apikey=${OMDB_API_KEY}&t=${encodeURIComponent(title)}&y=${year}&tomatoes=true`;
    try {
        const res = await fetch(url);
        if (!res.ok) return null;

        const data = await res.json();
        if (data.Response === 'False') return null;

        return parseOmdbResponse(data);
    } catch {
        return null;
    }
}
