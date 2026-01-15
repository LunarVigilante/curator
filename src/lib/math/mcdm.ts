/**
 * Multi-Criteria Decision Making (MCDM) Library
 * 
 * Implements:
 * - Borda Count with optional Bayesian smoothing
 * - TOPSIS (Technique for Order of Preference by Similarity to Ideal Solution)
 */

// ============================================================================
// TYPES
// ============================================================================

export interface TierDistribution {
    S?: number;
    A?: number;
    B?: number;
    C?: number;
    D?: number;
    E?: number;
    F?: number;
}

export interface BordaConfig {
    bayesianSmoothing: boolean;
    smoothingVotes?: number; // Number of dummy C-tier votes to add (default: 5)
}

export interface CriterionWeight {
    key: string;
    weight: number;
    beneficial: boolean; // true = higher is better
}

export interface TopsisItem {
    id: string;
    scores: Record<string, number>; // criterion_key -> rating (1-10)
}

export interface TopsisResult {
    id: string;
    topsisScore: number;
    distanceToIdeal: number;
    distanceToWorst: number;
    normalizedScores: Record<string, number>;
}

// ============================================================================
// TIER POINT VALUES
// ============================================================================

const TIER_POINTS: Record<string, number> = {
    S: 7,
    A: 6,
    B: 5,
    C: 4,
    D: 3,
    E: 2,
    F: 1,
};

// ============================================================================
// CRITERIA SCHEMAS BY CATEGORY
// ============================================================================

export const CRITERIA_SCHEMAS: Record<string, CriterionWeight[]> = {
    // Movies
    movie: [
        { key: 'acting', weight: 0.22, beneficial: true },
        { key: 'plot', weight: 0.25, beneficial: true },
        { key: 'cinematography', weight: 0.18, beneficial: true },
        { key: 'soundtrack', weight: 0.15, beneficial: true },
        { key: 'pacing', weight: 0.20, beneficial: true },
    ],

    // TV Shows
    tv_show: [
        { key: 'acting', weight: 0.20, beneficial: true },
        { key: 'writing', weight: 0.25, beneficial: true },
        { key: 'character_development', weight: 0.20, beneficial: true },
        { key: 'binge_worthiness', weight: 0.15, beneficial: true },
        { key: 'production', weight: 0.20, beneficial: true },
    ],

    // Video Games
    video_game: [
        { key: 'gameplay', weight: 0.30, beneficial: true },
        { key: 'graphics', weight: 0.15, beneficial: true },
        { key: 'story', weight: 0.20, beneficial: true },
        { key: 'replayability', weight: 0.20, beneficial: true },
        { key: 'sound_design', weight: 0.15, beneficial: true },
    ],

    // Board Games
    board_game: [
        { key: 'strategy_depth', weight: 0.25, beneficial: true },
        { key: 'accessibility', weight: 0.20, beneficial: true },
        { key: 'replayability', weight: 0.20, beneficial: true },
        { key: 'theme_integration', weight: 0.15, beneficial: true },
        { key: 'component_quality', weight: 0.20, beneficial: true },
    ],

    // Books
    book: [
        { key: 'writing_style', weight: 0.25, beneficial: true },
        { key: 'plot', weight: 0.25, beneficial: true },
        { key: 'characters', weight: 0.20, beneficial: true },
        { key: 'world_building', weight: 0.15, beneficial: true },
        { key: 'pacing', weight: 0.15, beneficial: true },
    ],

    // Podcasts
    podcast: [
        { key: 'host_chemistry', weight: 0.25, beneficial: true },
        { key: 'content_depth', weight: 0.25, beneficial: true },
        { key: 'audio_engineering', weight: 0.15, beneficial: true },
        { key: 'flow', weight: 0.20, beneficial: true },
        { key: 'consistency', weight: 0.15, beneficial: true },
    ],

    // Comics/Manga
    comic: [
        { key: 'art_quality', weight: 0.25, beneficial: true },
        { key: 'panel_layout', weight: 0.15, beneficial: true },
        { key: 'story_arc', weight: 0.25, beneficial: true },
        { key: 'character_consistency', weight: 0.20, beneficial: true },
        { key: 'lettering_translation', weight: 0.15, beneficial: true },
    ],
    manga: [
        { key: 'art_quality', weight: 0.25, beneficial: true },
        { key: 'panel_layout', weight: 0.15, beneficial: true },
        { key: 'story_arc', weight: 0.25, beneficial: true },
        { key: 'character_consistency', weight: 0.20, beneficial: true },
        { key: 'lettering_translation', weight: 0.15, beneficial: true },
    ],

    // Light Novels
    light_novel: [
        { key: 'prose_translation', weight: 0.25, beneficial: true },
        { key: 'character_tropes', weight: 0.20, beneficial: true },
        { key: 'illustration_integration', weight: 0.15, beneficial: true },
        { key: 'world_building', weight: 0.20, beneficial: true },
        { key: 'pacing', weight: 0.20, beneficial: true },
    ],

    // Music - Artists
    music_artist: [
        { key: 'discography', weight: 0.30, beneficial: true },
        { key: 'live_performance', weight: 0.25, beneficial: true },
        { key: 'influence', weight: 0.25, beneficial: true },
        { key: 'versatility', weight: 0.20, beneficial: true },
    ],

    // Music - Albums
    music_album: [
        { key: 'cohesion', weight: 0.25, beneficial: true },
        { key: 'production', weight: 0.25, beneficial: true },
        { key: 'thematic_depth', weight: 0.25, beneficial: true },
        { key: 'no_skip_factor', weight: 0.25, beneficial: true },
    ],

    // Music - Tracks
    music_track: [
        { key: 'melody', weight: 0.30, beneficial: true },
        { key: 'production', weight: 0.25, beneficial: true },
        { key: 'emotional_impact', weight: 0.25, beneficial: true },
        { key: 'rhythm', weight: 0.20, beneficial: true },
    ],

    // Anime
    anime: [
        { key: 'animation', weight: 0.25, beneficial: true },
        { key: 'story', weight: 0.25, beneficial: true },
        { key: 'voice_acting_sound', weight: 0.15, beneficial: true },
        { key: 'character_design', weight: 0.20, beneficial: true },
        { key: 'soundtrack', weight: 0.15, beneficial: true },
    ],
};

