// ============================================================================
// MAGIC IMPORT TYPES
// ============================================================================

import { z } from 'zod'

// ============================================================================
// SOURCE TYPES
// ============================================================================

export type ImportSourceType =
    | 'spotify_playlist'
    | 'letterboxd_list'
    | 'imdb_list'
    | 'anilist'
    | 'goodreads_shelf'
    | 'unstructured_text'
    | 'unknown'

export type MediaType = 'movie' | 'tv' | 'music' | 'book' | 'game' | 'anime' | 'mixed'

// ============================================================================
// PARSED ITEM INTERFACES
// ============================================================================

export interface ParsedImportItem {
    title: string
    artist?: string           // Music
    director?: string         // Film/TV
    author?: string           // Books
    studio?: string           // Anime
    releaseYear?: number
    rank?: number             // Position in list (1-indexed)
    mediaType?: MediaType
    confidence: number        // 0-1 parse confidence
    rawInput?: string         // Original text for debugging
}

export interface ParsedImport {
    source: ImportSourceType
    collectionTitle: string
    collectionDescription?: string
    items: ParsedImportItem[]
    mediaType: MediaType
    parseConfidence: number
    warnings?: string[]
}

// ============================================================================
// RECONCILED ITEM (After matching with external APIs)
// ============================================================================

export interface ReconciledItem extends ParsedImportItem {
    externalId?: string       // TMDB/Spotify/RAWG ID
    imageUrl?: string
    description?: string
    matchScore: number        // 0-1 match confidence
    matched: boolean
}

// ============================================================================
// IMPORT RESULT
// ============================================================================

export interface ImportResult {
    success: boolean
    categoryId?: string
    categoryName?: string
    itemsCreated: number
    itemsSkipped: number
    warnings: string[]
    items: ReconciledItem[]
}

// ============================================================================
// IMPORT STRATEGY INTERFACE
// ============================================================================

export interface ImportStrategy {
    name: string
    canHandle(input: string): boolean
    parse(input: string): Promise<ParsedImport>
}

// ============================================================================
// ZOD SCHEMAS FOR LLM PARSING
// ============================================================================

export const LLMParsedItemSchema = z.object({
    title: z.string(),
    director: z.string().optional(),
    artist: z.string().optional(),
    author: z.string().optional(),
    studio: z.string().optional(),
    releaseYear: z.number().optional(),
    rank: z.number()
})

export const LLMParseResultSchema = z.object({
    collectionTitle: z.string(),
    collectionDescription: z.string().optional(),
    mediaType: z.enum(['movie', 'tv', 'anime', 'music', 'book', 'game', 'mixed']),
    items: z.array(LLMParsedItemSchema),
    confidence: z.number().min(0).max(1)
})

export type LLMParseResult = z.infer<typeof LLMParseResultSchema>

// ============================================================================
// LLM SYSTEM PROMPT
// ============================================================================

