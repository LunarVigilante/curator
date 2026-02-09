/**
 * Canonical Tag Registry for TV Shows
 * 
 * A curated vocabulary of ~200 tags across 4 buckets.
 * Used by:
 * - Tag generation (post-processing: fuzzy match LLM output to canonical tags)
 * - Tag deduplication (merge near-duplicate tags to canonical forms)
 * 
 * Design:
 * - Tags are organized by bucket (sub_genres, tropes, mood, format)
 * - Each tag is lowercase, single-concept (no compound phrases)
 * - The LLM is given examples per bucket as style guidance
 * - Post-processing fuzzy-matches output to this registry
 * - Up to 2 "wildcard" tags per item for novel concepts
 */

// ============================================================================
// CANONICAL TAGS BY BUCKET
// ============================================================================

export const CANONICAL_SUB_GENRES = [
    // Drama variants
    'prestige drama', 'family drama', 'workplace drama', 'legal drama',
    'medical drama', 'political drama', 'period drama', 'war drama',
    'courtroom drama', 'teen drama', 'social drama', 'ensemble drama',
    'domestic drama', 'romantic drama', 'historical drama',
    // Thriller / Suspense
    'political thriller', 'psychological thriller', 'crime thriller',
    'spy thriller', 'techno-thriller', 'erotic thriller', 'eco-thriller',
    // Crime
    'crime drama', 'detective fiction', 'police procedural', 'true crime',
    'heist', 'noir', 'nordic noir', 'neo-noir', 'hardboiled',
    // Comedy
    'workplace comedy', 'romantic comedy', 'dark comedy', 'satirical comedy',
    'sketch comedy', 'animated comedy', 'sitcom', 'cringe comedy',
    'absurdist comedy', 'stoner comedy', 'improv comedy', 'variety show',
    // Sci-Fi / Fantasy
    'space opera', 'cyberpunk', 'dystopia', 'post-apocalyptic',
    'hard sci-fi', 'soft sci-fi', 'urban fantasy', 'high fantasy',
    'dark fantasy', 'supernatural', 'alternate history', 'steampunk',
    'time travel', 'alien invasion', 'mecha',
    // Horror
    'psychological horror', 'body horror', 'folk horror', 'slasher',
    'cosmic horror', 'survival horror', 'gothic horror', 'creature feature',
    'haunted house', 'zombie',
    // Reality / Unscripted
    'reality competition', 'dating show', 'cooking competition',
    'makeover show', 'talent show', 'game show', 'talk show',
    'docuseries', 'docudrama', 'mockumentary', 'travel show',
    'home renovation', 'nature documentary',
    // Cultural / Regional
    'k-drama', 'j-drama', 'telenovela', 'cdrama', 'wuxia', 'xianxia',
    'tokusatsu', 'anime', 'bollywood', 'brit drama',
    // Other
    'soap opera', 'melodrama', 'coming-of-age', 'musical',
    'sports drama', 'western', 'adventure', 'espionage',
    'biopic', 'mockumentary', 'found footage',
    'superhero', 'kaiju', 'martial arts', 'heist comedy',
] as const;

export const CANONICAL_TROPES = [
    // Relationship dynamics
    'found family', 'enemies to lovers', 'star-crossed lovers',
    'love triangle', 'forbidden love', 'slow burn romance',
    'friends to lovers', 'rivals to allies', 'mentor and protégé',
    'buddy dynamics', 'bromance', 'odd couple', 'sibling rivalry',
    'dysfunctional family', 'toxic relationship', 'power couple',
    // Character archetypes
    'anti-hero', 'unreliable narrator', 'chosen one', 'reluctant hero',
    'tragic hero', 'femme fatale', 'trickster', 'dark messiah',
    'fallen idol', 'prodigal return', 'underdog', 'lone wolf',
    'mad scientist', 'corrupt official', 'lovable rogue',
    // Narrative patterns
    'fish out of water', 'rags to riches', 'fall from grace',
    'revenge plot', 'redemption arc', 'dark secret', 'double life',
    'survival against odds', 'locked room', 'time loop',
    'con artist', 'identity crisis', 'imposter syndrome',
    'moral dilemma', 'impossible choice', 'deal with the devil',
    'race against time', 'power corrupts', 'cycle of violence',
    'generational trauma', 'nature vs nurture', 'class conflict',
    'culture clash', 'whistleblower', 'cover-up', 'conspiracy',
    'whodunit', 'cold case', 'body count', 'cat and mouse',
    'heist gone wrong', 'the long con', 'framed protagonist',
    'MacGuffin', 'prophecy', 'tournament arc', 'training arc',
    'amnesia plot', 'doppelganger', 'gaslighting',
] as const;

