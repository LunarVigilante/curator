/**
 * TVDB Utility Functions
 * 
 * Pure utility functions for TVDB data processing.
 * Separated from tvdb.ts to avoid 'use server' directive conflicts.
 */

import type { TvdbSeriesExtended, TvdbEnrichmentResult } from './tvdb';

/**
 * Extract enrichment data from TVDB extended series response.
 * This is the main function used by the harvester.
 */
export function extractEnrichment(series: TvdbSeriesExtended): TvdbEnrichmentResult {
    // Map character tiers
    const characters = (series.characters || [])
        .filter(c => c.personName) // Only named actors
        .map(c => {
            let tier: 'Main' | 'Recurring' | 'Guest' | 'Voice' = 'Guest';
            if (c.peopleType === 'Main Character') tier = 'Main';
            else if (c.peopleType === 'Recurring') tier = 'Recurring';
            else if (c.peopleType === 'Voice') tier = 'Voice';

            return {
                name: c.name || 'Unknown',  // Fallback when TVDB lacks character name
                actorName: c.personName,
                tier,
                sortOrder: c.sort
            };
        })
        .sort((a, b) => (a.sortOrder || 999) - (b.sortOrder || 999));

    // Extract semantic tags
    const semanticTags = (series.tags || [])
        .map(t => t.tagName || t.name)
        .filter((t): t is string => !!t);

    // Extract official list names (franchise associations)
    const officialLists = (series.lists || [])
        .filter(l => l.isOfficial)
        .map(l => l.name);

    // Find best content rating (prefer US)
    let contentRating: string | undefined;
    const ratings = series.contentRatings || [];
    const usRating = ratings.find(r => r.country === 'usa' || r.country === 'us');
    contentRating = usRating?.fullName || usRating?.name || ratings[0]?.name;

    return {
        characters,
        semanticTags,
        officialLists,
        contentRating
    };
}

/**
 * Detect potential universe/franchise from TVDB official lists.
 * Human-curated lists like "Arrowverse", "Breaking Bad Franchise" are highly accurate.
 * 
 * @returns Slug-friendly name if a franchise/universe is detected, null otherwise
 */
export function detectUniverseFromOfficialLists(officialLists: string[]): string | null {
    const franchisePatterns = /\b(universe|saga|franchise|collection|cinematic|expanded)\b/i;

    for (const listName of officialLists) {
        if (franchisePatterns.test(listName)) {
            // Convert to slug: "Breaking Bad Franchise" → "breaking-bad-franchise"
            const slug = listName
                .toLowerCase()
                .replace(/[^a-z0-9\s-]/g, '')
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-')
                .trim();
            return slug;
        }
    }

    return null;
}

/**
 * Check if a show is anime based on genres.
 */
export function isAnime(series: TvdbSeriesExtended): boolean {
    const genres = series.genres?.map(g => g.name.toLowerCase()) || [];
    return genres.includes('anime') || genres.includes('animation');
}