export const LLM_IMPORT_SYSTEM_PROMPT = `You are a Media List Parser. Your job is to extract structured data from messy, human-written text about movies, TV shows, music, books, games, or anime.

## RULES:
1. **Extract ONLY media items** - Ignore commentary, opinions, ratings, or notes
2. **Infer collection title** - If not explicit, generate a descriptive title from context
3. **Preserve ranking order** - If items are numbered or clearly ordered, maintain that order
4. **Strip annotations** - Remove parenthetical comments like "(great movie)" or "(must watch)"
5. **Parse years when present** - Extract release year from formats like "Movie (2008)" or "2008's Movie"
6. **Identify media type** - Detect if list is Movies, TV, Anime, Music, Books, or Games
7. **Handle messy formatting** - Bullet points, numbered lists, comma-separated, or freeform text
8. **Be generous with parsing** - Try to extract as much as possible, even from very messy input

## OUTPUT FORMAT:
Return ONLY valid JSON matching this schema:
{
  "collectionTitle": "string - inferred or explicit title",
  "collectionDescription": "optional brief description",
  "mediaType": "movie" | "tv" | "anime" | "music" | "book" | "game" | "mixed",
  "items": [
    {
      "title": "Clean title without annotations",
      "director": "For films (optional)",
      "artist": "For music (optional)", 
      "author": "For books (optional)",
      "studio": "For anime (optional)",
      "releaseYear": 2008,
      "rank": 1
    }
  ],
  "confidence": 0.95
}

## EXAMPLES:

Input: "My top 5 sci-fi
1. Blade Runner 2049 - absolute masterpiece
2. Arrival (2016)
3. Interstellar
4. Dune
5. The Matrix"

Output:
{
  "collectionTitle": "My Top 5 Sci-Fi",
  "mediaType": "movie",
  "items": [
    { "title": "Blade Runner 2049", "releaseYear": 2017, "director": "Denis Villeneuve", "rank": 1 },
    { "title": "Arrival", "releaseYear": 2016, "director": "Denis Villeneuve", "rank": 2 },
    { "title": "Interstellar", "releaseYear": 2014, "director": "Christopher Nolan", "rank": 3 },
    { "title": "Dune", "releaseYear": 2021, "director": "Denis Villeneuve", "rank": 4 },
    { "title": "The Matrix", "releaseYear": 1999, "director": "Wachowskis", "rank": 5 }
  ],
  "confidence": 0.95
}

Input: "vibes rn: Frank Ocean, The Weeknd, SZA, tyler"

Output:
{
  "collectionTitle": "Current Vibes",
  "mediaType": "music",
  "items": [
    { "title": "Frank Ocean", "artist": "Frank Ocean", "rank": 1 },
    { "title": "The Weeknd", "artist": "The Weeknd", "rank": 2 },
    { "title": "SZA", "artist": "SZA", "rank": 3 },
    { "title": "Tyler, the Creator", "artist": "Tyler, the Creator", "rank": 4 }
  ],
  "confidence": 0.85
}

Input: "best anime ever made: fmab, aot, death note, steins gate 🔥"

Output:
{
  "collectionTitle": "Best Anime Ever Made",
  "mediaType": "anime",
  "items": [
    { "title": "Fullmetal Alchemist: Brotherhood", "studio": "Bones", "releaseYear": 2009, "rank": 1 },
    { "title": "Attack on Titan", "studio": "Wit Studio", "releaseYear": 2013, "rank": 2 },
    { "title": "Death Note", "studio": "Madhouse", "releaseYear": 2006, "rank": 3 },
    { "title": "Steins;Gate", "studio": "White Fox", "releaseYear": 2011, "rank": 4 }
  ],
  "confidence": 0.9
}`

// ============================================================================
// URL PATTERNS
// ============================================================================

export const URL_PATTERNS = {
    SPOTIFY_PLAYLIST: /spotify\.com\/playlist\//i,
    LETTERBOXD_LIST: /letterboxd\.com\/(.*?)\/list\//i,
    LETTERBOXD_WATCHLIST: /letterboxd\.com\/(.*?)\/watchlist/i,
    IMDB_LIST: /imdb\.com\/list\//i,
    ANILIST: /anilist\.co\/(user\/.*?\/(animelist|mangalist)|.*?\/list)/i,
    GOODREADS_SHELF: /goodreads\.com\/(.*?)\/(shelf|list)/i,
} as const

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function detectImportSource(input: string): ImportSourceType {
    const trimmed = input.trim()

    // Try to parse as URL first
    try {
        new URL(trimmed)

        // Check known URL patterns
        if (URL_PATTERNS.SPOTIFY_PLAYLIST.test(trimmed)) return 'spotify_playlist'
        if (URL_PATTERNS.LETTERBOXD_LIST.test(trimmed) || URL_PATTERNS.LETTERBOXD_WATCHLIST.test(trimmed)) return 'letterboxd_list'
        if (URL_PATTERNS.IMDB_LIST.test(trimmed)) return 'imdb_list'
        if (URL_PATTERNS.ANILIST.test(trimmed)) return 'anilist'
        if (URL_PATTERNS.GOODREADS_SHELF.test(trimmed)) return 'goodreads_shelf'

        // Unknown URL type
        return 'unknown'
    } catch {
        // Not a valid URL, treat as unstructured text
        return 'unstructured_text'
    }
}

export function isUrl(input: string): boolean {
    try {
        new URL(input.trim())
        return true
    } catch {
        return false
    }
}
