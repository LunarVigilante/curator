'use server';

/**
 * TVDB v4 API Client
 * 
 * Provides JWT-authenticated access to TheTVDB v4 API for TV show enrichment.
 * Features:
 * - JWT session management with auto-refresh on 401
 * - Series extended data (characters, tags, lists)
 * - Anime absolute episode ordering
 * 
 * @see https://thetvdb.github.io/v4-api/
 */

// =============================================================================
// TYPES
// =============================================================================

export interface TvdbCharacter {
    id: number;
    name: string;                    // Character name
    peopleType: 'Main Character' | 'Recurring' | 'Guest Star' | 'Voice';
    personName: string;              // Actor name
    image?: string;
    sort?: number;                   // Ordering
}

export interface TvdbTag {
    id: number;
    tag: number;
    tagName: string;                 // e.g., "Cyberpunk", "Time Travel"
    name?: string;                   // Alias
    helpText?: string;
}

export interface TvdbOfficialList {
    id: number;
    name: string;                    // e.g., "Arrowverse", "Breaking Bad Franchise"
    overview?: string;
    url?: string;
    isOfficial: boolean;
}

export interface TvdbContentRating {
    id: number;
    name: string;                    // e.g., "TV-MA", "TV-14"
    description?: string;
    country?: string;
    contentType?: string;
    order?: number;
    fullName?: string;               // e.g., "TV-MA-LSV"
}

export interface TvdbSeriesExtended {
    id: number;
    name: string;
    slug: string;
    status: { name: string };
    firstAired?: string;
    lastAired?: string;
    characters?: TvdbCharacter[];
    tags?: TvdbTag[];
    lists?: TvdbOfficialList[];
    contentRatings?: TvdbContentRating[];
    genres?: { name: string }[];
    originalLanguage?: string;
    defaultSeasonType?: number;
    // Anime absolute ordering support
    episodes?: TvdbEpisode[];
}

export interface TvdbEpisode {
    id: number;
    seriesId: number;
    name: string;
    seasonNumber: number;
    number: number;                  // Episode number within season
    absoluteNumber?: number;         // For anime
    runtime?: number;
    aired?: string;
    overview?: string;
}

export interface TvdbEnrichmentResult {
    characters: Array<{
        name: string;
        actorName: string;
        tier: 'Main' | 'Recurring' | 'Guest' | 'Voice';
        sortOrder?: number;
    }>;
    semanticTags: string[];          // Curated tags (Cyberpunk, Time Travel, etc.)
    officialLists: string[];         // Franchise names
    contentRating?: string;          // Most precise rating
    absoluteEpisodeCount?: number;   // For anime
}

// =============================================================================
// SESSION MANAGEMENT
// =============================================================================

const TVDB_BASE_URL = 'https://api4.thetvdb.com/v4';
const TOKEN_EXPIRY_MS = 29 * 24 * 60 * 60 * 1000; // 29 days (expires in 30)

// In-memory token cache (per-process)
let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Authenticate with TVDB and get a JWT token.
 * Tokens are valid for 30 days, we refresh after 29.
 */
