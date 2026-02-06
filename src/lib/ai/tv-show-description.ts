/**
 * TV Show Structured Description Generation
 * 
 * "3-Bucket Strategy" for optimal Vector DB results:
 * Instead of dozens of genre-specific prompts, route to 3 structural engines:
 * 
 * 1. NARRATIVE (Scripted): Driven by Plot & Character
 *    - Drama, Sci-Fi, Comedy, Crime, Animation
 * 
 * 2. FORMAT (Competition/Rules): Driven by Mechanics & Winning  
 *    - Game Shows, Competitions, Talk Shows, Variety
 * 
 * 3. OBSERVATIONAL (Documentary): Driven by Topic & Access
 *    - Documentary, Docu-series, True Crime, News, "Vibe" Reality
 * 
 * Each bucket generates:
 * - Premise (60-110 words): Bucket-specific structure
 * - Themes & Tropes (70-100 words): TVTropes terminology
 * - Tone & Appeal (50-90 words): "For Fans Of" anchors
 * - Signature Style (40-60 words): Visual/audio fingerprint
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { callLLM } from '@/lib/llm';
import { getLLMConfig, type LLMConfig } from '@/lib/harvesters/shared';
import type { StructuredDescription, GenerationContext } from './structured-description';

// ============================================================================
// 3-BUCKET DETECTION SYSTEM
// ============================================================================

export type TvBucket = 'NARRATIVE' | 'FORMAT' | 'OBSERVATIONAL';

// ============================================================================
// 6-LABEL FORMAT TAXONOMY (Extensible - add new formats here)
// Provides granular format classification for vector differentiation
// ============================================================================

export type TvFormat =
    | 'SCRIPTED_SINGLE_CAM'      // Cinematic, no laugh track (The Bear, Succession)
    | 'SCRIPTED_MULTI_CAM'       // Stage-like, laugh track (Friends, Big Bang Theory)
    | 'SCRIPTED_MOCKUMENTARY'    // Fictional documentary style (The Office, Abbott Elementary)
    | 'UNSCRIPTED_COMPETITION'   // Game mechanics, elimination (Survivor, Top Chef)
    | 'UNSCRIPTED_DOCUSOAP'      // Constructed reality, interpersonal (Real Housewives)
    | 'UNSCRIPTED_DOCUSERIES'    // Educational, archival, narrator-led (Planet Earth)
    | 'UNKNOWN';                 // Fallback

// Extensible keyword arrays for format detection
// Add new detection patterns here without modifying core logic
const FORMAT_DETECTION = {
    // Single-camera scripted indicators
    SINGLE_CAM_KEYWORDS: [
        'single-camera', 'cinematic', 'prestige', 'cable drama', 'streaming original',
        'hour-long drama', 'serialized drama', 'premium cable'
    ],

    // Multi-camera scripted indicators  
    MULTI_CAM_KEYWORDS: [
        'multi-camera', 'laugh track', 'studio audience', 'three-camera',
        'traditional sitcom', 'network sitcom'
    ],

    // Mockumentary indicators (highest priority for scripted)
    MOCKUMENTARY_KEYWORDS: [
        'mockumentary', 'docu-style', 'fake documentary', 'mock-doc',
        'confessional', 'talking head', 'breaking the fourth wall',
        'documentary-style comedy'
    ],

    // Competition/game show indicators
    COMPETITION_KEYWORDS: [
        'competition', 'elimination', 'contestant', 'contestants compete',
        'game show', 'host', 'judges', 'prize', 'winner', 'challenge',
        'audition', 'talent show', 'cooking competition', 'dating show'
    ],

    // Docusoap/reality drama indicators
    DOCUSOAP_KEYWORDS: [
        'reality show', 'real housewives', 'drama series', 'interpersonal',
        'confessional interviews', 'constructed reality', 'lifestyle',
        'celebrity', 'follows the lives'
    ],

    // Documentary/educational indicators
    DOCUSERIES_KEYWORDS: [
        'documentary', 'docuseries', 'archival footage', 'narrator',
        'educational', 'nature documentary', 'true crime', 'investigation',
        'historical', 'science series'
    ]
} as const;

// ============================================================================
// CHARACTER ARCHETYPES (Extensible - add new archetypes here)
// Used for LLM translation of cast to universal character functions
// ============================================================================

export const CHARACTER_ARCHETYPES = [
    // Protagonist Archetypes
    { id: 'ANTI_HERO', label: 'Anti-Hero', description: 'Morally ambiguous, driven by vice, justifies means' },
    { id: 'BYRONIC_HERO', label: 'Byronic Hero', description: 'Brooding, isolated, code of honor, reluctant savior' },
    { id: 'CHOSEN_ONE', label: 'Chosen One', description: 'Destined for greatness, special powers or role' },
    { id: 'EVERYMAN', label: 'Everyman', description: 'Relatable ordinary person thrust into extraordinary circumstances' },
    { id: 'CYNICAL_GENIUS', label: 'Cynical Genius', description: 'Brilliant but abrasive, prioritizes logic over social norms' },

    // Supporting Archetypes
    { id: 'MENTOR', label: 'Mentor', description: 'Wise guide, provides training and wisdom' },
    { id: 'CAREGIVER', label: 'Caregiver', description: 'Moral compass, empathetic support figure' },
    { id: 'TRICKSTER', label: 'Trickster', description: 'Comic relief, subverts expectations, clever mischief' },
    { id: 'REBEL', label: 'Rebel', description: 'Challenges authority, fights the system' },
    { id: 'SAGE', label: 'Sage', description: 'Keeper of knowledge, provides insight' },

    // Dynamic Pair Archetypes
    { id: 'STRAIGHT_MAN', label: 'Straight Man', description: 'Reactive observer, grounding element in chaos' },
    { id: 'THE_FOOL', label: 'The Fool', description: 'Absurdist, lacks self-awareness, comedic catalyst' },
    { id: 'CHAOS_AGENT', label: 'Chaos Agent', description: 'Eccentric, disruptive, impulsive, transformative' },

    // Ensemble Archetypes
    { id: 'FOUND_FAMILY', label: 'Found Family', description: 'Diverse group, loyalty, dysfunctional dynamics' },
    { id: 'INCOMPETENT_LEADER', label: 'Incompetent Leader', description: 'Authority figure desperate for validation' }
] as const;

export type ArchetypeId = typeof CHARACTER_ARCHETYPES[number]['id'];

// ============================================================================
// LIFECYCLE STATES (Extensible - add new states here)
// Tracks show evolution for FSM-based metadata management
// ============================================================================

export type LifecycleState =
    | 'MINISERIES'         // Single season, closed narrative
    | 'SERIALIZED_DRAMA'   // Multi-season with recurring cast
    | 'ANTHOLOGY_SERIES'   // Rotating cast/stories per season
    | 'STANDARD'           // Typical ongoing series
    | 'UNKNOWN';           // Default/unclassified

// Keywords that indicate FORMAT bucket (Game/Competition)
const FORMAT_KEYWORDS = [
    'game show', 'competition', 'elimination', 'quiz', 'contest',
    'talent show', 'cooking competition', 'singing competition',
    'dating competition', 'race', 'challenge', 'bake off', 'survivor',
    'winner', 'prize', 'judges', 'audition', 'panel show', 'variety'
];

// Genres that indicate FORMAT bucket
const FORMAT_GENRES = [
    'Game Show', 'Reality Competition', 'Talk Show', 'Variety', 'Talk'
];

// Genres that indicate OBSERVATIONAL bucket  
const OBSERVATIONAL_GENRES = [
    'Documentary', 'News', 'Docuseries', 'True Crime'
];

// Keywords that indicate non-competition reality (OBSERVATIONAL)
const OBSERVATIONAL_KEYWORDS = [
    'documentary', 'docuseries', 'true crime', 'investigation',
    'behind the scenes', 'real life', 'follows', 'chronicles'
];

// SCRIPTED FORCE keywords - these ALWAYS route to NARRATIVE regardless of Documentary tag
// Prevents mockumentaries like The Office or What We Do in the Shadows from being misclassified
const SCRIPTED_FORCE_KEYWORDS = [
    'mockumentary', 'sitcom', 'comedy-drama', 'dramedy', 'scripted',
    'fictional', 'satire', 'parody', 'workplace comedy', 'single-camera',
    'laugh track', 'multi-camera', 'animated series', 'anime',
    'starring', 'episodes', 'season finale', 'teleplay', 'showrunner'
];

/**
 * Determine which structural bucket a TV show belongs to
 * 
 * Priority Order (CRITICAL - prevents drama misclassification):
 * 0a. GENRE SHIELD: Drama/Comedy/Sci-Fi genres → NARRATIVE (blocks FORMAT)
 * 0b. TMDB TYPE: "Scripted" type → NARRATIVE (strongest signal from source)
 * 0c. SCRIPTED FORCE: Mockumentary, Sitcom, etc. → NARRATIVE
 * 1. FORMAT: Game Show, Competition → FORMAT (only if no scripted signals)
 * 2. OBSERVATIONAL: Documentary, News → OBSERVATIONAL
 * 3. DEFAULT: Everything else → NARRATIVE
 * 
 * @param genres - Array of genre strings from TMDB
 * @param keywords - Array of keyword strings from TMDB
 * @param synopsis - Overview/description text
 * @param tmdbType - TMDB's "type" field (e.g., "Scripted", "Miniseries", "Documentary")
 */
