/**
 * Shared Universe Detection System
 * 
 * Detects when a TV show belongs to a shared narrative universe
 * (e.g., Arrowverse, Chicago-verse, Breaking Bad universe).
 * 
 * Uses a combination of:
 * 1. Hardcoded known universe mappings (fast, guaranteed accuracy)
 * 2. LLM-based detection for spinoffs and connected shows
 */

import { callLLM } from '@/lib/llm';

// ============================================================================
// KNOWN UNIVERSE MAPPINGS (Guaranteed accuracy)
// ============================================================================

/**
 * Universe definition with member shows and detection patterns
 */
interface UniverseDefinition {
    slug: string;
    name: string;
    /** Exact title matches (case-insensitive) */
    exactTitles: string[];
    /** Partial title patterns (shows starting with these) */
    titlePatterns: string[];
    /** Network indicators (if show from this network matches patterns) */
    networkHints: string[];
    /** Keywords that strongly indicate this universe */
    keywordHints: string[];
}

/**
 * Known shared universes with their member shows
 * Add new universes here for guaranteed detection
 */
export const KNOWN_UNIVERSES: readonly UniverseDefinition[] = [
    {
        slug: 'arrowverse',
        name: 'Arrowverse',
        exactTitles: [
            'Arrow', 'The Flash', 'Supergirl', 'Legends of Tomorrow',
            'Batwoman', 'Black Lightning', 'Superman & Lois', 'Stargirl'
        ],
        titlePatterns: [],
        networkHints: ['The CW'],
        keywordHints: ['arrowverse', 'dc universe', 'crisis on infinite earths']
    },
    {
        slug: 'chicago-verse',
        name: 'Chicago Franchise',
        exactTitles: ['Chicago Fire', 'Chicago P.D.', 'Chicago Med', 'Chicago Justice'],
        titlePatterns: ['Chicago'],
        networkHints: ['NBC'],
        keywordHints: ['dick wolf', 'chicago franchise']
    },
    {
        slug: 'law-order-universe',
        name: 'Law & Order Universe',
        exactTitles: [
            'Law & Order', 'Law & Order: Special Victims Unit', 'Law & Order: SVU',
            'Law & Order: Criminal Intent', 'Law & Order: Organized Crime',
            'Law & Order: LA', 'Law & Order: UK', 'Law & Order: Trial by Jury'
        ],
        titlePatterns: ['Law & Order', 'Law and Order'],
        networkHints: ['NBC'],
        keywordHints: ['dick wolf', 'law and order']
    },
    {
        slug: 'star-trek',
        name: 'Star Trek Universe',
        exactTitles: [
            'Star Trek', 'Star Trek: The Next Generation', 'Star Trek: Deep Space Nine',
            'Star Trek: Voyager', 'Star Trek: Enterprise', 'Star Trek: Discovery',
            'Star Trek: Picard', 'Star Trek: Lower Decks', 'Star Trek: Prodigy',
            'Star Trek: Strange New Worlds'
        ],
        titlePatterns: ['Star Trek'],
        networkHints: ['CBS', 'Paramount+'],
        keywordHints: ['starfleet', 'federation', 'vulcan', 'klingon']
    },
    {
        slug: 'walking-dead',
        name: 'The Walking Dead Universe',
        exactTitles: [
            'The Walking Dead', 'Fear the Walking Dead', 'The Walking Dead: World Beyond',
            'Tales of the Walking Dead', 'The Walking Dead: Dead City',
            'The Walking Dead: Daryl Dixon', 'The Walking Dead: The Ones Who Live'
        ],
        titlePatterns: ['Walking Dead'],
        networkHints: ['AMC'],
        keywordHints: ['walking dead', 'zombie apocalypse', 'robert kirkman']
    },
    {
        slug: 'breaking-bad',
        name: 'Breaking Bad Universe',
        exactTitles: ['Breaking Bad', 'Better Call Saul', 'El Camino'],
        titlePatterns: [],
        networkHints: ['AMC'],
        keywordHints: ['vince gilligan', 'saul goodman', 'walter white', 'heisenberg', 'albuquerque']
    },
    {
        slug: 'game-of-thrones',
        name: 'Game of Thrones Universe',
        exactTitles: ['Game of Thrones', 'House of the Dragon', 'A Knight of the Seven Kingdoms'],
        titlePatterns: [],
        networkHints: ['HBO', 'Max'],
        keywordHints: ['westeros', 'targaryen', 'george r.r. martin', 'iron throne', 'seven kingdoms']
    },
    {
        slug: 'yellowstone-verse',
        name: 'Yellowstone Universe',
        exactTitles: ['Yellowstone', '1883', '1923', '6666', 'Lawmen: Bass Reeves'],
        titlePatterns: [],
        networkHints: ['Paramount Network', 'Paramount+'],
        keywordHints: ['taylor sheridan', 'dutton', 'montana ranch']
    },
    {
        slug: 'ncis-verse',
        name: 'NCIS Universe',
        exactTitles: [
            'NCIS', 'NCIS: Los Angeles', 'NCIS: New Orleans',
            'NCIS: Hawai\'i', 'NCIS: Sydney', 'NCIS: Origins'
        ],
        titlePatterns: ['NCIS'],
        networkHints: ['CBS'],
        keywordHints: ['naval criminal investigative service']
    },
    {
        slug: 'greys-verse',
        name: 'Grey\'s Anatomy Universe',
        exactTitles: ['Grey\'s Anatomy', 'Private Practice', 'Station 19'],
        titlePatterns: [],
        networkHints: ['ABC'],
        keywordHints: ['shondaland', 'grey sloan', 'seattle grace']
    },
    {
        slug: 'mcu-tv',
        name: 'Marvel Cinematic Universe',
        exactTitles: [
            'WandaVision', 'The Falcon and the Winter Soldier', 'Loki',
            'What If...?', 'Hawkeye', 'Moon Knight', 'Ms. Marvel',
            'She-Hulk: Attorney at Law', 'Secret Invasion', 'Echo',
            'Agatha All Along', 'Daredevil: Born Again'
        ],
        titlePatterns: [],
        networkHints: ['Disney+', 'Marvel'],
        keywordHints: ['marvel cinematic universe', 'mcu', 'avengers']
    },
    {
        slug: 'csi-verse',
        name: 'CSI Universe',
        exactTitles: ['CSI: Crime Scene Investigation', 'CSI: Miami', 'CSI: NY', 'CSI: Cyber', 'CSI: Vegas'],
        titlePatterns: ['CSI'],
        networkHints: ['CBS'],
        keywordHints: ['crime scene investigation', 'forensic']
    },
    {
        slug: 'fbi-verse',
        name: 'FBI Universe',
        exactTitles: ['FBI', 'FBI: Most Wanted', 'FBI: International'],
        titlePatterns: ['FBI:'],
        networkHints: ['CBS'],
        keywordHints: ['dick wolf', 'fbi']
    },
    {
        slug: 'one-chicago',
        name: 'One Chicago',
        exactTitles: ['Chicago Fire', 'Chicago P.D.', 'Chicago Med', 'Chicago Justice'],
        titlePatterns: ['Chicago'],
        networkHints: ['NBC'],
        keywordHints: ['one chicago', 'dick wolf']
    }
] as const;