export const CANONICAL_MOODS = [
    // Tension / Dark
    'tense', 'claustrophobic', 'bleak', 'oppressive', 'dread-filled',
    'menacing', 'paranoid', 'ominous', 'gritty', 'brutal',
    'visceral', 'suffocating',
    // Cerebral / Thoughtful
    'cerebral', 'contemplative', 'philosophical', 'introspective',
    'meditative', 'existential', 'thought-provoking',
    // Light / Warm
    'heartwarming', 'cozy', 'whimsical', 'charming', 'lighthearted',
    'uplifting', 'feel-good', 'playful', 'quirky', 'irreverent',
    // Emotional
    'melancholic', 'bittersweet', 'poignant', 'elegiac', 'wistful',
    'romantic', 'passionate', 'sentimental', 'cathartic',
    // Stylistic
    'atmospheric', 'surreal', 'dreamlike', 'hallucinatory',
    'fever dream', 'neon-drenched', 'sun-drenched', 'gothic',
    'operatic', 'cinematic', 'stylized', 'minimalist',
    // Edge / Provocative
    'provocative', 'darkly comedic', 'sardonic', 'campy',
    'transgressive', 'subversive', 'absurdist', 'satirical',
    'self-aware', 'meta', 'tongue-in-cheek',
    // Energy
    'adrenaline-fueled', 'frenetic', 'explosive', 'chaotic',
    'languid', 'hypnotic', 'eerie', 'unsettling', 'nostalgic',
] as const;

export const CANONICAL_FORMATS = [
    'serialized', 'procedural', 'anthology', 'limited series',
    'miniseries', 'slow-burn', 'binge-worthy', 'bottle episodes',
    'single-camera', 'multi-camera', 'mockumentary format',
    'hybrid format', 'cold open', 'chapter-based', 'web series',
    'prestige limited series', 'episodic', 'arc-based',
    'nonlinear timeline', 'parallel storylines', 'vignettes',
] as const;

// ============================================================================
// COMBINED REGISTRY
// ============================================================================

export const ALL_CANONICAL_TAGS = [
    ...CANONICAL_SUB_GENRES,
    ...CANONICAL_TROPES,
    ...CANONICAL_MOODS,
    ...CANONICAL_FORMATS,
] as const;

export type CanonicalTag = typeof ALL_CANONICAL_TAGS[number];

/**
 * Flat set for O(1) lookup
 */
export const CANONICAL_TAG_SET = new Set<string>(
    ALL_CANONICAL_TAGS.map(t => t.toLowerCase())
);

// ============================================================================
// FUZZY MATCHING
// ============================================================================

/**
 * Common alias mappings for tags the LLM tends to generate
 * Maps variant → canonical form
 */
