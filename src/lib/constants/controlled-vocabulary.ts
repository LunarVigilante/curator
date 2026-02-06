/**
 * Controlled Vocabulary for TV Show Classification
 * 
 * Canonical lists of moods, themes, and other facets for consistent tagging.
 * LLM-generated tags are normalized to these controlled vocabularies.
 */

/**
 * Canonical mood vocabulary (50+ terms)
 * 
 * Moods describe the emotional atmosphere and viewing experience.
 * Based on Gracenote-style emotional descriptors.
 */
export const CANONICAL_MOODS = [
    // Positive/Light
    'heartwarming', 'uplifting', 'hopeful', 'joyful', 'cozy', 'whimsical',
    'playful', 'charming', 'feel-good', 'lighthearted', 'comforting',

    // Tense/Thrilling
    'suspenseful', 'tense', 'gripping', 'intense', 'edge-of-seat', 'nail-biting',
    'heart-pounding', 'adrenaline-fueled', 'pulse-quickening',

    // Dark/Heavy
    'dark', 'bleak', 'grim', 'harrowing', 'devastating', 'tragic', 'somber',
    'melancholic', 'haunting', 'ominous', 'unsettling', 'disturbing', 'visceral',

    // Cerebral/Thoughtful
    'cerebral', 'thought-provoking', 'contemplative', 'reflective', 'philosophical',
    'introspective', 'mind-bending', 'enigmatic', 'provocative',

    // Humor
    'witty', 'sardonic', 'wry', 'satirical', 'irreverent', 'absurdist', 'campy',
    'dark-comedic', 'deadpan', 'slapstick',

    // Atmospheric
    'atmospheric', 'moody', 'dreamy', 'surreal', 'hypnotic', 'ethereal',
    'eerie', 'gothic', 'noir', 'gritty', 'raw', 'immersive',

    // Emotional
    'emotional', 'bittersweet', 'poignant', 'touching', 'tearjerker',
    'nostalgic', 'romantic', 'passionate', 'euphoric', 'zen',
] as const;

export type CanonicalMood = typeof CANONICAL_MOODS[number];

/**
 * Canonical theme vocabulary (30+ terms)
 * 
 * Themes are the central ideas, messages, or subjects explored.
 */
export const CANONICAL_THEMES = [
    // Personal Growth
    'coming-of-age', 'identity', 'self-discovery', 'transformation', 'redemption',
    'healing', 'resilience', 'empowerment',

    // Relationships
    'family', 'friendship', 'love', 'loyalty', 'betrayal', 'forgiveness',
    'found-family', 'parenthood', 'marriage', 'rivalry',

    // Society & Power
    'power', 'corruption', 'injustice', 'class-struggle', 'inequality',
    'freedom', 'oppression', 'revolution', 'justice', 'truth',

    // Existential
    'mortality', 'legacy', 'destiny', 'fate', 'meaning-of-life', 'grief',
    'loss', 'hope', 'despair', 'faith',

    // Conflict
    'survival', 'war', 'revenge', 'ambition', 'obsession', 'sacrifice',
    'secrets', 'deception', 'trust', 'consequences',

    // Moral
    'good-vs-evil', 'moral-ambiguity', 'ethics', 'guilt', 'innocence',
    'honor', 'duty', 'temptation',
] as const;

export type CanonicalTheme = typeof CANONICAL_THEMES[number];

/**
 * Pacing descriptors for content structure
 */
export const PACING_VOCABULARY = [
    'slow-burn', 'fast-paced', 'methodical', 'relentless', 'measured',
    'breakneck', 'deliberate', 'binge-worthy', 'episodic', 'serialized',
] as const;

export type PacingDescriptor = typeof PACING_VOCABULARY[number];

/**
 * Normalize raw tags to canonical vocabulary
 * 
 * Uses fuzzy matching to map LLM-generated tags to controlled terms.
 * 
 * @param rawTags - Raw tags from LLM
 * @param vocabulary - Canonical vocabulary to match against
 * @returns Normalized tags from the vocabulary
 */
export function normalizeToCanonical<T extends string>(
    rawTags: string[],
    vocabulary: readonly T[]
): T[] {
    const normalized: T[] = [];
    const vocabSet = new Set(vocabulary);
    const vocabLower = new Map(vocabulary.map(v => [v.toLowerCase(), v]));

    for (const tag of rawTags) {
        const tagLower = tag.toLowerCase().trim();

        // Exact match
        if (vocabSet.has(tag as T)) {
            normalized.push(tag as T);
            continue;
        }

        // Case-insensitive match
        if (vocabLower.has(tagLower)) {
            normalized.push(vocabLower.get(tagLower)!);
            continue;
        }

        // Fuzzy match: check if tag contains or is contained by a vocab term
        for (const vocab of vocabulary) {
            const vocabNorm = vocab.toLowerCase().replace(/-/g, ' ');
            const tagNorm = tagLower.replace(/-/g, ' ');

            if (vocabNorm.includes(tagNorm) || tagNorm.includes(vocabNorm)) {
                normalized.push(vocab);
                break;
            }
        }
    }

    // Deduplicate
    return [...new Set(normalized)];
}

/**
 * Normalize mood tags from LLM output
 */