// ============================================================================
// HEURISTIC DETECTION (Fast, no LLM cost)
// ============================================================================

export interface UniverseMatch {
    slug: string;
    name: string;
    confidence: 'exact' | 'pattern' | 'heuristic' | 'llm';
}

/**
 * Detect shared universe using exact matches and patterns
 * 
 * @param title - Show title
 * @param networks - Broadcasting networks
 * @param keywords - TMDB keywords
 * @returns Universe match or null if not detected
 */
export function detectUniverseHeuristic(
    title: string,
    networks?: string[],
    keywords?: string[]
): UniverseMatch | null {
    const normalizedTitle = title.toLowerCase().trim();
    const networkSet = new Set((networks || []).map(n => n.toLowerCase()));
    const keywordSet = new Set((keywords || []).map(k => k.toLowerCase()));

    for (const universe of KNOWN_UNIVERSES) {
        // Check exact title match (highest confidence)
        if (universe.exactTitles.some(t => t.toLowerCase() === normalizedTitle)) {
            return { slug: universe.slug, name: universe.name, confidence: 'exact' };
        }

        // Check title patterns
        if (universe.titlePatterns.some(p => normalizedTitle.startsWith(p.toLowerCase()))) {
            return { slug: universe.slug, name: universe.name, confidence: 'pattern' };
        }

        // Check keyword hints (medium confidence)
        const keywordMatches = universe.keywordHints.filter(k =>
            keywordSet.has(k.toLowerCase()) ||
            Array.from(keywordSet).some(kw => kw.includes(k.toLowerCase()))
        );
        if (keywordMatches.length >= 2) {
            return { slug: universe.slug, name: universe.name, confidence: 'heuristic' };
        }

        // Check network + single keyword (for new shows in franchise)
        const networkMatch = universe.networkHints.some(n => networkSet.has(n.toLowerCase()));
        if (networkMatch && keywordMatches.length >= 1) {
            return { slug: universe.slug, name: universe.name, confidence: 'heuristic' };
        }
    }

    return null;
}