export function detectTvBucket(
    genres?: string[],
    keywords?: string[],
    synopsis?: string,
    tmdbType?: string | null
): TvBucket {
    const genresLower = genres?.map(g => g.toLowerCase()) || [];
    const keywordsLower = keywords?.map(k => k.toLowerCase()) || [];
    const synopsisLower = synopsis?.toLowerCase() || '';
    const tmdbTypeLower = tmdbType?.toLowerCase() || '';

    // =========================================================================
    // 0a. GENRE SHIELD: If it's Drama/Comedy, it's Scripted.
    // This prevents "Dexter" from becoming a "Competition" because of plot keywords.
    // =========================================================================
    const isScriptedGenre = genresLower.some(g =>
        g === 'drama' ||
        g === 'comedy' ||
        g === 'sci-fi & fantasy' ||
        g === 'science fiction' ||
        g === 'action & adventure' ||
        g === 'action' ||
        g === 'adventure' ||
        g === 'mystery' ||
        g === 'crime' ||
        g === 'thriller' ||
        g === 'animation' ||
        g === 'family' ||
        g === 'western' ||
        g === 'war' ||
        g === 'war & politics'
    );

    // If we have a scripted genre, immediately lock to NARRATIVE
    if (isScriptedGenre) {
        return 'NARRATIVE';  // Genre shield activated - blocks FORMAT
    }

    // =========================================================================
    // 0b. TMDB TYPE CHECK: Strongest signal from source data
    // "Scripted" is ALWAYS narrative content
    // "Miniseries" requires genre check (Documentary miniseries like Planet Earth)
    // =========================================================================
    if (tmdbTypeLower.includes('scripted')) {
        return 'NARRATIVE';  // TMDB explicitly marks this as scripted
    }

    if (tmdbTypeLower.includes('miniseries')) {
        // Safety check: Is it actually a docu-series? (e.g., Planet Earth, The Jinx)
        const hasDocumentaryGenre = genresLower.some(g => g.includes('documentary'));
        if (hasDocumentaryGenre) {
            return 'OBSERVATIONAL';  // Miniseries with Documentary genre
        }
        return 'NARRATIVE';  // Scripted miniseries (e.g., Band of Brothers)
    }

    // =========================================================================
    // 0c. SCRIPTED FORCE: Force NARRATIVE if scripted indicators present
    // This runs before FORMAT check to prevent any remaining misclassification
    // =========================================================================
    const hasScriptedForce = SCRIPTED_FORCE_KEYWORDS.some(sf =>
        keywordsLower.some(k => k.includes(sf)) || synopsisLower.includes(sf)
    );
    if (hasScriptedForce) {
        return 'NARRATIVE';  // Mockumentary, Sitcom, etc. are scripted content
    }

    // =========================================================================
    // 1. FORMAT (Competition/Game) - Only reaches here if NOT a scripted genre
    // =========================================================================
    const hasFormatKeyword = FORMAT_KEYWORDS.some(fk =>
        keywordsLower.some(k => k.includes(fk)) || synopsisLower.includes(fk)
    );
    const hasFormatGenre = FORMAT_GENRES.some(fg =>
        genresLower.some(g => g.includes(fg.toLowerCase()))
    );
    if (hasFormatKeyword || hasFormatGenre) {
        return 'FORMAT';
    }

    // =========================================================================
    // 2. OBSERVATIONAL (Documentary/News)
    // =========================================================================
    const hasObservationalGenre = OBSERVATIONAL_GENRES.some(og =>
        genresLower.some(g => g.includes(og.toLowerCase()))
    );
    if (hasObservationalGenre) {
        return 'OBSERVATIONAL';
    }

    // 3. Check for Non-Competition Reality (e.g., Kardashians, Real Housewives)
    const isReality = genresLower.some(g => g.includes('reality'));
    if (isReality) {
        // Reality but not competition = Observational (docu-soap)
        return 'OBSERVATIONAL';
    }

    // Check for observational keywords in synopsis
    const hasObservationalKeyword = OBSERVATIONAL_KEYWORDS.some(ok =>
        synopsisLower.includes(ok)
    );
    if (hasObservationalKeyword) {
        return 'OBSERVATIONAL';
    }

    // =========================================================================
    // 4. DEFAULT to NARRATIVE
    // =========================================================================
    return 'NARRATIVE';
}

// ============================================================================
// 6-LABEL FORMAT DETECTION (Granular classification for vector differentiation)
// ============================================================================

/**
 * Detect the granular format type for a TV show (6-label taxonomy)
 * 
 * Priority order:
 * 1. Mockumentary detection (scripted shows that look like docs)
 * 2. Multi-camera detection (traditional sitcoms)
 * 3. Competition detection (game shows, reality competitions)
 * 4. Docusoap detection (reality drama)
 * 5. Docuseries detection (educational/investigative docs)
 * 6. Default to single-camera for scripted, unknown otherwise
 * 
 * @param bucket - The 3-bucket classification (NARRATIVE/FORMAT/OBSERVATIONAL)
 * @param genres - Array of genre strings
 * @param keywords - Array of keyword strings
 * @param synopsis - Overview/description text
 * @param tmdbType - TMDB's type field
 */
export function detectTvFormat(
    bucket: TvBucket,
    genres?: string[],
    keywords?: string[],
    synopsis?: string,
    tmdbType?: string | null
): TvFormat {
    const genresLower = genres?.map(g => g.toLowerCase()) || [];
    const keywordsLower = keywords?.map(k => k.toLowerCase()) || [];
    const synopsisLower = synopsis?.toLowerCase() || '';
    const allText = [...keywordsLower, synopsisLower].join(' ');

    // Helper to check if any pattern matches
    const hasMatch = (patterns: readonly string[]) =>
        patterns.some(p => allText.includes(p) || keywordsLower.includes(p));

    // =========================================================================
    // SCRIPTED SHOWS (NARRATIVE bucket)
    // =========================================================================
    if (bucket === 'NARRATIVE') {
        // 1. Mockumentary is highest priority (scripted but looks like doc)
        if (hasMatch(FORMAT_DETECTION.MOCKUMENTARY_KEYWORDS)) {
            return 'SCRIPTED_MOCKUMENTARY';
        }

        // 2. Multi-camera sitcom detection
        if (hasMatch(FORMAT_DETECTION.MULTI_CAM_KEYWORDS)) {
            return 'SCRIPTED_MULTI_CAM';
        }

        // 3. Default scripted to single-camera (prestige TV default)
        return 'SCRIPTED_SINGLE_CAM';
    }

    // =========================================================================
    // COMPETITION/GAME SHOWS (FORMAT bucket)
    // =========================================================================
    if (bucket === 'FORMAT') {
        return 'UNSCRIPTED_COMPETITION';
    }

    // =========================================================================
    // OBSERVATIONAL SHOWS (OBSERVATIONAL bucket)
    // =========================================================================
    if (bucket === 'OBSERVATIONAL') {
        // Docusoap vs Docuseries detection
        if (hasMatch(FORMAT_DETECTION.DOCUSOAP_KEYWORDS)) {
            return 'UNSCRIPTED_DOCUSOAP';
        }

        // Default observational to docuseries (educational/investigative)
        return 'UNSCRIPTED_DOCUSERIES';
    }

    return 'UNKNOWN';
}

// ============================================================================
// ARCHETYPE TRANSLATION (LLM-based character function mapping)
// ============================================================================

// Note: callLLM is imported at the top of the file

/**
 * Translate cast characters into universal archetypes using LLM
 * 
 * This enables cross-show similarity matching based on character dynamics
 * rather than specific names (e.g., "Anti-Hero" matches across genres)
 * 
 * @param config - LLM configuration (same as description generation)
 * @param title - Show title
 * @param synopsis - Show overview
 * @param castWithCharacters - Array of cast members with character names
 * @returns Archetype description string for vector injection
 */