export async function authenticate(apiKey: string, pin?: string): Promise<string> {
    // Check cache first
    if (cachedToken && Date.now() < cachedToken.expiresAt) {
        return cachedToken.token;
    }

    const response = await fetch(`${TVDB_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            apikey: apiKey,
            pin: pin || ''
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`TVDB login failed: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const token = data.data.token;

    // Cache the token
    cachedToken = {
        token,
        expiresAt: Date.now() + TOKEN_EXPIRY_MS
    };

    return token;
}

/**
 * Make an authenticated request to TVDB API.
 * Handles 401 by re-authenticating once.
 * Handles 429 rate limiting with exponential backoff.
 */
async function tvdbRequest<T>(
    endpoint: string,
    apiKey: string,
    pin?: string,
    retried = false,
    retryCount = 0
): Promise<T> {
    const token = await authenticate(apiKey, pin);

    const response = await fetch(`${TVDB_BASE_URL}${endpoint}`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
        }
    });

    // Handle 401 with retry
    if (response.status === 401 && !retried) {
        cachedToken = null; // Invalidate cache
        return tvdbRequest<T>(endpoint, apiKey, pin, true, retryCount);
    }

    // Handle 429 rate limiting with exponential backoff
    if (response.status === 429 && retryCount < 3) {
        const waitMs = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
        console.warn(`[TVDB] Rate limited. Waiting ${waitMs}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
        return tvdbRequest<T>(endpoint, apiKey, pin, retried, retryCount + 1);
    }

    if (!response.ok) {
        throw new Error(`TVDB API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.data as T;
}

// =============================================================================
// API METHODS
// =============================================================================

/**
 * Get extended series data including characters, tags, and lists.
 * This is the primary enrichment endpoint.
 */
export async function getSeriesExtended(
    tvdbId: number,
    apiKey: string,
    pin?: string
): Promise<TvdbSeriesExtended | null> {
    try {
        return await tvdbRequest<TvdbSeriesExtended>(
            `/series/${tvdbId}/extended`,
            apiKey,
            pin
        );
    } catch (error) {
        console.warn(`[TVDB] Failed to fetch series ${tvdbId}:`, error);
        return null;
    }
}

/**
 * Get episodes with specific season type ordering.
 * 
 * Season Types:
 * - default (1): Aired order
 * - absolute (2): For anime - continuous numbering
 * - dvd (3): DVD release order
 * - alternate (4): Alternate ordering
 */
export async function getSeriesEpisodes(
    tvdbId: number,
    seasonType: 'default' | 'absolute' | 'dvd' | 'alternate',
    apiKey: string,
    pin?: string
): Promise<TvdbEpisode[]> {
    const seasonTypeMap = {
        'default': 'default',
        'absolute': 'absolute',
        'dvd': 'dvd',
        'alternate': 'alternate'
    };

    try {
        const result = await tvdbRequest<{ episodes: TvdbEpisode[] }>(
            `/series/${tvdbId}/episodes/${seasonTypeMap[seasonType]}`,
            apiKey,
            pin
        );
        return result.episodes || [];
    } catch (error) {
        console.warn(`[TVDB] Failed to fetch episodes for ${tvdbId}:`, error);
        return [];
    }
}

// =============================================================================
// ENRICHMENT HELPERS
// =============================================================================
// NOTE: Pure utility functions (extractEnrichment, detectUniverseFromOfficialLists, isAnime)
// have been moved to tvdb-utils.ts to avoid 'use server' directive conflicts.
// Import them directly from '@/lib/services/tvdb-utils' instead.



/**
 * Get absolute episode count for anime shows.
 */
export async function getAbsoluteEpisodeCount(
    tvdbId: number,
    apiKey: string,
    pin?: string
): Promise<number> {
    const episodes = await getSeriesEpisodes(tvdbId, 'absolute', apiKey, pin);
    return episodes.length;
}

/**
 * Get full anime episode mapping (Season/Episode → Absolute).
 * Enables "Show me One Piece Episode 1000" style queries.
 * 
 * @returns Array of episode mappings with season, episode, and absolute numbers
 */
export async function getAnimeEpisodeMapping(
    tvdbId: number,
    apiKey: string,
    pin?: string
): Promise<Array<{
    seasonNumber: number;
    episodeNumber: number;
    absoluteNumber: number;
    name: string;
    aired?: string;
}>> {
    const episodes = await getSeriesEpisodes(tvdbId, 'absolute', apiKey, pin);

    return episodes
        .filter(ep => ep.absoluteNumber !== undefined)
        .map(ep => ({
            seasonNumber: ep.seasonNumber,
            episodeNumber: ep.number,
            absoluteNumber: ep.absoluteNumber!,
            name: ep.name,
            aired: ep.aired
        }))
        .sort((a, b) => a.absoluteNumber - b.absoluteNumber);
}

// =============================================================================
// CONNECTION TEST
// =============================================================================

/**
 * Test TVDB connection by authenticating.
 */
export async function testConnection(
    apiKey: string,
    pin?: string
): Promise<{ success: boolean; message: string }> {
    try {
        await authenticate(apiKey, pin);
        return { success: true, message: 'TVDB connection verified' };
    } catch (error) {
        return {
            success: false,
            message: error instanceof Error ? error.message : 'Connection failed'
        };
    }
}