// Helper to get criteria with fallback
export function getCriteriaForCategory(categoryType: string): CriterionWeight[] {
    const normalized = categoryType.toLowerCase().replace(/[- ]/g, '_');
    return CRITERIA_SCHEMAS[normalized] || CRITERIA_SCHEMAS['movie']; // Fallback to movie
}

// ============================================================================
// BORDA COUNT IMPLEMENTATION
// ============================================================================

/**
 * Calculate Borda rank score from a tier distribution.
 * 
 * @param distribution - Object mapping tier letters to vote counts
 * @param config - Configuration for Bayesian smoothing
 * @returns Normalized Borda score (0-7 scale, where 7 is perfect S-tier)
 * 
 * @example
 * calculateBordaRank({ S: 10, A: 5, B: 2 }, { bayesianSmoothing: true })
 */
export function calculateBordaRank(
    distribution: TierDistribution,
    config: BordaConfig = { bayesianSmoothing: false, smoothingVotes: 5 }
): number {
    let totalPoints = 0;
    let totalVotes = 0;

    // Calculate raw points
    for (const [tier, count] of Object.entries(distribution)) {
        const points = TIER_POINTS[tier.toUpperCase()];
        if (points !== undefined && count && count > 0) {
            totalPoints += points * count;
            totalVotes += count;
        }
    }

    // Apply Bayesian smoothing if enabled
    if (config.bayesianSmoothing) {
        const smoothingVotes = config.smoothingVotes ?? 5;
        const cTierPoints = TIER_POINTS['C']; // 4 points
        totalPoints += cTierPoints * smoothingVotes;
        totalVotes += smoothingVotes;
    }

    // Return average score (prevent division by zero)
    if (totalVotes === 0) return 0;
    return totalPoints / totalVotes;
}

/**
 * Rank multiple items by Borda score.
 * 
 * @param items - Array of items with their tier distributions
 * @param config - Borda configuration
 * @returns Sorted array with Borda scores (highest first)
 */