export function normalizeMoods(rawMoods: string[]): CanonicalMood[] {
    return normalizeToCanonical(rawMoods, CANONICAL_MOODS);
}

/**
 * Normalize theme tags from LLM output
 */
export function normalizeThemes(rawThemes: string[]): CanonicalTheme[] {
    return normalizeToCanonical(rawThemes, CANONICAL_THEMES);
}

/**
 * Synonym mappings for common variations
 */
export const MOOD_SYNONYMS: Record<string, CanonicalMood> = {
    'scary': 'unsettling',
    'creepy': 'eerie',
    'funny': 'witty',
    'hilarious': 'witty',
    'sad': 'melancholic',
    'depressing': 'bleak',
    'exciting': 'gripping',
    'boring': 'contemplative', // Normalize subjective to neutral
    'slow': 'contemplative',
    'spooky': 'eerie',
    'happy': 'uplifting',
    'dark comedy': 'dark-comedic',
    'black comedy': 'dark-comedic',
    'feel good': 'feel-good',
    'edge of seat': 'edge-of-seat',
};

export const THEME_SYNONYMS: Record<string, CanonicalTheme> = {
    'coming of age': 'coming-of-age',
    'good vs evil': 'good-vs-evil',
    'meaning of life': 'meaning-of-life',
    'class warfare': 'class-struggle',
    'social class': 'class-struggle',
    'self discovery': 'self-discovery',
    'found family': 'found-family',
    'moral complexity': 'moral-ambiguity',
    'grey morality': 'moral-ambiguity',
};

/**
 * Apply synonym normalization before vocabulary matching
 */
export function applySynonyms(
    tags: string[],
    synonymMap: Record<string, string>
): string[] {
    return tags.map(tag => {
        const lower = tag.toLowerCase().trim();
        return synonymMap[lower] || tag;
    });
}

/**
 * TVDB-specific synonym mappings
 * 
 * TVDB uses different terminology than our controlled vocabulary.
 * This maps common TVDB tags to our canonical terms.
 */
export const TVDB_SYNONYMS: Record<string, string> = {
    // Genre/Format mappings
    'soap opera': 'melodrama',
    'soap': 'melodrama',
    'sci-fi': 'science-fiction',
    'scifi': 'science-fiction',
    'animated': 'animation',
    'cartoon': 'animation',
    'game-show': 'game-show',
    'reality-tv': 'reality',
    'talk-show': 'talk-show',

    // Mood mappings (TVDB → canonical moods)
    'scary': 'unsettling',
    'horror': 'unsettling',
    'spooky': 'eerie',
    'creepy': 'eerie',
    'funny': 'witty',
    'comedy': 'witty',
    'romantic': 'romantic',
    'romance': 'romantic',
    'dramatic': 'intense',
    'drama': 'intense',
    'action': 'gripping',
    'action-packed': 'adrenaline-fueled',
    'thriller': 'suspenseful',
    'mystery': 'enigmatic',
    'dark': 'dark',
    'gritty': 'gritty',
    'emotional': 'emotional',
    'heartwarming': 'heartwarming',
    'inspiring': 'uplifting',
    'inspirational': 'uplifting',
    'sad': 'melancholic',
    'tragic': 'tragic',
    'psychological': 'cerebral',
    'mind-bending': 'mind-bending',
    'surreal': 'surreal',
    'dystopian': 'bleak',
    'post-apocalyptic': 'bleak',
    'noir': 'noir',
    'campy': 'campy',
    'quirky': 'whimsical',
    'bizarre': 'absurdist',
    'weird': 'absurdist',

    // Theme mappings
    'family': 'family',
    'coming-of-age': 'coming-of-age',
    'teen': 'coming-of-age',
    'revenge': 'revenge',
    'redemption': 'redemption',
    'survival': 'survival',
    'war': 'war',
    'crime': 'injustice',
    'corruption': 'corruption',
    'power': 'power',
    'love': 'love',
    'friendship': 'friendship',
    'betrayal': 'betrayal',
    'adventure': 'survival',
    'superhero': 'good-vs-evil',
    'fantasy': 'destiny',
    'space': 'survival',
};

/**
 * Normalize TVDB semantic tags to our controlled vocabulary
 * 
 * @param tvdbTags - Raw tags from TVDB API
 * @returns Normalized tags that match our canonical vocabulary
 */
export function normalizeTvdbTags(tvdbTags: string[]): string[] {
    // First apply TVDB-specific synonyms
    const withSynonyms = applySynonyms(tvdbTags, TVDB_SYNONYMS);

    // Then try to match against canonical moods and themes
    const normalizedMoods = normalizeToCanonical(withSynonyms, CANONICAL_MOODS);
    const normalizedThemes = normalizeToCanonical(withSynonyms, CANONICAL_THEMES);

    // Combine and deduplicate
    const combined = [...new Set([...normalizedMoods, ...normalizedThemes])];

    // Also keep any tags that passed through synonym mapping but weren't matched
    // (they might be valid sub-genres or format tags)
    const unmatchedButMapped = withSynonyms.filter(tag =>
        !CANONICAL_MOODS.includes(tag.toLowerCase() as any) &&
        !CANONICAL_THEMES.includes(tag.toLowerCase() as any)
    );

    return [...combined, ...unmatchedButMapped.slice(0, 5)]; // Limit unmatched to 5
}
