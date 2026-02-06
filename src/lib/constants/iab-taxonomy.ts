/**
 * IAB Content Taxonomy 3.0 - Unscripted TV Facets
 * 
 * Used for classifying reality TV, documentaries, and other unscripted content
 * that doesn't fit narrative structures like Save the Cat.
 * 
 * @see https://iabtechlab.com/standards/content-taxonomy/
 */

/**
 * Primary unscripted format categories
 */
export const IAB_UNSCRIPTED_FACETS = {
    /** Competition-based reality with elimination/scoring mechanics */
    COMPETITION: {
        keywords: [
            'competition', 'elimination', 'contestant', 'challenge', 'immunity',
            'voting', 'prize', 'winner', 'judges', 'audition', 'talent show',
            'game show', 'dating show', 'cooking competition', 'survival competition',
        ],
        genres: [10764], // Reality genre ID
        examples: ['Survivor', 'The Voice', 'Top Chef', 'The Bachelor'],
    },

    /** Lifestyle/relationship-focused unscripted drama */
    DOCUSOAP: {
        keywords: [
            'reality drama', 'lifestyle', 'celebrity', 'interpersonal', 'drama',
            'wealth', 'luxury', 'housewives', 'family dynamics', 'relationship drama',
            'real-life', 'unscripted drama', 'makeover', 'transformation',
        ],
        genres: [10764],
        examples: ['Real Housewives', 'Keeping Up with the Kardashians', 'The Hills'],
    },

    /** Social experiments and observational formats */
    SOCIAL_EXPERIMENT: {
        keywords: [
            'social experiment', 'hidden camera', 'prank', 'undercover',
            'swap', 'immersion', 'experiment', 'test', 'observation',
        ],
        genres: [10764],
        examples: ['Undercover Boss', 'Wife Swap', 'The Circle'],
    },

    /** Educational/informational documentary series */
    DOCUSERIES: {
        keywords: [
            'documentary', 'true crime', 'historical', 'nature', 'wildlife',
            'sports documentary', 'archival footage', 'narrator', 'investigation',
            'expose', 'behind the scenes', 'making of', 'educational',
        ],
        genres: [99], // Documentary genre ID
        examples: ['Planet Earth', 'Making a Murderer', 'The Last Dance'],
    },

    /** News and talk formats */
    NEWS_TALK: {
        keywords: [
            'talk show', 'interview', 'news', 'current events', 'panel',
            'debate', 'late night', 'morning show', 'variety',
        ],
        genres: [10763, 10767], // News, Talk
        examples: ['The Tonight Show', 'Good Morning America', '60 Minutes'],
    },

    /** Home/lifestyle improvement shows */
    HOME_LIFESTYLE: {
        keywords: [
            'home improvement', 'renovation', 'real estate', 'house hunting',
            'interior design', 'cooking show', 'travel', 'automotive',
            'DIY', 'gardening', 'crafts',
        ],
        genres: [10764],
        examples: ['Fixer Upper', 'House Hunters', 'Queer Eye'],
    },
} as const;

export type IABFacetType = keyof typeof IAB_UNSCRIPTED_FACETS;

/**
 * Detect IAB facets for unscripted content
 * 
 * @param genres - Array of genre names or IDs
 * @param keywords - Array of TMDB keywords
 * @returns Detected IAB facet types
 */
export function detectIABFacets(
    genres: (string | number)[],
    keywords: string[]
): IABFacetType[] {
    const detected: IABFacetType[] = [];
    const keywordsLower = keywords.map(k => k.toLowerCase());
    const genreIds = genres.filter((g): g is number => typeof g === 'number');

    for (const [facetName, facet] of Object.entries(IAB_UNSCRIPTED_FACETS)) {
        // Check genre match
        const hasGenre = facet.genres.some(g => genreIds.includes(g));

        // Check keyword match (at least 2 keyword matches for confidence)
        const keywordMatches = facet.keywords.filter(kw =>
            keywordsLower.some(k => k.includes(kw) || kw.includes(k))
        );

        if (hasGenre && keywordMatches.length >= 1) {
            detected.push(facetName as IABFacetType);
        } else if (keywordMatches.length >= 2) {
            detected.push(facetName as IABFacetType);
        }
    }

    return detected;
}

/**
 * Get primary IAB facet for a show
 * Returns the most specific/confident facet
 */
export function getPrimaryIABFacet(
    genres: (string | number)[],
    keywords: string[]
): IABFacetType | null {
    const facets = detectIABFacets(genres, keywords);

    // Priority order: more specific facets first
    const priority: IABFacetType[] = [
        'COMPETITION',
        'SOCIAL_EXPERIMENT',
        'DOCUSERIES',
        'DOCUSOAP',
        'HOME_LIFESTYLE',
        'NEWS_TALK',
    ];

    for (const facet of priority) {
        if (facets.includes(facet)) {
            return facet;
        }
    }

    return facets[0] || null;
}