export function rankByBorda<T extends { id: string; tierDistribution: TierDistribution }>(
    items: T[],
    config: BordaConfig = { bayesianSmoothing: true, smoothingVotes: 5 }
): (T & { bordaScore: number })[] {
    return items
        .map(item => ({
            ...item,
            bordaScore: calculateBordaRank(item.tierDistribution, config),
        }))
        .sort((a, b) => b.bordaScore - a.bordaScore);
}

// ============================================================================
// TOPSIS IMPLEMENTATION
// ============================================================================

/**
 * Normalize a decision matrix using vector normalization.
 * Each value is divided by the Euclidean norm of its column.
 */
function normalizeMatrix(matrix: number[][]): number[][] {
    if (matrix.length === 0) return [];

    const numCriteria = matrix[0].length;
    const normalized: number[][] = matrix.map(row => [...row]);

    for (let j = 0; j < numCriteria; j++) {
        // Calculate Euclidean norm of column
        const sumSquares = matrix.reduce((sum, row) => sum + (row[j] ** 2), 0);
        const norm = Math.sqrt(sumSquares);

        // Normalize each value in column
        if (norm > 0) {
            for (let i = 0; i < matrix.length; i++) {
                normalized[i][j] = matrix[i][j] / norm;
            }
        }
    }

    return normalized;
}

/**
 * Apply weights to normalized matrix.
 */
function applyWeights(matrix: number[][], weights: number[]): number[][] {
    return matrix.map(row =>
        row.map((val, j) => val * weights[j])
    );
}

/**
 * Find ideal best and worst solutions.
 * For beneficial criteria: best = max, worst = min
 * For non-beneficial criteria: best = min, worst = max
 */
function findIdealSolutions(
    matrix: number[][],
    criteria: CriterionWeight[]
): { idealBest: number[]; idealWorst: number[] } {
    if (matrix.length === 0) return { idealBest: [], idealWorst: [] };

    const idealBest: number[] = [];
    const idealWorst: number[] = [];

    for (let j = 0; j < criteria.length; j++) {
        const column = matrix.map(row => row[j]);
        const max = Math.max(...column);
        const min = Math.min(...column);

        if (criteria[j].beneficial) {
            idealBest.push(max);
            idealWorst.push(min);
        } else {
            idealBest.push(min);
            idealWorst.push(max);
        }
    }

    return { idealBest, idealWorst };
}

/**
 * Calculate Euclidean distance between a point and a reference point.
 */
function euclideanDistance(point: number[], reference: number[]): number {
    return Math.sqrt(
        point.reduce((sum, val, j) => sum + ((val - reference[j]) ** 2), 0)
    );
}

/**
 * Calculate TOPSIS rankings for a set of items.
 * 
 * @param items - Array of items with criterion scores
 * @param criteria - Array of criteria with weights and beneficial flags
 * @returns Sorted array with TOPSIS scores (highest = best)
 * 
 * @example
 * const results = calculateTOPSIS(
 *   [{ id: '1', scores: { acting: 8, plot: 7, ... } }],
 *   CRITERIA_SCHEMAS['movie']
 * );
 */