const TAG_ALIASES: Record<string, string> = {
    // Found family variants
    'found family dynamics': 'found family',
    'found-family': 'found family',
    'chosen family': 'found family',
    'surrogate family': 'found family',
    // Slow-burn variants
    'slow burn': 'slow-burn',
    'slow-burn serialized': 'serialized',
    'slow-burn mystery': 'slow-burn',
    'slow-burn thriller': 'slow-burn',
    'slow-burn character study': 'slow-burn',
    'serialized slow burn': 'slow-burn',
    'slow-burn miniseries': 'miniseries',
    // Cerebral variants
    'cerebral yet kinetic': 'cerebral',
    'cerebral yet visceral': 'cerebral',
    'cerebral tension': 'cerebral',
    // Claustrophobic variants
    'claustrophobic intimacy': 'claustrophobic',
    'claustrophobic tension': 'claustrophobic',
    'claustrophobic dread': 'claustrophobic',
    'claustrophobic grandeur': 'claustrophobic',
    // Neon variants
    'neon-noir': 'neo-noir',
    'neon-noir melancholy': 'neo-noir',
    'neon-drenched melancholy': 'neon-drenched',
    // Cinematic/camera variants
    'cinematic single-camera': 'single-camera',
    'single-camera cinematic': 'single-camera',
    'single-camera realism': 'single-camera',
    'single-camera intimacy': 'single-camera',
    'single-camera sitcom': 'single-camera',
    // Serialized variants
    'serialized mystery': 'serialized',
    'serialized character study': 'serialized',
    'serialized episodic': 'serialized',
    'serialized procedural': 'procedural',
    'serialized with episodic arcs': 'serialized',
    // Bittersweet variants
    'bittersweet nostalgia': 'bittersweet',
    // Format compounds
    'prestige limited series': 'limited series',
    'high-contrast visual storytelling': 'cinematic',
    // Style compounds
    'gritty yet whimsical': 'gritty',
    'darkly comedic satire': 'darkly comedic',
    'whimsical melancholy': 'bittersweet',
};

/**
 * Compute Levenshtein edit distance between two strings
 */
function editDistance(a: string, b: string): number {
    const m = a.length;
    const n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
    }
    return dp[m][n];
}

/**
 * Find the best canonical match for a tag, using:
 * 1. Exact match in canonical set
 * 2. Alias lookup
 * 3. Substring containment (canonical tag is contained in input)
 * 4. Levenshtein distance (threshold: 3 edits for tags > 6 chars, 2 for shorter)
 * 
 * Returns the canonical tag or null if no good match found (wildcard).
 */
export function matchCanonicalTag(input: string): string | null {
    const normalized = input.toLowerCase().trim();

    // 1. Exact match
    if (CANONICAL_TAG_SET.has(normalized)) return normalized;

    // 2. Alias lookup
    if (TAG_ALIASES[normalized]) return TAG_ALIASES[normalized];

    // 3. Substring containment — if a canonical tag is fully contained in the input
    // Prefer longer matches (more specific)
    let bestSubstring: string | null = null;
    let bestLen = 0;
    for (const canonical of ALL_CANONICAL_TAGS) {
        const lower = canonical.toLowerCase();
        if (normalized.includes(lower) && lower.length > bestLen) {
            bestSubstring = lower;
            bestLen = lower.length;
        }
    }
    if (bestSubstring && bestLen >= 4) return bestSubstring;

    // 4. Levenshtein distance
    let bestMatch: string | null = null;
    let bestDist = Infinity;
    const threshold = normalized.length > 6 ? 3 : 2;

    for (const canonical of ALL_CANONICAL_TAGS) {
        const lower = canonical.toLowerCase();
        const dist = editDistance(normalized, lower);
        if (dist < bestDist) {
            bestDist = dist;
            bestMatch = lower;
        }
    }

    if (bestDist <= threshold && bestMatch) return bestMatch;

    // No match — this is a wildcard tag
    return null;
}

/**
 * Process raw LLM tag output through the canonical registry.
 * Returns an array of canonical + wildcard tags (max 2 wildcards).
 * 
 * @param rawTags - Raw tag strings from LLM
 * @param maxWildcards - Maximum number of non-canonical tags to keep (default 2)
 * @returns Deduplicated array of canonical tags + limited wildcards
 */
export function canonicalizeTags(
    rawTags: string[],
    maxWildcards: number = 2
): string[] {
    const result = new Set<string>();
    const wildcards: string[] = [];

    for (const raw of rawTags) {
        const normalized = raw.toLowerCase().trim();
        if (!normalized || normalized.length < 3) continue;

        const canonical = matchCanonicalTag(normalized);
        if (canonical) {
            result.add(canonical);
        } else {
            wildcards.push(normalized);
        }
    }

    // Add limited wildcards
    for (const wc of wildcards.slice(0, maxWildcards)) {
        result.add(wc);
    }

    return [...result];
}