export async function translateToArchetypes(
    config: { apiKey: string; provider: string; model?: string; endpoint?: string },
    title: string,
    synopsis: string,
    castWithCharacters: { name: string; character: string }[]
): Promise<string> {
    const archetypeList = CHARACTER_ARCHETYPES
        .map(a => `- ${a.label}: ${a.description}`)
        .join('\n');

    const castList = castWithCharacters
        .slice(0, 6)  // Limit to main cast
        .map(c => `${c.name} as "${c.character}"`)
        .join(', ');

    const systemPrompt = `You are a narrative analyst. Your task is to map TV show characters to universal archetypes.

Available archetypes:
${archetypeList}

Output a SINGLE sentence (max 40 words) describing the main character dynamics using archetype labels.
Format: "Features [archetype] protagonist who [function], balanced by [archetype] who [function]."

Do NOT use character names. Use ONLY archetype labels.
If ensemble show, say "An ensemble of [archetype]+[archetype] forming a Found Family."`;

    const userPrompt = `Map the characters to archetypes:

Show: ${title}
Synopsis: ${synopsis}
Cast: ${castList}

Output archetype sentence:`;

    try {
        const response = await callLLM({
            userPrompt,
            systemPrompt,
            apiKey: config.apiKey,
            provider: config.provider,
            model: config.model,
            endpoint: config.endpoint,
            maxTokens: 100
        });

        // Clean and validate response
        const cleaned = response.trim().replace(/^["']|["']$/g, '');

        // Ensure it's a reasonable archetype sentence
        if (cleaned.length > 20 && cleaned.length < 200) {
            return cleaned;
        }

        return '';  // Return empty if invalid
    } catch (error) {
        console.warn(`⚠️ Archetype translation failed for "${title}":`, error);
        return '';
    }
}

// ============================================================================
// GENRE LENS DETECTION (NARRATIVE Sub-Classification)
// ============================================================================

export type GenreLens = 'SCI_FI_FANTASY' | 'CRIME_THRILLER' | 'DRAMA_ROMANCE' | 'COMEDY' | 'GENERAL';

// Genre clusters for lens detection
const SCI_FI_FANTASY_GENRES = [
    'sci-fi', 'science fiction', 'fantasy', 'supernatural', 'horror',
    'action & adventure', 'animation'
];

const CRIME_THRILLER_GENRES = [
    'crime', 'thriller', 'mystery', 'action', 'war', 'espionage',
    'political', 'legal'
];

const DRAMA_ROMANCE_GENRES = [
    'drama', 'romance', 'family', 'soap', 'melodrama',
    'coming of age', 'slice of life', 'history', 'western'
];

const COMEDY_GENRES = [
    'comedy', 'sitcom', 'satire', 'parody', 'sketch', 'stand-up'
];

// Keywords that override genre detection (for waterfall logic)
const SCI_FI_KEYWORDS = ['space', 'alien', 'robot', 'future', 'dystopia', 'cyberpunk', 'time travel'];
const COMEDY_KEYWORDS = ['sitcom', 'laugh', 'funny', 'humor', 'parody', 'mockumentary'];

/**
 * Detect the genre lens for NARRATIVE shows
 * Uses waterfall logic per TV Blueprint:
 * 1. Check keywords first (for Animation + Space -> SCI_FI)
 * 2. Check genre matches
 * 3. Fallback to GENERAL for variety/unclassified
 */
export function detectGenreLens(genres?: string[], keywords?: string[]): GenreLens {
    if (!genres?.length) return 'GENERAL';

    const genresLower = genres.map(g => g.toLowerCase());
    const keywordsLower = keywords?.map(k => k.toLowerCase()) || [];

    // WATERFALL STEP 1: Check keywords for overrides
    // e.g., "Animation" + "Space" -> SCI_FI_FANTASY
    const hasSciFiKeyword = SCI_FI_KEYWORDS.some(k => keywordsLower.some(kw => kw.includes(k)));
    const hasComedyKeyword = COMEDY_KEYWORDS.some(k => keywordsLower.some(kw => kw.includes(k)));

    // WATERFALL STEP 2: Count genre matches
    const sciFiCount = SCI_FI_FANTASY_GENRES.filter(sg =>
        genresLower.some(g => g.includes(sg))
    ).length + (hasSciFiKeyword ? 2 : 0);

    const crimeCount = CRIME_THRILLER_GENRES.filter(cg =>
        genresLower.some(g => g.includes(cg))
    ).length;

    const dramaCount = DRAMA_ROMANCE_GENRES.filter(dg =>
        genresLower.some(g => g.includes(dg))
    ).length;

    const comedyCount = COMEDY_GENRES.filter(cg =>
        genresLower.some(g => g.includes(cg))
    ).length + (hasComedyKeyword ? 2 : 0);

    // Return the cluster with most matches
    const counts = [
        { lens: 'SCI_FI_FANTASY' as GenreLens, count: sciFiCount },
        { lens: 'CRIME_THRILLER' as GenreLens, count: crimeCount },
        { lens: 'DRAMA_ROMANCE' as GenreLens, count: dramaCount },
        { lens: 'COMEDY' as GenreLens, count: comedyCount },
    ];

    const best = counts.reduce((a, b) => b.count > a.count ? b : a);

    if (best.count > 0) {
        return best.lens;
    }

    // WATERFALL STEP 3: Universal fallback for unclassified
    return 'GENERAL';
}

// Anthology detection keywords
const ANTHOLOGY_KEYWORDS = ['anthology', 'anthology series', 'standalone episodes', 'anthology show'];

/**
 * Detect if a show is an anthology series
 * Anthologies need special handling - premise about thematic link, not protagonist
 */
export function isAnthology(keywords?: string[], overview?: string): boolean {
    const keywordsLower = keywords?.map(k => k.toLowerCase()) || [];
    const overviewLower = overview?.toLowerCase() || '';

    return ANTHOLOGY_KEYWORDS.some(ak =>
        keywordsLower.some(k => k.includes(ak)) || overviewLower.includes(ak)
    );
}

/**
 * Infer showrunner when 'creators' field is empty
 * Checks directors/writers for recurring names
 */
export function inferShowrunner(metadata: {
    created_by?: string[];
    directors?: string[];
    writers?: string[];
}): string | null {
    if (metadata.created_by?.length) {
        return metadata.created_by[0];
    }

    // Fallback: Check directors/writers for recurring names
    const allCrew = [...(metadata.directors || []), ...(metadata.writers || [])];
    if (allCrew.length === 0) return null;

    const counts = new Map<string, number>();
    allCrew.forEach(name => counts.set(name, (counts.get(name) || 0) + 1));

    // If one name appears 3+ times, treat as showrunner
    for (const [name, count] of counts) {
        if (count >= 3) return name;
    }

    // If no recurring name, return first writer if available
    if (metadata.writers?.length) return metadata.writers[0];

    return null;
}


/**
 * @deprecated Use detectTvBucket instead
 * Kept for backwards compatibility
 */
export function isUnscriptedTvShow(
    genres?: string[],
    keywords?: string[],
    description?: string
): boolean {
    const bucket = detectTvBucket(genres, keywords, description);
    return bucket !== 'NARRATIVE';
}

// ============================================================================
// TV SHOW PROMPT CONTEXT
// ============================================================================

interface TvPromptContext extends GenerationContext {
    bucket: TvBucket;
    castWithCharacters?: Array<{ name: string; character: string }>;
    keywords?: string[];
    genres?: string[];
    contentDescriptors?: string[];
    networks?: string[];
}

/**
 * Build context string with all available grounding data
 */
function buildGroundingContext(ctx: TvPromptContext): string {
    const parts: string[] = [];

    parts.push(`Title: ${ctx.title}`);

    if (ctx.originalDescription) {
        parts.push(`Synopsis: ${ctx.originalDescription.slice(0, 600)}`);
    }

    if (ctx.genres?.length) {
        parts.push(`Genres: ${ctx.genres.join(', ')}`);
    }

    if (ctx.keywords?.length) {
        parts.push(`Keywords: ${ctx.keywords.slice(0, 15).join(', ')}`);
    }

    if (ctx.networks?.length) {
        parts.push(`Network: ${ctx.networks.join(', ')}`);
    }

    if (ctx.castWithCharacters?.length) {
        const castStr = ctx.castWithCharacters
            .slice(0, 8)
            .map(c => c.character ? `${c.name} as ${c.character}` : c.name)
            .join(', ');
        parts.push(`Cast: ${castStr}`);
    }

    if (ctx.contentDescriptors?.length) {
        parts.push(`Content Warnings: ${ctx.contentDescriptors.join(', ')}`);
    }

    return parts.join('\n');
}

// ============================================================================
// BUCKET 1: NARRATIVE (Scripted) PREMISE - Genre Lens Variants
// PROSE-FIRST: No labels, no headers - just flowing media criticism
// ============================================================================

// Lens 1A: Sci-Fi & Fantasy
const PREMISE_NARRATIVE_SCI_FI = (ctx: TvPromptContext) => ({
    system: `You are an expert speculative fiction curator. Write a single, fluid paragraph (100-150 words) describing this sci-fi/fantasy series.

Structure your prose as follows: Begin by establishing the era, world-state, and atmosphere in an evocative opening phrase. Transition into the unique laws or conceits of this world—what supernatural, technological, or magical systems underpin everything. Introduce the lead character by name and archetype, then conclude with the existential threat or prophecy driving the narrative.

CRITICAL: Output ONLY the prose paragraph. Do NOT include headers, labels, bullet points, or section markers. Do NOT invent characters—use only the provided cast data. Avoid "In a world where..." or "A story about..."

HARD LIMIT: Maximum 120 words. Stop writing once you reach this limit.`,
    user: buildGroundingContext(ctx)
});

// Lens 1B: Crime & Thriller
const PREMISE_NARRATIVE_CRIME = (ctx: TvPromptContext) => ({
    system: `You are a crime fiction analyst specializing in procedurals and noir. Write a single, fluid paragraph (100-150 words) describing this crime/thriller series.

Structure your prose as follows: Open with a vivid phrase establishing the location and atmosphere. State the specific crime or case that drives the series. Introduce the investigator by name and their unique angle or flaw, then conclude with the stakes—what happens if they fail, and who is protected by the conspiracy.

CRITICAL: Output ONLY the prose paragraph. Do NOT include headers, labels, bullet points, or section markers. Do NOT invent characters—use only the provided cast data.

HARD LIMIT: Maximum 120 words. Stop writing once you reach this limit.`,
    user: buildGroundingContext(ctx)
});

// Lens 1C: Drama & Romance  
const PREMISE_NARRATIVE_DRAMA = (ctx: TvPromptContext) => ({
    system: `You are a prestige drama curator specializing in character studies and relationship dynamics. Write a single, fluid paragraph (100-150 words) describing this drama/romance series.

Structure your prose as follows: Open with an evocative phrase establishing the setting and emotional temperature. Identify the core emotional wound, social barrier, or family tension. Introduce the protagonist by name and their internal conflict, then pose the central question—what must they choose between, sacrifice, or confront.

CRITICAL: Output ONLY the prose paragraph. Do NOT include headers, labels, bullet points, or section markers. Do NOT invent characters—use only the provided cast data.

HARD LIMIT: Maximum 120 words. Stop writing once you reach this limit.`,
    user: buildGroundingContext(ctx)
});

// Lens 1D: Comedy (Sitcom, Satire, Farce)
const PREMISE_NARRATIVE_COMEDY = (ctx: TvPromptContext) => ({
    system: `You are a comedy writer and sitcom analyst. Write a single, fluid paragraph (100-150 words) describing this comedy series.

Structure your prose as follows: Open with a phrase establishing the comedic world and setting. Define the core comedic engine—the "fish out of water" situation, incompetence, or social friction that generates laughs. Introduce the lead by name and their comedic archetype, then describe the recurring comedic beats the show delivers.

CRITICAL: Output ONLY the prose paragraph. Do NOT include headers, labels, bullet points, or section markers. Do NOT invent characters—use only the provided cast data. Focus on comedy, not dramatic stakes.

HARD LIMIT: Maximum 120 words. Stop writing once you reach this limit.`,
    user: buildGroundingContext(ctx)
});

// Lens 1E: General (Western, Period, Variety, etc.)
const PREMISE_NARRATIVE_GENERAL = (ctx: TvPromptContext) => ({
    system: `You are a prestige media critic. Write a single, fluid paragraph (100-150 words) describing this scripted series.

Structure your prose as follows: Begin by establishing the era, location, and atmosphere. Transition into the central conceit or unique angle that drives the series. Introduce the lead character by name and archetype, then conclude with the primary conflict or obstacle preventing stability.

CRITICAL: Output ONLY the prose paragraph. Do NOT include headers, labels, bullet points, or section markers. Do NOT invent characters—use only the provided cast data. Avoid "In a world where..." or "A story about..."

HARD LIMIT: Maximum 120 words. Stop writing once you reach this limit.`,
    user: buildGroundingContext(ctx)
});

/**
 * Get the appropriate NARRATIVE premise prompt based on genre lens
 */
function getPremisePromptForLens(lens: GenreLens, ctx: TvPromptContext) {
    switch (lens) {
        case 'SCI_FI_FANTASY':
            return PREMISE_NARRATIVE_SCI_FI(ctx);
        case 'CRIME_THRILLER':
            return PREMISE_NARRATIVE_CRIME(ctx);
        case 'DRAMA_ROMANCE':
            return PREMISE_NARRATIVE_DRAMA(ctx);
        case 'COMEDY':
            return PREMISE_NARRATIVE_COMEDY(ctx);
        case 'GENERAL':
        default:
            return PREMISE_NARRATIVE_GENERAL(ctx);
    }
}

// ============================================================================
// BUCKET 2: FORMAT (Competition & Rules) PREMISE
// PROSE-FIRST: No labels, no headers - just flowing descriptions
// ============================================================================

const PREMISE_FORMAT = (ctx: TvPromptContext) => ({
    system: `You are a TV format analyst specializing in game mechanics and show structure. Write a single, fluid paragraph (100-150 words) describing this competition/game show.

Structure your prose as follows: Open by defining the format and core mechanic. Explain what contestants physically do and what skills are tested. Describe the win condition and stakes. Conclude with the overall vibe—is it cutthroat and strategic, or wholesome and skill-based?

CRITICAL: Output ONLY the prose paragraph. Do NOT include headers, labels, bullet points, or section markers. Focus on the "game," not a narrative arc. Use terms like "contestants," "judges," and "hosts."

HARD LIMIT: Maximum 120 words. Stop writing once you reach this limit.`,
    user: buildGroundingContext(ctx)
});

// ============================================================================
// BUCKET 3: OBSERVATIONAL (Documentary & Docu-Reality) PREMISE
// PROSE-FIRST: No labels, no headers
// ============================================================================

const PREMISE_OBSERVATIONAL = (ctx: TvPromptContext) => ({
    system: `You are a social historian and documentary curator. Write a single, fluid paragraph (100-150 words) describing this documentary/reality program.

Structure your prose as follows: Open by identifying the specific topic or subculture being examined. For documentaries, state the core question or "new truth" being uncovered; for reality/docu-soaps, describe the interpersonal dynamics. Identify the key figures or subjects, then conclude with what makes the access unique.

CRITICAL: Output ONLY the prose paragraph. Do NOT include headers, labels, bullet points, or section markers. Focus on real-world observation, not fictional storytelling.

HARD LIMIT: Maximum 150 words. Stop writing once you reach this limit.`,
    user: buildGroundingContext(ctx)
});

// ============================================================================
// THEMES & TAXONOMY PROMPT (Bucket-Aware Hybrid Output)
// ============================================================================

/**
 * Build bucket-specific trope context guidance
 */
function getTropeContext(bucket: TvBucket): string {
    switch (bucket) {
        case 'FORMAT':
            return 'Look for Game Theory and Reality TV editing tropes (e.g., "The Alliance", "The Floater", "The Villain Edit", "Underdog Story", "Vote Manipulation").';
        case 'OBSERVATIONAL':
            return 'Look for journalistic framing and bias tropes (e.g., "Unreliable Narrator", "Fly-on-the-Wall", "True Crime", "Cult of Personality").';
        case 'NARRATIVE':
        default:
            return 'Look for literary and cinematic tropes (e.g., "Enemies-to-Lovers", "The Anti-Hero", "Whodunit", "Found Family", "Dark and Troubled Past").';
    }
}

const THEMES_PROMPT = (ctx: TvPromptContext) => ({
    system: `You are a Cultural Taxonomist and Media Analyst. Analyze the narrative DNA of this show.

Write two distinct sections:

1. A single cohesive paragraph (80-110 words) explaining the thematic depth—how this show uses its themes and how specific tropes drive the narrative.
${ctx.bucket === 'NARRATIVE' ? `Focus on philosophical questions (e.g., "The corruption of power") and literary/cinematic tropes.` : ''}${ctx.bucket === 'FORMAT' ? `Focus on strategic dynamics (e.g., "The tension between social strategy and physical dominance").` : ''}${ctx.bucket === 'OBSERVATIONAL' ? `Focus on the sociological lens (e.g., "A fly-on-the-wall examination of the American justice system").` : ''}

2. A single line starting with the word "Keywords:" followed by 6-8 bracketed tags covering both macro themes (Revenge, Ambition, Survival) and micro tropes (from TVTropes.org or Reality TV terminology).

${getTropeContext(ctx.bucket)}

CRITICAL: Do NOT use labels like "PART 1", "PART 2", "Analysis:", or "The Analysis". Just provide the paragraph followed by the Keywords line.

HARD LIMIT: Maximum 100 words for the analysis paragraph (Keywords line is additional). Stop writing once you reach this limit.`,
    user: `Show Bucket: ${ctx.bucket}\n\n${buildGroundingContext(ctx)}`
});

// ============================================================================
// TONE & APPEAL PROMPT (Vector Triangulation Strategy)
// ============================================================================

/**
 * Build bucket-specific tone hints to guide adjective selection
 */
function getToneHints(bucket: TvBucket): string {
    switch (bucket) {
        case 'FORMAT':
            return 'Tone Hints: [High-Stakes, Strategic, Skill-based, Chaotic, Drama-heavy, Cutthroat, Wholesome, Trashy-Fun, Campy, Paranoiac]';
        case 'OBSERVATIONAL':
            return 'Tone Hints: [Investigative, Salacious, Inspirational, Educational, Raw, Voyeuristic, Intimate, Haunting, Unflinching]';
        case 'NARRATIVE':
        default:
            return 'Tone Hints: [Cerebral, Kinetic, Slow-burn, Surreal, Gritty, Heartfelt, Claustrophobic, Operatic, Neon-Noir, Whimsical]';
    }
}

const TONE_PROMPT = (ctx: TvPromptContext) => ({
    system: `You are a Content Recommendation Engine and "Vibe" Curator. Construct a psychological and emotional profile of this show.

Write two paragraphs of flowing prose (total 100-120 words):

PARAGRAPH 1: THE TEXTURE. Define the show's atmosphere using high-precision sensory adjectives (avoid generic words like "dramatic" or "funny"). Describe the texture of the viewing experience and the emotional aftertaste—how does the viewer feel while the credits roll?
${ctx.bucket === 'NARRATIVE' ? 'Focus on mood: Cerebral, Kinetic, Slow-burn, Surreal, Gritty, Heartfelt, Claustrophobic, Operatic.' : ''}${ctx.bucket === 'FORMAT' ? 'Focus on energy: High-Stakes, Strategic, Skill-based, Chaotic, Drama-heavy, Cutthroat, Wholesome, Campy.' : ''}${ctx.bucket === 'OBSERVATIONAL' ? 'Focus on access: Investigative, Salacious, Inspirational, Educational, Raw, Voyeuristic, Intimate, Haunting.' : ''}

PARAGRAPH 2: THE TRIANGULATION. Anchor this show in the media landscape by comparing its structure, mood, and target audience to three other well-known properties. Explain WHY it matches them. End by identifying the specific "tribe" or niche audience this appeals to (e.g., "Lovers of slow-burn Nordic Noir").

CRITICAL: Output ONLY the two paragraphs. Do NOT use headers like "Atmosphere:", "Experience:", "For Fans Of:", or "Target Audience:". Do NOT use bullet points.

HARD LIMIT: Maximum 150 words TOTAL for both paragraphs combined. Stop writing once you reach this limit.`,
    user: `Show Bucket: ${ctx.bucket}\n${getToneHints(ctx.bucket)}\n\n${buildGroundingContext(ctx)}`
});

// ============================================================================
// SIGNATURE STYLE PROMPT (Sensory Fingerprint Strategy)
// ============================================================================

/**
 * Build network-aware production inference hints
 */
function getProductionHints(networks?: string[], bucket?: TvBucket): string {
    const networkStr = networks?.join(', ').toLowerCase() || '';
    const hints: string[] = [];

    // Network-based production tier inference
    if (networkStr.includes('hbo') || networkStr.includes('fx') || networkStr.includes('amc')) {
        hints.push('Likely Prestige TV: Cinematic single-camera, high production value');
    } else if (networkStr.includes('netflix') || networkStr.includes('amazon') || networkStr.includes('apple')) {
        hints.push('Streaming-era production: Likely cinematic, may have blockbuster budget');
    } else if (networkStr.includes('cbs') || networkStr.includes('abc') || networkStr.includes('nbc') || networkStr.includes('fox')) {
        hints.push('Broadcast network: Could be multi-camera studio or polished single-camera');
    } else if (networkStr.includes('discovery') || networkStr.includes('tlc') || networkStr.includes('bravo') || networkStr.includes('mtv')) {
        hints.push('Reality/Cable: Glossy produced reality or raw documentary style');
    }

    // Bucket-based hints
    if (bucket === 'FORMAT') {
        hints.push('Competition/Talk format: Consider studio lighting, graphics, host staging');
    } else if (bucket === 'OBSERVATIONAL') {
        hints.push('Documentary style: Consider handheld vs. produced, interview setups');
    }

    return hints.length > 0 ? `Production Context: ${hints.join('. ')}` : '';
}

const STYLE_PROMPT = (ctx: TvPromptContext) => ({
    system: `You are a Technical Art Critic and Production Analyst. Describe the audio-visual identity and production format of this show.

Write a cohesive analysis (80-100 words total across 2 paragraphs):

PARAGRAPH 1: THE VISUAL IDENTITY. Describe the camera work, color temperature, and lighting. ${ctx.bucket === 'NARRATIVE' ? 'Is it cinematic single-camera or multi-camera studio? Mention the color palette (e.g., "Cold blue filters," "Warm nostalgic sepia," "Neon-soaked") and how the staging supports the genre.' : ''}${ctx.bucket === 'FORMAT' ? 'Is it glossy studio production with branded graphics, or intimate stage setup? Describe the competition staging, judge panels, or talk show set design.' : ''}${ctx.bucket === 'OBSERVATIONAL' ? 'Is it glossy/produced or raw/handheld? Describe interview setups, b-roll style, and archival footage usage.' : ''}

PARAGRAPH 2: THE SENSORY PULSE. Describe the sound design, musical score, and editing rhythm. Is the pacing meditative and slow-burn, or defined by frenetic cuts and rapid-fire dialogue? Consider: synth-heavy score, orchestral swell, minimalist, reality confessionals, dramatic stings.

FINAL LINE: Provide 3-5 technical keywords for indexing, formatted exactly as:
Production Tags: [Tag 1], [Tag 2], [Tag 3]...
Examples: [Single-Camera], [Multi-Camera], [Mockumentary Style], [CGI-Heavy], [Period Accurate], [Blockbuster Budget], [Handheld], [Studio Set]

CRITICAL: Use ONLY prose for the analysis. Do NOT use numbered headers, labels, or bold section titles. Output the two paragraphs followed by the Production Tags line.

HARD LIMIT: Maximum 100 words TOTAL for both paragraphs combined (Production Tags line is additional). Stop writing once you reach this limit.`,
    user: `Show Bucket: ${ctx.bucket}\n${getProductionHints(ctx.networks, ctx.bucket)}\n\n${buildGroundingContext(ctx)}`
});

// ============================================================================
// SEMANTIC SUMMARY PROMPT (Vector DB Super-Sentence)
// ============================================================================

/**
 * High-density metadata sentence for Vector DB indexing
 * Hidden from users, used to create strong embedding "center of gravity"
 */
const SEMANTIC_SUMMARY_PROMPT = (ctx: TvPromptContext) => ({
    system: `You are a Semantic SEO Specialist for a video search engine.

Task: Create a single, high-density "Semantic Super-Sentence" (max 60 words) designed for vector retrieval.

IMPORTANT: This will NOT be shown to users. It is purely for search indexing.

${ctx.bucket === 'NARRATIVE' ? `FORMULA (Scripted/Narrative):
[Adjective] + [Time/Setting] + [Sub-Genre] + focusing on + [Core Conflict] + combining the [Attribute A] of [Comp 1] + with the [Attribute B] of [Comp 2].

Example: "A claustrophobic, near-future dystopian thriller focusing on a corporate severance procedure that splits memories, combining the surreal workplace satire of The Office with the psychological horror of Black Mirror."` : ''}${ctx.bucket === 'FORMAT' ? `FORMULA (Competition/Format):
[Adjective] + [Format Type] + where + [Participant Type] + must + [Core Mechanic] + for + [Prize], similar to [Comp 1] meets [Comp 2].

Example: "A cutthroat fashion design competition where professional tailors must create runway looks under extreme time constraints for a cash prize, acting as a high-stakes fusion of Project Runway meets Squid Game."` : ''}${ctx.bucket === 'OBSERVATIONAL' ? `FORMULA (Documentary/Observational):
[Adjective] + [Topic/Subject] + docu-series + following + [Key Figures/Archetypes] + as they navigate + [Central Tension], appealing to fans of [Comp 1].

Example: "A scandalous, fly-on-the-wall true crime docu-series following the bizarre feud between exotic animal zoo owners, appealing to fans of the eccentric character study found in Tiger King."` : ''}

CRITICAL CONSTRAINTS:
- Start with a strong adjective (this weights heavily in embeddings)
- Include at least 2 comparison shows using "combines X with Y" or "similar to X meets Y"
- No fluff words like "The show is about..." - every word must carry meaning
- Max 60 words`,
    user: `Show Bucket: ${ctx.bucket}\n\n${buildGroundingContext(ctx)}`
});

// ============================================================================
// MAIN GENERATION FUNCTION
// ============================================================================

// ============================================================================
// PROSE CLEANING FUNCTION (Strips any leaked headers from LLM output)
// ============================================================================

/**
 * Strips LLM-generated headers and labels for clean UI display.
 * Even with perfect prompts, LLMs occasionally output labels.
 * This is a guardrail to ensure the UI always receives clean prose.
 */
export function cleanDescriptionProse(text: string): string {
    if (!text) return '';

    return text
        // Remove common prompt labels followed by colons
        .replace(/^(THE\s(ENGINE|MECHANICS|STAKES|VIBE|SUBJECT|LENS|ACCESS|HOOK|ANALYSIS|STYLE|ATMOSPHERE|EXPERIENCE|AUDIENCE|TEXTURE|TRIANGULATION|VISUAL\sIDENTITY|SENSORY\sPULSE)):\s*/gmi, '')
        // Remove "PART 1:", "PART 2:", "PARAGRAPH 1:", etc.
        .replace(/^(PART|PARAGRAPH|SECTION)\s*\d+:?\s*(THE\s[A-Z\s]+)?:?\s*/gmi, '')
        // Remove any double-asterisk headers like **Atmosphere:** or **Experience:**
        .replace(/^\*\*[^*]+:\*\*\s*/gm, '')
        // Remove markdown bolded labels at start of lines like "**The Look:**"
        .replace(/^\*\*[^*]+\*\*:\s*/gm, '')
        // Remove numbered list markers like "1. " at start of paragraphs
        .replace(/^\d+\.\s+(THE\s[A-Z\s]+:?\s*)?/gmi, '')
        // Remove "For Fans Of:" type headers
        .replace(/^(For Fans Of|Target Audience|Atmosphere|Experience):\s*/gmi, '')
        // Remove "Here is a..." intro fluff
        .replace(/^(Here is|Here's|This is) (a|the|an)?.*?description:?\s*/gmi, '')
        // Clean up excessive whitespace
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

/**
 * Generate structured description specifically for TV shows
 * Uses Semantic Weaving prompts with 3-bucket detection
 * Generates 5 parts: premise, themes, tone, style, semanticSummary
 */
export async function generateTvShowDescription(
    supabase: ReturnType<typeof createServiceRoleClient>,
    context: GenerationContext & {
        castWithCharacters?: Array<{ name: string; character: string }>;
        keywords?: string[];
        genres?: string[];
        contentDescriptors?: string[];
        networks?: string[];
    }
): Promise<StructuredDescription> {
    const config = await getLLMConfig(supabase);

    if (!config.apiKey) {
        console.warn('No LLM API key configured');
        return { premise: '', themes: '', tone: '', style: '' };
    }

    // Detect which structural bucket this show belongs to
    const bucket = detectTvBucket(
        context.genres,
        context.keywords,
        context.originalDescription
    );

    console.log(`   ║    Bucket: ${bucket}`);

    const tvContext: TvPromptContext = {
        ...context,
        bucket
    };

    // Select appropriate premise prompt based on bucket
    let premisePrompt;
    switch (bucket) {
        case 'FORMAT':
            premisePrompt = PREMISE_FORMAT(tvContext);
            break;
        case 'OBSERVATIONAL':
            premisePrompt = PREMISE_OBSERVATIONAL(tvContext);
            break;
        case 'NARRATIVE':
        default:
            // Use Genre Lens to select appropriate NARRATIVE sub-prompt
            const lens = detectGenreLens(context.genres);
            console.log(`   ║    Genre Lens: ${lens}`);
            premisePrompt = getPremisePromptForLens(lens, tvContext);
            break;
    }

    // Generate all 5 parts in parallel (semanticSummary is hidden from users)
    // Token limits based on WORD limits (~1.35 tokens per word):
    // Premise: 120 words → 160 tokens
    // Themes: 100 words → 135 tokens + Keywords line
    // Tone: 150 words → 200 tokens
    // Style: 100 words → 135 tokens + Production Tags line
    // Semantic: 60 words → 80 tokens
    const [premiseRaw, themes, toneRaw, styleRaw, semanticSummary] = await Promise.all([
        callLLMWithConfig(config, premisePrompt, 160),
        callLLMWithConfig(config, THEMES_PROMPT(tvContext), 135),  // Keep uncleaned - has Keywords: line
        callLLMWithConfig(config, TONE_PROMPT(tvContext), 200),
        callLLMWithConfig(config, STYLE_PROMPT(tvContext), 135),
        callLLMWithConfig(config, SEMANTIC_SUMMARY_PROMPT(tvContext), 80)  // Keep uncleaned - internal only
    ]);

    // Apply prose cleaning to remove any leaked headers
    const premise = cleanDescriptionProse(premiseRaw);
    const tone = cleanDescriptionProse(toneRaw);
    const style = cleanDescriptionProse(styleRaw);

    // Extract production tags from style output (e.g., [Single-Camera], [Prestige])
    const productionTags = extractProductionTags(styleRaw);  // Use raw for tag extraction

    return {
        premise,
        themes,
        tone,
        style,
        semanticSummary,
        productionTags,
        bucketType: bucket
    };
}

/**
 * Extract bracketed production tags from style text
 * e.g., "[Single-Camera], [Prestige]" -> ["Single-Camera", "Prestige"]
 */
function extractProductionTags(styleText: string): string[] {
    const tagPattern = /\[([^\]]+)\]/g;
    const tags: string[] = [];
    let match;

    while ((match = tagPattern.exec(styleText)) !== null) {
        const tag = match[1].trim();
        if (tag && tag.length > 1 && tag.length < 50) {
            tags.push(tag);
        }
    }

    return tags;
}

async function callLLMWithConfig(
    config: LLMConfig,
    prompt: { system: string; user: string },
    maxTokens: number = 250  // ~185 words, enforces brevity
): Promise<string> {
    try {
        const response = await callLLM({
            provider: config.provider as 'openai' | 'openrouter' | 'anthropic',
            apiKey: config.apiKey,
            model: config.model || 'anthropic/claude-sonnet-4',
            endpoint: config.endpoint,
            userPrompt: prompt.user,
            systemPrompt: prompt.system,
            maxTokens
        });
        return response.trim();
    } catch (error) {
        console.error('Failed to generate TV description part:', error);
        return '';
    }
}

// ============================================================================
// EMBEDDING TEXT BUILDER (Comprehensive Schema)
// ============================================================================

/**
 * Complete TV show data for embedding generation
 * Includes all fields needed for the comprehensive schema
 */
export interface TvShowEmbeddingData {
    // Core identity
    title: string;
    release_year?: number;
    end_year?: number;

    // Type info
    status?: string;              // "Returning Series", "Ended", etc.
    content_rating?: string;      // "TV-MA", "TV-14", etc.
    runtime?: number;             // Average episode runtime in minutes

    // Categorical
    genres?: string[];
    keywords?: string[];          // TMDB keywords

    // AI-generated tags (from 4-bucket taxonomy)
    tags?: {
        sub_genres?: string[];
        tropes?: string[];
        mood?: string[];
        format?: string[];
    };

    // AI-generated descriptions (cached LLM output)
    description_parts?: {
        premise?: string;
        themes?: string;
        tone?: string;
        style?: string;
    };

    // Tagline
    tagline?: string;

    // Stats
    number_of_seasons?: number;
    number_of_episodes?: number;

    // Production
    networks?: string[];
    production_companies?: string[];
    created_by?: string[];

    // Cast with roles
    cast_with_characters?: Array<{ name: string; character: string }>;

    // Cast (simple string array for backward compatibility)
    cast?: string[];

    // Category type (for filtering/routing)
    category_type?: string;

    // Extended metadata for rehydration workflow
    metadata?: {
        number_of_seasons?: number;
        number_of_episodes?: number;
        status?: string;
        vote_average?: number;
        last_air_date?: string;
        next_episode_to_air?: any;
        networks?: string[];
        [key: string]: any;  // Allow additional metadata fields
    };

    // Ratings & Awards
    awards?: string;
    imdb_rating?: number;
    imdb_votes?: number;
    rt_score?: number;
}

/**
 * Build comprehensive embedding text for TV shows
 * 
 * Schema Design Principles:
 * - "Topic Lock" keywords in first ~50 tokens for semantic anchoring
 * - Structured sections for different signal types
 * - "Vibe Match" tags (tropes, mood) for similarity clustering
 * - Credits at end for entity matching without dominating
 * 
 * Used by:
 * - Initial harvesting (full generation)
 * - Re-hydration (cached descriptions + fresh stats)
 */
export function buildTvShowEmbeddingText(item: TvShowEmbeddingData): string {
    const lines: string[] = [];

    // =========================================================================
    // TITLE LINE: Identity with temporal context
    // =========================================================================
    const yearRange = item.end_year && item.end_year !== item.release_year
        ? `${item.release_year || '?'}-${item.end_year}`
        : item.release_year
            ? `${item.release_year}-`
            : '';

    lines.push(`Title: ${item.title}${yearRange ? ` (${yearRange})` : ''}`);

    // =========================================================================
    // TYPE LINE: Quick classification signals
    // =========================================================================
    const typeParts: string[] = ['TV Show'];
    if (item.status) typeParts.push(item.status);
    if (item.content_rating) typeParts.push(item.content_rating);
    if (item.runtime) typeParts.push(`${item.runtime}min avg`);
    lines.push(`Type: ${typeParts.join(' | ')}`);

    // =========================================================================
    // GENRES LINE
    // =========================================================================
    if (item.genres?.length) {
        lines.push(`Genres: ${item.genres.join(', ')}`);
    }

    // =========================================================================
    // KEYWORDS (TOPIC LOCK) - Critical first ~50 tokens
    // Combines sub_genres, format tags, and TMDB keywords for semantic anchoring
    // =========================================================================
    const keywordParts: string[] = [];
    if (item.tags?.sub_genres?.length) {
        keywordParts.push(...item.tags.sub_genres);
    }
    if (item.tags?.format?.length) {
        keywordParts.push(...item.tags.format);
    }
    if (item.keywords?.length) {
        // Add TMDB keywords, avoiding duplicates
        const existing = new Set(keywordParts.map(k => k.toLowerCase()));
        const tmdbKeywords = item.keywords
            .filter(k => !existing.has(k.toLowerCase()))
            .slice(0, 10);
        keywordParts.push(...tmdbKeywords);
    }
    if (keywordParts.length) {
        lines.push(`Keywords: ${keywordParts.join(', ')}`);
    }

    // =========================================================================
    // [THE HOOK] - Tagline and Premise
    // =========================================================================
    lines.push('');
    lines.push('[THE HOOK]');

    if (item.tagline) {
        lines.push(`Tagline: ${item.tagline}`);
    }
    if (item.description_parts?.premise) {
        lines.push(`Premise: ${item.description_parts.premise}`);
    }

    // =========================================================================
    // [ANALYSIS] - Vibe Match tags and thematic content
    // =========================================================================
    lines.push('');
    lines.push('[ANALYSIS]');

    // Tropes (narrative DNA - critical for similarity)
    if (item.tags?.tropes?.length) {
        lines.push(`Tropes: ${item.tags.tropes.join(', ')}`);
    }

    // Mood (emotional signature - critical for vibe matching)
    if (item.tags?.mood?.length) {
        lines.push(`Mood: ${item.tags.mood.join(', ')}`);
    }

    // AI-generated thematic analysis
    if (item.description_parts?.themes) {
        lines.push(`Themes: ${item.description_parts.themes}`);
    }
    if (item.description_parts?.tone) {
        lines.push(`Tone: ${item.description_parts.tone}`);
    }
    if (item.description_parts?.style) {
        lines.push(`Style: ${item.description_parts.style}`);
    }

    // =========================================================================
    // [FORMAT] - Stats and production context
    // =========================================================================
    lines.push('');
    lines.push('[FORMAT]');

    const statsParts: string[] = [];
    if (item.number_of_seasons) statsParts.push(`${item.number_of_seasons} Seasons`);
    if (item.number_of_episodes) statsParts.push(`${item.number_of_episodes} Episodes`);
    if (statsParts.length) {
        lines.push(`Stats: ${statsParts.join(', ')}`);
    }

    if (item.networks?.length) {
        lines.push(`Network: ${item.networks.join(', ')}`);
    }
    if (item.production_companies?.length) {
        lines.push(`Studio: ${item.production_companies.slice(0, 3).join(', ')}`);
    }

    // =========================================================================
    // [ACCLAIM] - Ratings and awards
    // =========================================================================
    const hasAcclaim = item.awards || item.imdb_rating || item.rt_score;
    if (hasAcclaim) {
        lines.push('');
        lines.push('[ACCLAIM]');

        if (item.awards) {
            lines.push(`Awards: ${item.awards}`);
        }

        const ratingParts: string[] = [];
        if (item.imdb_rating) {
            const votes = item.imdb_votes
                ? ` (${item.imdb_votes.toLocaleString()})`
                : '';
            ratingParts.push(`IMDb ${item.imdb_rating}${votes}`);
        }
        if (item.rt_score) {
            ratingParts.push(`RT ${item.rt_score}%`);
        }
        if (ratingParts.length) {
            lines.push(`Ratings: ${ratingParts.join(' | ')}`);
        }
    }

    // =========================================================================
    // [CREDITS] - Entity names for relationship clustering
    // =========================================================================
    const hasCredits = item.created_by?.length || item.cast_with_characters?.length;
    if (hasCredits) {
        lines.push('');
        lines.push('[CREDITS]');

        if (item.created_by?.length) {
            lines.push(`Created By: ${item.created_by.join(', ')}`);
        }

        if (item.cast_with_characters?.length) {
            const castStr = item.cast_with_characters
                .slice(0, 8)
                .map(c => c.character ? `${c.name} as ${c.character}` : c.name)
                .join(', ');
            lines.push(`Cast: ${castStr}`);
        }
    }

    // Filter empty lines at start/end and join
    return lines.filter((line, i) => {
        // Keep non-empty lines
        if (line.trim()) return true;
        // Keep empty lines only if they're between sections
        return i > 0 && i < lines.length - 1;
    }).join('\n');
}

// ============================================================================
// OPTIMIZED VECTOR TEXT BUILDER (For Embedding Only)
// ============================================================================

/**
 * Build optimized vector text for TV show embeddings
 * 
 * Uses "Prefix Fusion" Strategy:
 * - Transformer models prioritize beginning of text (attention window bias)
 * - Put STRUCTURAL TAGS first to anchor the embedding
 * - Put SEMANTIC SUMMARY after to refine placement within structural cluster
 * 
 * Token Limit: 750 tokens max (enforced via word count × 1.3 approximation)
 * This prevents "Vector Dilution" where generic content washes out key signals.
 * 
 * Format: "Format: SCRIPTED_SINGLE_CAM | Type: NARRATIVE | Archetypes: ... | Summary: ..."
 * 
 * Excludes: Premise, Tone paragraphs, Style paragraphs (too flowery for vectors)
 */

// ============================================================================
// TOKEN LIMIT CONSTANTS (Extensible - adjust limits here)
// ============================================================================

const MAX_VECTOR_TOKENS = 1024;          // Voyage-4 optimal range for semantic density
const WORDS_TO_TOKENS_RATIO = 1.5;       // Conservative: accounts for technical terms (was 1.3)
const MAX_WORDS = Math.floor(MAX_VECTOR_TOKENS / WORDS_TO_TOKENS_RATIO);  // ~682 words

/**
 * Estimate token count from text (word count × 1.5)
 * Conservative ratio to avoid overflow with technical terms like "Targaryen"
 * For exact counts, consider using a tokenizer library (gpt-tokenizer, tiktoken)
 */
function estimateTokens(text: string): number {
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    return Math.ceil(wordCount * WORDS_TO_TOKENS_RATIO);
}

/**
 * Truncate text to fit within token limit (at sentence boundary)
 */
function truncateToTokenLimit(text: string, maxTokens: number): string {
    const currentTokens = estimateTokens(text);
    if (currentTokens <= maxTokens) {
        return text;
    }

    // Truncate at sentence boundary
    const sentences = text.split(/(?<=[.!?])\s+/);
    let result = '';
    let tokenCount = 0;

    for (const sentence of sentences) {
        const sentenceTokens = estimateTokens(sentence);
        if (tokenCount + sentenceTokens > maxTokens) {
            break;
        }
        result += (result ? ' ' : '') + sentence;
        tokenCount += sentenceTokens;
    }

    return result || text.slice(0, Math.floor(maxTokens / WORDS_TO_TOKENS_RATIO) * 5);
}

export function buildTvShowVectorText(item: TvShowEmbeddingData & {
    semanticSummary?: string;
    bucketType?: TvBucket;
    genreLens?: GenreLens;
    formatType?: TvFormat;       // 6-label format taxonomy
    archetypes?: string;         // LLM-translated archetypes
    franchiseType?: string;      // NEW: Save the Cat franchise type
}): string {
    // =========================================================================
    // SUPER-DOCUMENT TEMPLATE (Per Semantic Media Intelligence Blueprint)
    // 
    // Uses labeled sections instead of pipe-delimited format.
    // Voyage-4's 32k context captures relationships between fields.
    // Critical identifiers placed first for attention weight.
    // =========================================================================

    const sections: string[] = [];

    // 1. TITLE (Most important for identity)
    if (item.title) {
        sections.push(`Title: ${item.title}`);
    }

    // 2. GENRES (Core classification)
    if (item.genres?.length) {
        sections.push(`Genre: ${item.genres.join(', ')}`);
    }

    // 3. FRANCHISE TYPE (Save the Cat narrative engine - NEW, HIGH VALUE)
    if (item.franchiseType && item.franchiseType !== 'UNKNOWN') {
        sections.push(`Franchise Type: ${item.franchiseType}`);
    }

    // 4. FORMAT TYPE (6-label production taxonomy)
    if (item.formatType && item.formatType !== 'UNKNOWN') {
        sections.push(`Format: ${item.formatType}`);
    }

    // 5. BUCKET TYPE (3-bucket classification)
    if (item.bucketType) {
        sections.push(`Type: ${item.bucketType}`);
    }

    // 6. GENRE LENS (Soft routing within NARRATIVE)
    if (item.genreLens && item.genreLens !== 'GENERAL') {
        sections.push(`Lens: ${item.genreLens}`);
    }

    // 7. ARCHETYPES (Character dynamics)
    if (item.archetypes) {
        sections.push(`Key Characters: ${item.archetypes}`);
    }

    // 8. PREMISE/SUMMARY (Semantic core)
    if (item.semanticSummary) {
        sections.push(`Premise: ${item.semanticSummary}`);
    }

    // 9. TROPES (Narrative DNA)
    if (item.tags?.tropes?.length) {
        sections.push(`Tropes: ${item.tags.tropes.join(', ')}`);
    }

    // 10. MOOD (Emotional signature)
    if (item.tags?.mood?.length) {
        sections.push(`Mood: ${item.tags.mood.join(', ')}`);
    }

    // 11. SUB-GENRES (Niche classification)
    if (item.tags?.sub_genres?.length) {
        sections.push(`Sub-Genres: ${item.tags.sub_genres.join(', ')}`);
    }

    // 12. PACING TAGS (Structure descriptors)
    if (item.tags?.format?.length) {
        sections.push(`Pacing: ${item.tags.format.join(', ')}`);
    }

    // 13. KEYWORDS (Topic anchors - deduplicated)
    if (item.keywords?.length) {
        const existingTags = new Set([
            ...(item.tags?.sub_genres || []),
            ...(item.tags?.tropes || []),
            ...(item.tags?.mood || []),
            ...(item.tags?.format || [])
        ].map(t => t.toLowerCase()));

        const uniqueKeywords = item.keywords
            .filter(k => !existingTags.has(k.toLowerCase()))
            .slice(0, 8);
        if (uniqueKeywords.length) {
            sections.push(`Keywords: ${uniqueKeywords.join(', ')}`);
        }
    }

    // Combine with newlines for clear section separation
    // This format works better with transformer attention than pipe-delimited

    // =========================================================================
    // DYNAMIC COMPRESSION (Priority-based section dropping)
    // Drop lower-signal sections before truncating high-value content
    // 
    // Priority (lowest dropped first): Keywords → Pacing → Sub-Genres → Mood → Tropes
    // Never drop: Title, Genre, Franchise Type, Format, Type, Lens, Archetypes, Premise
    // =========================================================================

    // Build sections with priority markers for dynamic dropping
    type Section = { key: string; priority: number; content: string };
    const prioritizedSections: Section[] = [];

    // HIGH PRIORITY - Never drop (priority 1-5)
    if (item.title) prioritizedSections.push({ key: 'title', priority: 1, content: `Title: ${item.title}` });
    if (item.genres?.length) prioritizedSections.push({ key: 'genre', priority: 2, content: `Genre: ${item.genres.join(', ')}` });
    if (item.franchiseType && item.franchiseType !== 'UNKNOWN') prioritizedSections.push({ key: 'franchise', priority: 3, content: `Franchise Type: ${item.franchiseType}` });
    if (item.formatType && item.formatType !== 'UNKNOWN') prioritizedSections.push({ key: 'format', priority: 4, content: `Format: ${item.formatType}` });
    if (item.bucketType) prioritizedSections.push({ key: 'bucket', priority: 5, content: `Type: ${item.bucketType}` });
    if (item.genreLens && item.genreLens !== 'GENERAL') prioritizedSections.push({ key: 'lens', priority: 6, content: `Lens: ${item.genreLens}` });
    if (item.archetypes) prioritizedSections.push({ key: 'archetypes', priority: 7, content: `Key Characters: ${item.archetypes}` });

    // MEDIUM PRIORITY - High semantic value (priority 8-11)
    if (item.semanticSummary) prioritizedSections.push({ key: 'premise', priority: 8, content: `Premise: ${item.semanticSummary}` });
    if (item.tags?.tropes?.length) prioritizedSections.push({ key: 'tropes', priority: 9, content: `Tropes: ${item.tags.tropes.join(', ')}` });
    // Sub-Genres before Mood: "Cyberpunk" is more searchable than "Gritty"
    if (item.tags?.sub_genres?.length) prioritizedSections.push({ key: 'subgenres', priority: 10, content: `Sub-Genres: ${item.tags.sub_genres.join(', ')}` });
    if (item.tags?.mood?.length) prioritizedSections.push({ key: 'mood', priority: 11, content: `Mood: ${item.tags.mood.join(', ')}` });

    // LOW PRIORITY - First to be dropped (priority 12-13)
    if (item.tags?.format?.length) prioritizedSections.push({ key: 'pacing', priority: 12, content: `Pacing: ${item.tags.format.join(', ')}` });

    // LOWEST PRIORITY - Keywords with RESCUE logic
    // Rescue unique nouns that don't appear in Summary (e.g., "Chess", "Methamphetamine")
    if (item.keywords?.length) {
        const existingTags = new Set([
            ...(item.tags?.sub_genres || []),
            ...(item.tags?.tropes || []),
            ...(item.tags?.mood || []),
            ...(item.tags?.format || [])
        ].map(t => t.toLowerCase()));

        const summaryLower = (item.semanticSummary || '').toLowerCase();
        const uniqueKeywords = item.keywords.filter(k => !existingTags.has(k.toLowerCase())).slice(0, 8);

        // Rescue keywords that are unique nouns NOT in summary
        const rescuedKeywords = uniqueKeywords.filter(k => !summaryLower.includes(k.toLowerCase()));
        const droppableKeywords = uniqueKeywords.filter(k => summaryLower.includes(k.toLowerCase()));

        // Rescued keywords get higher priority (9.5 - between tropes and subgenres)
        if (rescuedKeywords.length) {
            prioritizedSections.push({ key: 'rescued_keywords', priority: 9.5, content: `Concepts: ${rescuedKeywords.join(', ')}` });
        }
        // Droppable keywords stay lowest priority
        if (droppableKeywords.length) {
            prioritizedSections.push({ key: 'keywords', priority: 13, content: `Keywords: ${droppableKeywords.join(', ')}` });
        }
    }

    // Sort by priority (low number = high priority = keep first)
    prioritizedSections.sort((a, b) => a.priority - b.priority);

    // Build text, dropping lowest-priority sections until under token limit
    let finalSections = [...prioritizedSections];
    let fullText = finalSections.map(s => s.content).join('\n');

    while (estimateTokens(fullText) > MAX_VECTOR_TOKENS && finalSections.length > 5) {
        const dropped = finalSections.pop(); // Drop lowest priority
        if (dropped) {
            console.log(`📉 Dropping low-priority section: ${dropped.key}`);
        }
        fullText = finalSections.map(s => s.content).join('\n');
    }

    // Final truncation if still over limit (rare edge case)
    const finalText = truncateToTokenLimit(fullText, MAX_VECTOR_TOKENS);

    // Log compression stats
    if (finalSections.length < prioritizedSections.length) {
        console.log(`📏 Dynamic compression: ${prioritizedSections.length} → ${finalSections.length} sections`);
    }

    return finalText;
}