export function calculateTOPSIS(
    items: TopsisItem[],
    criteria: CriterionWeight[]
): TopsisResult[] {
    if (items.length === 0) return [];
    if (criteria.length === 0) return items.map(item => ({
        id: item.id,
        topsisScore: 0,
        distanceToIdeal: 0,
        distanceToWorst: 0,
        normalizedScores: {},
    }));

    // Normalize weights to sum to 1
    const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);
    const normalizedCriteria = criteria.map(c => ({
        ...c,
        weight: c.weight / totalWeight,
    }));

    // Step 1: Build decision matrix
    const decisionMatrix = items.map(item =>
        normalizedCriteria.map(c => item.scores[c.key] || 0)
    );

    // Step 2: Normalize the matrix
    const normalizedMatrix = normalizeMatrix(decisionMatrix);

    // Step 3: Apply weights
    const weightedMatrix = applyWeights(
        normalizedMatrix,
        normalizedCriteria.map(c => c.weight)
    );

    // Step 4: Find ideal solutions
    const { idealBest, idealWorst } = findIdealSolutions(weightedMatrix, normalizedCriteria);

    // Step 5: Calculate distances and relative closeness
    const results: TopsisResult[] = items.map((item, i) => {
        const distToIdeal = euclideanDistance(weightedMatrix[i], idealBest);
        const distToWorst = euclideanDistance(weightedMatrix[i], idealWorst);

        // Relative closeness to ideal solution
        const totalDist = distToIdeal + distToWorst;
        const closeness = totalDist > 0 ? distToWorst / totalDist : 0;

        // Build normalized scores for transparency
        const normalizedScores: Record<string, number> = {};
        normalizedCriteria.forEach((c, j) => {
            normalizedScores[c.key] = normalizedMatrix[i][j];
        });

        return {
            id: item.id,
            topsisScore: closeness,
            distanceToIdeal: distToIdeal,
            distanceToWorst: distToWorst,
            normalizedScores,
        };
    });

    // Sort by TOPSIS score (highest first)
    return results.sort((a, b) => b.topsisScore - a.topsisScore);
}

/**
 * Calculate TOPSIS with custom weights override.
 * Merges user weights with default criteria.
 */
export function calculateTOPSISWithCustomWeights(
    items: TopsisItem[],
    categoryType: string,
    customWeights?: Record<string, number>
): TopsisResult[] {
    const baseCriteria = getCriteriaForCategory(categoryType);

    if (!customWeights) {
        return calculateTOPSIS(items, baseCriteria);
    }

    // Apply custom weights
    const mergedCriteria = baseCriteria.map(c => ({
        ...c,
        weight: customWeights[c.key] ?? c.weight,
    }));

    return calculateTOPSIS(items, mergedCriteria);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get human-readable criteria names for display.
 */
export function getCriteriaDisplayNames(categoryType: string): Record<string, string> {
    const displayNames: Record<string, string> = {
        // Common
        acting: 'Acting',
        plot: 'Plot',
        pacing: 'Pacing',
        production: 'Production',
        soundtrack: 'Soundtrack',

        // Movies
        cinematography: 'Cinematography',

        // TV
        writing: 'Writing',
        character_development: 'Character Development',
        binge_worthiness: 'Binge-worthiness',

        // Video Games
        gameplay: 'Gameplay',
        graphics: 'Graphics',
        story: 'Story',
        replayability: 'Replayability',
        sound_design: 'Sound Design',

        // Board Games
        strategy_depth: 'Strategy Depth',
        accessibility: 'Accessibility',
        theme_integration: 'Theme Integration',
        component_quality: 'Component Quality',

        // Books
        writing_style: 'Writing Style',
        characters: 'Characters',
        world_building: 'World-building',

        // Podcasts
        host_chemistry: 'Host Chemistry',
        content_depth: 'Content Depth',
        audio_engineering: 'Audio Engineering',
        flow: 'Flow',
        consistency: 'Consistency',

        // Comics/Manga
        art_quality: 'Art Quality',
        panel_layout: 'Panel Layout/Flow',
        story_arc: 'Story Arc',
        character_consistency: 'Character Consistency',
        lettering_translation: 'Lettering/Translation',

        // Light Novels
        prose_translation: 'Prose/Translation',
        character_tropes: 'Character Tropes',
        illustration_integration: 'Illustration Integration',

        // Music Artists
        discography: 'Discography',
        live_performance: 'Live Performance',
        influence: 'Influence',
        versatility: 'Versatility',

        // Music Albums
        cohesion: 'Cohesion',
        thematic_depth: 'Thematic Depth',
        no_skip_factor: 'No-Skip Factor',

        // Music Tracks
        melody: 'Melody',
        emotional_impact: 'Emotional Impact',
        rhythm: 'Rhythm',

        // Anime
        animation: 'Animation',
        voice_acting_sound: 'Voice Acting/Sound',
        character_design: 'Character Design',
    };

    const criteria = getCriteriaForCategory(categoryType);
    const result: Record<string, string> = {};
    criteria.forEach(c => {
        result[c.key] = displayNames[c.key] || c.key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    });
    return result;
}
