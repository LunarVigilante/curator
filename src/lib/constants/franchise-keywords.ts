/**
 * TMDB Keyword ID → Universe Slug Mapping
 * 
 * Maps known TMDB keyword IDs to tv_universes slugs for automatic
 * universe detection during TV show harvesting.
 * 
 * To find keyword IDs:
 * - TMDB UI: Search for a show → Keywords section
 * - API: GET /tv/{id}?append_to_response=keywords
 */

/**
 * Maps TMDB keyword IDs to tv_universes.slug values
 */
export const UNIVERSE_KEYWORD_MAP: Record<number, string> = {
    // DC Comics
    229266: 'arrowverse',           // "arrowverse" keyword

    // Star Trek
    180547: 'star-trek',            // "star trek" keyword

    // Walking Dead
    1402: 'walking-dead',           // "the walking dead" keyword

    // Yellowstone (Taylor Sheridan)
    268686: 'yellowstone-verse',    // "yellowstone" keyword

    // Law & Order (Dick Wolf)
    951: 'law-order-universe',      // "law & order" keyword

    // NCIS
    4330: 'ncis-verse',             // "ncis" keyword

    // Chicago (Dick Wolf)
    228091: 'chicago-verse',        // "chicago franchise" keyword

    // Game of Thrones / ASOIAF
    14909: 'game-of-thrones',       // "based on george r. r. martin book"

    // Breaking Bad
    234689: 'breaking-bad',         // "breaking bad universe"

    // Grey's Anatomy
    212271: 'greys-verse',          // "grey's anatomy"
};

/**
 * High-priority creators to trigger graph analysis
 * When a show has one of these creators, run full cluster detection
 */
export const PROLIFIC_SHOWRUNNERS: Record<string, string[]> = {
    'Taylor Sheridan': ['yellowstone-verse'],
    'Dick Wolf': ['chicago-verse', 'law-order-universe'],
    'Greg Berlanti': ['arrowverse'],
    'David Simon': [],  // Shared creator but distinct narratives (The Wire, Treme)
    'Vince Gilligan': ['breaking-bad'],
    'Shonda Rhimes': ['greys-verse'],
    'Ryan Murphy': [],  // Many shows but not connected universes
};

/**
 * Known parent-child spinoff relationships (TMDB ID pairs)
 * Format: [spinoff_tmdb_id, parent_tmdb_id]
 */
export const KNOWN_SPINOFFS: [number, number][] = [
    // Breaking Bad Universe
    [60059, 1396],      // Better Call Saul (60059) is spinoff of Breaking Bad (1396)

    // Walking Dead Universe
    [62286, 1402],      // Fear the Walking Dead (62286) from TWD (1402)
    [95557, 1402],      // World Beyond (95557) from TWD
    [206584, 1402],     // Dead City (206584) from TWD
    [194583, 1402],     // Daryl Dixon (194583) from TWD

    // Star Trek
    [67198, 253],       // Discovery (67198) inherits from TOS era
    [85949, 67198],     // Strange New Worlds (85949) from Discovery
    [85948, 67198],     // Picard (85948) from TNG/Discovery era
    [105971, 67198],    // Lower Decks (105971) from modern Trek
    [106393, 67198],    // Prodigy (106393) from modern Trek

    // Arrowverse
    [60735, 1412],      // The Flash (60735) from Arrow (1412)
    [62688, 1412],      // Supergirl (62688) connected via crossovers
    [62643, 60735],     // Legends of Tomorrow (62643) from Flash
    [89247, 60735],     // Batwoman (89247) from Arrowverse

    // Chicago Franchise
    [67993, 58841],     // Chicago Med (67993) from Chicago Fire (58841)
    [62439, 58841],     // Chicago PD (62439) from Chicago Fire

    // Game of Thrones
    [94997, 1399],      // House of the Dragon (94997) from GOT (1399)
    [229214, 1399],     // Knight of the Seven Kingdoms from GOT

    // Yellowstone
    [112470, 73586],    // 1883 (112470) from Yellowstone (73586)
    [195851, 73586],    // 1923 (195851) from Yellowstone

    // NCIS
    [17610, 4614],      // NCIS: Los Angeles (17610) from NCIS (4614)
    [61391, 4614],      // NCIS: New Orleans (61391) from NCIS
    [100178, 4614],     // NCIS: Hawai'i (100178) from NCIS
    [230543, 4614],     // NCIS: Sydney (230543) from NCIS
    [239770, 4614],     // NCIS: Origins (239770) from NCIS
];

/**
 * Get universe slug for a TMDB keyword ID
 */
export function getUniverseSlugFromKeyword(keywordId: number): string | undefined {
    return UNIVERSE_KEYWORD_MAP[keywordId];
}

/**
 * Check if a list of keywords matches any known universe
 */
export function detectUniverseFromKeywords(
    keywordIds: number[]
): { slug: string; keywordId: number } | undefined {
    for (const keywordId of keywordIds) {
        const slug = UNIVERSE_KEYWORD_MAP[keywordId];
        if (slug) {
            return { slug, keywordId };
        }
    }
    return undefined;
}
