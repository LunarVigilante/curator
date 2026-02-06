/**
 * OMDb Types
 * 
 * Type definitions for OMDb API responses
 */

export interface OmdbData {
    imdb_rating: number | null;
    imdb_votes: number | null;
    rotten_tomatoes_rating: number | null;
    metacritic_rating: number | null;
    awards: string | null;
    rated: string | null;
    writer: string | null;
    box_office: string | null;
}
