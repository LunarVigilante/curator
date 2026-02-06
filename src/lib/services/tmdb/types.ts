/**
 * TMDB Types
 * 
 * Shared type definitions for TMDB API operations
 */

export interface TmdbHarvestOptions {
    type: 'movie' | 'tv';
    operation: 'harvest' | 'backfill';
    startYear?: number;      // For harvest: start year (default: current year)
    endYear?: number;        // For harvest: end year (default: 1970)
    maxPages?: number;       // For harvest: max pages per year (default: 100)
    limit?: number;          // For backfill: max items to process
    dryRun?: boolean;        // Preview without writing
}

export interface TriageItem {
    id: string;
    isComplete: boolean;
}

export interface TmdbMetadata {
    title: string;
    original_title: string;
    overview: string;
    tagline: string | null;
    release_date: string;
    release_year: number;
    status: string;
    homepage: string;
    poster_path: string | null;
    backdrop_path: string | null;
    logo_path: string | null;
    trailer_url: string | null;
    popularity: number;
    vote_average: number;
    vote_count: number;
    budget: number;
    revenue: number;
    runtime: number;
    content_rating: string | null;
    writer: string | null;
    genres: string[];
    keywords: string[];
    original_language: string;
    origin_countries: string[];
    spoken_languages: string[];
    cast: string[];
    director: string | null;
    studio: string | null;
    production_companies: string[];
    networks: string[];
    number_of_seasons: number | null;
    number_of_episodes: number | null;
    external_ids: Record<string, any>;
    watch_providers: any;
    metadata: {
        created_by: string[];
        episode_run_time: number[];
        type: string | null;         // TV: "Miniseries", "Documentary", etc.
        first_air_date: string | null;
        last_air_date: string | null;
    };
}

export interface TmdbDiscoverResult {
    page: number;
    results: Array<{ id: number;[key: string]: any }>;
    total_pages: number;
    total_results: number;
}

export interface TmdbAggregateCredit {
    personId: number;
    name: string;
    role: string;
    department: string;
    episodeCount: number;
}
