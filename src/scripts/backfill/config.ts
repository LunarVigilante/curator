/**
 * Backfill Script Types and Configuration
 */

export const BATCH_SIZE = 50;
export const DELAY_BETWEEN_ITEMS = 100; // ms

export const VALID_CATEGORIES = [
    'ANIME', 'MOVIE', 'TV_SHOW', 'VIDEO_GAME', 'BOARD_GAME', 'BOOK',
    'MANGA', 'LIGHT_NOVEL', 'MUSIC_ARTIST', 'MUSIC_ALBUM', 'MUSIC_TRACK', 'PODCAST', 'COMICS'
] as const;

export type Category = typeof VALID_CATEGORIES[number];

export type Phase = 'metadata' | 'descriptions' | 'tags' | 'embeddings' | 'full' | 'smart' | 'rehydrate' | 'all';

export const VALID_PHASES: Phase[] = ['metadata', 'descriptions', 'tags', 'embeddings', 'full', 'smart', 'rehydrate', 'all'];

export interface CLIOptions {
    category: string;
    limit?: number;
    phase: Phase;
    dryRun: boolean;
    force: boolean;
    // Rehydrate-specific options
    status?: string;           // Filter by status for rehydrate
    detectNewSeasons?: boolean; // Only items with season count mismatch
    staleOnly?: boolean;       // Only items past staleness threshold
}

export interface PhaseStats {
    processed: number;
    updated: number;
    skipped: number;
    failed: number;
}

export function createStats(): PhaseStats {
    return { processed: 0, updated: 0, skipped: 0, failed: 0 };
}

// Define required metadata fields per category
export const REQUIRED_METADATA_FIELDS: Record<string, string[]> = {
    MOVIE: ['release_year', 'director', 'cast', 'runtime', 'genres', 'vote_average'],
    TV_SHOW: ['release_year', 'genres', 'cast', 'vote_average'],
    ANIME: ['release_year', 'genres', 'studio', 'vote_average'],
    VIDEO_GAME: ['release_year', 'genres', 'platforms', 'developers'],
    BOARD_GAME: ['release_year', 'designers', 'mechanics', 'categories'],
    BOOK: ['release_year', 'author', 'genres', 'page_count'],
    MANGA: ['release_year', 'genres', 'status'],
    LIGHT_NOVEL: ['release_year', 'genres', 'status'],
    MUSIC_ALBUM: ['release_year', 'genres', 'artist'],
    MUSIC_ARTIST: ['genres'],
    PODCAST: ['release_year', 'genres', 'publisher'],
    COMICS: ['release_year', 'genres', 'publisher'],
    MUSIC_TRACK: ['release_year', 'artist', 'album']
};