// ============================================================================
// LLM-BASED DETECTION (For spinoffs and non-obvious connections)
// ============================================================================

/**
 * Detect shared universe using LLM for non-obvious connections
 * Use when heuristic detection fails but synopsis suggests connection
 * 
 * @param config - LLM configuration
 * @param title - Show title
 * @param synopsis - Show overview
 * @param cast - Main cast members
 * @returns Universe match or null
 */
export async function detectUniverseLLM(
    config: { apiKey: string; provider: string; model?: string; endpoint?: string },
    title: string,
    synopsis: string,
    cast?: string[]
): Promise<UniverseMatch | null> {
    const knownUniverseList = KNOWN_UNIVERSES
        .map(u => `- ${u.slug}: ${u.name} (${u.exactTitles.slice(0, 3).join(', ')}...)`)
        .join('\n');

    const systemPrompt = `You detect if a TV show belongs to a known shared universe (spinoff, crossover, or same fictional world).

## Known Universes:
${knownUniverseList}

## Output:
If the show belongs to a known universe, output:
{"universe_slug": "slug", "confidence": "high"|"medium"|"low", "reason": "explanation"}

If the show is standalone or you're not sure, output:
{"universe_slug": null}

Only classify shows that EXPLICITLY belong to these universes through characters, settings, or confirmed canon.
Do NOT guess based on similar themes alone.`;

    const userPrompt = `Is this show part of a known shared universe?

**Title:** ${title}
**Synopsis:** ${synopsis}
${cast ? `**Cast:** ${cast.slice(0, 5).join(', ')}` : ''}`;

    try {
        const response = await callLLM({
            userPrompt,
            systemPrompt,
            apiKey: config.apiKey,
            provider: config.provider,
            model: config.model,
            endpoint: config.endpoint,
            maxTokens: 200
        });

        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return null;

        const parsed = JSON.parse(jsonMatch[0]);
        if (!parsed.universe_slug) return null;

        // Validate against known universes
        const universe = KNOWN_UNIVERSES.find(u => u.slug === parsed.universe_slug);
        if (!universe) return null;

        console.log(`🌌 Universe detected (LLM): ${title} → ${universe.name}`);
        return { slug: universe.slug, name: universe.name, confidence: 'llm' };

    } catch (error) {
        console.warn(`⚠️ Universe detection failed for "${title}":`, error);
        return null;
    }
}

// ============================================================================
// MAIN DETECTION FUNCTION
// ============================================================================

/**
 * Detect shared universe using heuristics first, then LLM fallback
 * 
 * @param title - Show title
 * @param synopsis - Show overview
 * @param networks - Broadcasting networks
 * @param keywords - TMDB keywords
 * @param cast - Main cast
 * @param llmConfig - Optional LLM config for fallback
 * @returns Universe match or null
 */
export async function detectSharedUniverse(
    title: string,
    synopsis: string,
    networks?: string[],
    keywords?: string[],
    cast?: string[],
    llmConfig?: { apiKey: string; provider: string; model?: string; endpoint?: string }
): Promise<UniverseMatch | null> {
    // Try heuristic detection first (free, fast)
    const heuristicMatch = detectUniverseHeuristic(title, networks, keywords);
    if (heuristicMatch) {
        console.log(`🌌 Universe detected (${heuristicMatch.confidence}): ${title} → ${heuristicMatch.name}`);
        return heuristicMatch;
    }

    // If no match and LLM config provided, try LLM detection
    // Only use for shows with suggestive keywords
    if (llmConfig && keywords?.some(k =>
        k.toLowerCase().includes('spinoff') ||
        k.toLowerCase().includes('spin-off') ||
        k.toLowerCase().includes('crossover')
    )) {
        return detectUniverseLLM(llmConfig, title, synopsis, cast);
    }

    return null;
}

// ============================================================================
// UTILITY: Get all shows in a universe
// ============================================================================

/**
 * Get known member shows for a universe
 */
export function getUniverseMembers(slug: string): string[] {
    const universe = KNOWN_UNIVERSES.find(u => u.slug === slug);
    return universe ? [...universe.exactTitles] : [];
}

/**
 * Get universe info by slug
 */
export function getUniverseInfo(slug: string): UniverseDefinition | undefined {
    return KNOWN_UNIVERSES.find(u => u.slug === slug);
}
