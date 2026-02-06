/**
 * Cliffhanger Detection Module
 * 
 * Detects potential cliffhangers for canceled TV shows using tiered keyword analysis.
 * Integrated with franchise_review_queue for human verification.
 */

// =============================================================================
// TYPES
// =============================================================================

export interface CliffhangerResult {
    isLikely: boolean;
    confidence: number;
    reason: string;
    tier: 'mechanical' | 'structural' | 'narrative' | 'unaired_sequel' | 'none';
}

// =============================================================================
// CLIFFHANGER TIER DEFINITIONS
// =============================================================================

/**
 * Tiered keyword system for cliffhanger detection
 * 
 * MECHANICAL (0.9): Explicit production markers → Auto-apply unresolved-ending
 * STRUCTURAL (0.7): Format indicators → Send to franchise_review_queue
 * NARRATIVE (0.5): Story-level hints → Flag as "Suspected" in UI
 */
export const CLIFFHANGER_TIERS = {
    // Tier 1: Explicit production markers (auto-apply)
    mechanical: {
        confidence: 0.9,
        keywords: [
            'to be continued',
            'cliffhanger',
            'part one', 'part 1', 'part i', 'part two', 'part 2', 'part ii',
            'chapter one', 'chapter 1',
            '...to be concluded',
            'the story continues'
        ]
    },
    // Tier 2: Structural indicators (review queue)
    structural: {
        confidence: 0.7,
        keywords: [
            'season finale',
            'mid-season finale',
            'spring finale',
            'fall finale',
            'winter finale',
            'penultimate',
            'the beginning of the end',
            'everything changes'
        ],
        // Negative modifiers that reduce confidence
        negatives: ['series finale', 'final episode', 'the end', 'farewell', 'goodbye']
    },
    // Tier 3: Narrative hints (suspected)
    narrative: {
        confidence: 0.5,
        keywords: [
            'unresolved',
            'mystery remains',
            'unanswered questions',
            'left wondering',
            'open-ended',
            'hanging in the balance',
            'what happens next',
            'the truth is out there',
            'it\'s not over',
            'just the beginning',
            'only the beginning',
            'the journey continues',
            'secrets revealed',
            'who will survive',
            'the battle begins',
            'war is coming',
            'they\'re coming'
        ]
    }
};

// =============================================================================
// DETECTION FUNCTION
// =============================================================================

/**
 * Detect potential cliffhanger for Canceled shows with tiered confidence
 * 
 * @param status - Show status (only triggers for 'Canceled')
 * @param finalEpisode - Metadata of the last aired episode
 * @param nextEpisode - Optional metadata of the next unaired episode (for multi-part detection)
 * @returns Detection result with confidence score, reason, and tier
 */
export function detectPotentialCliffhanger(
    status: string,
    finalEpisode: { name: string; overview?: string },
    nextEpisode?: { name: string; air_date?: string | null }
): CliffhangerResult {
    // Only analyze Canceled shows (Ended implies planned conclusion)
    if (status !== 'Canceled' && status !== 'Cancelled') {
        return { isLikely: false, confidence: 0, reason: '', tier: 'none' };
    }

    const episodeText = `${finalEpisode.name} ${finalEpisode.overview || ''}`.toLowerCase();

    // Check for negative modifiers first (series finale = planned ending)
    const hasNegative = CLIFFHANGER_TIERS.structural.negatives.some(neg =>
        episodeText.includes(neg)
    );
    if (hasNegative) {
        return {
            isLikely: false,
            confidence: 0.1,
            reason: 'Marked as intentional finale',
            tier: 'none'
        };
    }

    // TIER 0: Unaired Sequel (1.0) - Definite cliffhanger (v4.3)
    // Check if a "Part Two" exists in metadata but is unaired
    const mechanicalMatch = CLIFFHANGER_TIERS.mechanical.keywords.find(kw =>
        episodeText.includes(kw)
    );

    if (mechanicalMatch && nextEpisode) {
        const partTwoPattern = /part (two|2|ii)/i;
        const hasPartTwo = partTwoPattern.test(nextEpisode.name);
        const isUnaired = !nextEpisode.air_date || new Date(nextEpisode.air_date) > new Date();

        if (hasPartTwo && isUnaired) {
            return {
                isLikely: true,
                confidence: 1.0,
                reason: `Multi-part finale incomplete: "${finalEpisode.name}" → "${nextEpisode.name}" (unaired)`,
                tier: 'unaired_sequel'
            };
        }
    }

    // TIER 1: Mechanical (0.9) - Auto-apply
    if (mechanicalMatch) {
        return {
            isLikely: true,
            confidence: 0.9,
            reason: `Mechanical marker: "${mechanicalMatch}"`,
            tier: 'mechanical'
        };
    }

    // TIER 2: Structural (0.7) - Review queue
    const structuralMatches = CLIFFHANGER_TIERS.structural.keywords.filter(kw =>
        episodeText.includes(kw)
    );
    if (structuralMatches.length > 0) {
        // Boost confidence for "Season Finale" specifically
        const isSeasonFinale = structuralMatches.includes('season finale');
        return {
            isLikely: true,
            confidence: isSeasonFinale ? 0.75 : 0.7,
            reason: `Structural: ${structuralMatches.join(', ')} (Canceled status)`,
            tier: 'structural'
        };
    }

    // TIER 3: Narrative (0.5) - Suspected
    const narrativeMatches = CLIFFHANGER_TIERS.narrative.keywords.filter(kw =>
        episodeText.includes(kw)
    );
    if (narrativeMatches.length > 0) {
        // Stack confidence for multiple narrative hints (max 0.65)
        const confidence = Math.min(0.5 + (narrativeMatches.length - 1) * 0.05, 0.65);
        return {
            isLikely: true,
            confidence,
            reason: `Narrative hints: ${narrativeMatches.join(', ')}`,
            tier: 'narrative'
        };
    }

    // No signals detected, but still Canceled
    return { isLikely: false, confidence: 0.2, reason: 'Canceled with no cliffhanger signals', tier: 'none' };
}
