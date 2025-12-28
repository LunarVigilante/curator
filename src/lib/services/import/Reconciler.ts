import { MediaService } from '@/lib/services/media/mediaService'
import { SystemConfigService } from '@/lib/services/SystemConfigService'
import type { ParsedImportItem, ReconciledItem, MediaType } from '@/lib/types/import'

/**
 * Reconciler - Matches parsed items against external APIs to get metadata
 * 
 * Takes raw parsed items and attempts to match them with:
 * - TMDB (movies, TV)
 * - Jikan (anime)
 * - RAWG (games)
 * - Spotify (music)
 * - Google Books (books)
 */

// Match threshold - items below this score are marked as unmatched
const MATCH_THRESHOLD = 0.6

/**
 * Reconcile a list of parsed items with external APIs
 */
export async function reconcileItems(
    rawList: ParsedImportItem[],
    mediaType: MediaType
): Promise<ReconciledItem[]> {
    const mediaService = new MediaService()
    const settings = await SystemConfigService.getRawConfigMap()
    const results: ReconciledItem[] = []

    for (const item of rawList) {
        try {
            // Build search query
            const searchQuery = buildSearchQuery(item)

            // Map media type to category hint for MediaService
            const categoryHint = mapMediaTypeToCategoryHint(mediaType, item.mediaType)

            // Search using appropriate strategy
            const searchResults = await mediaService.search(
                searchQuery,
                categoryHint,
                settings
            )

            if (!searchResults.success || searchResults.data.length === 0) {
                // No match found - keep raw data
                results.push({
                    ...item,
                    matched: false,
                    matchScore: 0
                })
                continue
            }

            // Find best match using fuzzy scoring
            const bestMatch = findBestMatch(item, searchResults.data)

            // Apply match if confidence is high enough
            if (bestMatch.score >= MATCH_THRESHOLD) {
                results.push({
                    ...item,
                    externalId: bestMatch.result.id,
                    imageUrl: bestMatch.result.imageUrl,
                    description: bestMatch.result.description,
                    releaseYear: bestMatch.result.year || item.releaseYear,
                    matched: true,
                    matchScore: bestMatch.score
                })
            } else {
                results.push({
                    ...item,
                    matched: false,
                    matchScore: bestMatch.score
                })
            }
        } catch (error) {
            console.error(`[Reconciler] Error matching "${item.title}":`, error)
            results.push({
                ...item,
                matched: false,
                matchScore: 0
            })
        }
    }

    return results
}

/**
 * Build optimal search query from parsed item
 */
function buildSearchQuery(item: ParsedImportItem): string {
    let query = item.title

    // Add year for disambiguation on movies/TV
    if (item.releaseYear && !item.artist) {
        query += ` ${item.releaseYear}`
    }

    return query
}

/**
 * Map our media type to a category hint for MediaService
 */
function mapMediaTypeToCategoryHint(listType: MediaType, itemType?: MediaType): string {
    const type = itemType || listType

    switch (type) {
        case 'movie':
        case 'tv':
            return 'movie'  // TMDB handles both
        case 'anime':
            return 'anime'
        case 'music':
            return 'music'
        case 'book':
            return 'book'
        case 'game':
            return 'game'
        default:
            return 'movie' // Default to TMDB
    }
}

/**
 * Find the best match from search results using fuzzy matching
 */
function findBestMatch(
    item: ParsedImportItem,
    candidates: any[]
): { result: any; score: number } {
    if (candidates.length === 0) {
        return { result: null, score: 0 }
    }

    let bestMatch = candidates[0]
    let bestScore = 0

    const normalizedItemTitle = normalize(item.title)

    for (const candidate of candidates) {
        let score = 0

        // Title similarity (main weight)
        const candidateTitle = candidate.title || candidate.name || ''
        const titleSimilarity = stringSimilarity(
            normalizedItemTitle,
            normalize(candidateTitle)
        )
        score += titleSimilarity * 0.6  // 60% weight

        // Year match bonus
        const candidateYear = candidate.year || candidate.releaseYear || candidate.firstAirDate?.split('-')[0]
        if (item.releaseYear && candidateYear &&
            Number(candidateYear) === item.releaseYear) {
            score += 0.3  // 30% bonus
        }

        // Boost if it's the first result (API relevance)
        if (candidates.indexOf(candidate) === 0) {
            score += 0.1  // 10% bonus for API ranking
        }

        if (score > bestScore) {
            bestScore = score
            bestMatch = candidate
        }
    }

    return { result: bestMatch, score: bestScore }
}

/**
 * Normalize string for comparison
 */
function normalize(str: string): string {
    return str
        .toLowerCase()
        .replace(/[^\w\s]/g, '')   // Remove punctuation
        .replace(/\s+/g, ' ')      // Normalize whitespace
        .trim()
}

/**
 * Simple string similarity using Dice coefficient
 */
function stringSimilarity(a: string, b: string): number {
    if (a === b) return 1
    if (a.length === 0 || b.length === 0) return 0

    // Check if one contains the other
    if (a.includes(b) || b.includes(a)) {
        return 0.9
    }

    // Bigram-based Dice coefficient
    const bigramsA = getBigrams(a)
    const bigramsB = getBigrams(b)

    let intersection = 0
    for (const bigram of bigramsA) {
        if (bigramsB.has(bigram)) {
            intersection++
        }
    }

    return (2 * intersection) / (bigramsA.size + bigramsB.size)
}

/**
 * Get bigrams (2-character substrings) from a string
 */
function getBigrams(str: string): Set<string> {
    const bigrams = new Set<string>()
    for (let i = 0; i < str.length - 1; i++) {
        bigrams.add(str.slice(i, i + 2))
    }
    return bigrams
}
