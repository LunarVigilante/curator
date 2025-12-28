/**
 * Typed metadata schemas for different media types.
 * Replaces the "black box" `any` type with strict Zod validation.
 */

import { z } from 'zod'

// =============================================================================
// TMDB METADATA (Movies & TV)
// =============================================================================

export const TmdbMetadataSchema = z.object({
    media_type: z.enum(['movie', 'tv']),
    original_title: z.string().optional(),
    popularity: z.number().optional()
})

export type TmdbMetadata = z.infer<typeof TmdbMetadataSchema>

// =============================================================================
// RAWG METADATA (Video Games)
// =============================================================================

export const RawgMetadataSchema = z.object({
    platforms: z.string().optional(), // Comma-separated string
    metacritic: z.number().nullable().optional()
})

export type RawgMetadata = z.infer<typeof RawgMetadataSchema>

// =============================================================================
// JIKAN METADATA (Anime)
// =============================================================================

export const JikanMetadataSchema = z.object({
    type: z.string().optional(), // "TV", "Movie", "OVA", etc.
    episodes: z.number().nullable().optional(),
    score: z.number().nullable().optional()
})

export type JikanMetadata = z.infer<typeof JikanMetadataSchema>

// =============================================================================
// GOOGLE BOOKS METADATA (Books)
// =============================================================================

export const GoogleBooksMetadataSchema = z.object({
    authors: z.string().optional(), // Comma-separated string
    publisher: z.string().optional(),
    pageCount: z.number().optional()
})

export type GoogleBooksMetadata = z.infer<typeof GoogleBooksMetadataSchema>

// =============================================================================
// SPOTIFY METADATA (Music/Artists)
// =============================================================================

export const SpotifyMetadataSchema = z.object({
    followers: z.number().optional(),
    url: z.string().url().optional(),
    type: z.literal('artist').optional()
})

export type SpotifyMetadata = z.infer<typeof SpotifyMetadataSchema>

// =============================================================================
// ITUNES PODCAST METADATA
// =============================================================================

export const ItunesPodcastMetadataSchema = z.object({
    artist: z.string().optional(),
    genre: z.string().optional(),
    episodes: z.number().optional()
})

export type ItunesPodcastMetadata = z.infer<typeof ItunesPodcastMetadataSchema>

// =============================================================================
// BASE/COMMON ITEM METADATA (used when creating items)
// =============================================================================

export const ItemMetadataSchema = z.object({
    externalId: z.string().optional(),
    year: z.string().optional(),
    type: z.string().optional()
})

export type ItemMetadata = z.infer<typeof ItemMetadataSchema>

// =============================================================================
// UNION TYPE FOR ALL MEDIA METADATA
// =============================================================================

/**
 * Discriminated union of all possible metadata types.
 * Use `source` field to discriminate.
 */
export const MediaMetadataSchema = z.discriminatedUnion('source', [
    TmdbMetadataSchema.extend({ source: z.literal('tmdb') }),
    RawgMetadataSchema.extend({ source: z.literal('rawg') }),
    JikanMetadataSchema.extend({ source: z.literal('jikan') }),
    GoogleBooksMetadataSchema.extend({ source: z.literal('googlebooks') }),
    SpotifyMetadataSchema.extend({ source: z.literal('spotify') }),
    ItunesPodcastMetadataSchema.extend({ source: z.literal('itunes') }),
])

export type MediaMetadata = z.infer<typeof MediaMetadataSchema>

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Safely parse metadata JSON string.
 * Returns typed object or null if parsing/validation fails.
 */
export function parseMetadata<T extends z.ZodTypeAny>(
    jsonString: string | null | undefined,
    schema: T
): z.infer<T> | null {
    if (!jsonString) return null

    try {
        const parsed = JSON.parse(jsonString)
        const result = schema.safeParse(parsed)

        if (result.success) {
            return result.data
        } else {
            console.warn('Metadata validation failed:', result.error.issues)
            return null
        }
    } catch (e) {
        console.warn('Metadata JSON parse failed:', e)
        return null
    }
}

/**
 * Safely parse metadata without a specific schema.
 * Falls back to a permissive object type.
 */
export function parseMetadataLoose(jsonString: string | null | undefined): Record<string, unknown> | null {
    if (!jsonString) return null

    try {
        const parsed = JSON.parse(jsonString)
        return typeof parsed === 'object' && parsed !== null ? parsed : null
    } catch (e) {
        return null
    }
}

/**
 * Parse item-level metadata (externalId, year, type).
 * Used when parsing item form data.
 */
export function parseItemMetadata(jsonString: string | null | undefined): ItemMetadata | null {
    return parseMetadata(jsonString, ItemMetadataSchema)
}
