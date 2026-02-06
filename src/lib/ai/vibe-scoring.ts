/**
 * Vibe Scoring System
 * 
 * 20-dimensional psychometric scoring for cross-category media comparison.
 * Each dimension is scored 0.0-1.0 to enable universal "vibe matching"
 * across TV shows, movies, games, books, music, etc.
 * 
 * Use Cases:
 * - "Find games that feel like True Detective"
 * - "What book has the same vibe as Severance?"
 * - Filter by mood dimensions in discovery UI
 */

import { callLLM } from '@/lib/llm';

// ============================================================================
// TYPES
// ============================================================================

/**
 * The 20 vibe dimensions for universal media comparison
 * Each value is 0.0-1.0
 */
export interface VibeScores {
    grit: number;           // Raw/gritty vs polished/clean
    whimsy: number;         // Serious vs playful
    cerebral: number;       // Visceral vs intellectual
    pacing: number;         // Slow-burn vs kinetic
    complexity: number;     // Simple vs layered
    intimacy: number;       // Epic scope vs intimate/claustrophobic
    adrenaline: number;     // Calm vs intense/heart-pounding
    aesthetic: number;      // Functional vs stylized
    melancholy: number;     // Uplifting vs sorrowful
    prestige: number;       // Populist/mainstream vs arthouse
    nostalgia: number;      // Contemporary vs retro
    surrealism: number;     // Grounded/realistic vs dreamlike
    grandiosity: number;    // Humble/modest vs operatic
    provocative: number;    // Safe/family-friendly vs transgressive
    wholesomeness: number;  // Dark vs warm/wholesome
    cynicism: number;       // Optimistic/hopeful vs nihilistic
    symmetry: number;       // Chaotic/messy vs precise/symmetrical
    grind: number;          // Casual/accessible vs demanding
    mystery: number;        // Transparent/clear vs enigmatic
    camp: number;           // Earnest/sincere vs over-the-top
}

/**
 * All vibe dimension keys for iteration
 */
export const VIBE_DIMENSIONS: (keyof VibeScores)[] = [
    'grit', 'whimsy', 'cerebral', 'pacing', 'complexity',
    'intimacy', 'adrenaline', 'aesthetic', 'melancholy', 'prestige',
    'nostalgia', 'surrealism', 'grandiosity', 'provocative', 'wholesomeness',
    'cynicism', 'symmetry', 'grind', 'mystery', 'camp'
];

/**
 * Default empty scores (all zeros)
 */
export const EMPTY_VIBE_SCORES: VibeScores = {
    grit: 0, whimsy: 0, cerebral: 0, pacing: 0, complexity: 0,
    intimacy: 0, adrenaline: 0, aesthetic: 0, melancholy: 0, prestige: 0,
    nostalgia: 0, surrealism: 0, grandiosity: 0, provocative: 0, wholesomeness: 0,
    cynicism: 0, symmetry: 0, grind: 0, mystery: 0, camp: 0
};

// ============================================================================
// PROMPT
// ============================================================================

interface VibeContext {
    title: string;
    overview: string;
    genres?: string[];
    keywords?: string[];
}

const VIBE_SCORES_PROMPT = (ctx: VibeContext) => ({
    system: `You are a Media Psychometrics Analyst. Score this content on exactly 20 "vibe" dimensions from 0.0 to 1.0.

## The 20 Dimensions:
1. grit: Raw/gritty vs polished/clean (0=pristine, 1=brutal/unflinching)
2. whimsy: Serious vs playful (0=grave/dour, 1=whimsical/lighthearted)
3. cerebral: Visceral vs intellectual (0=gut-level/primal, 1=cerebral/thoughtful)
4. pacing: Slow-burn vs kinetic (0=meditative/languid, 1=breakneck/frenetic)
5. complexity: Simple vs layered (0=straightforward, 1=labyrinthine/dense)
6. intimacy: Epic scope vs intimate (0=sweeping/grand, 1=claustrophobic/personal)
7. adrenaline: Calm vs intense (0=tranquil/peaceful, 1=heart-pounding)
8. aesthetic: Functional vs stylized (0=utilitarian, 1=aesthete's dream)
9. melancholy: Uplifting vs melancholic (0=joyful/hopeful, 1=sorrowful/bittersweet)
10. prestige: Populist vs prestige (0=mainstream/accessible, 1=arthouse/auteur)
11. nostalgia: Contemporary vs nostalgic (0=modern/current, 1=retro/period)
12. surrealism: Grounded vs surreal (0=realistic/naturalistic, 1=dreamlike/abstract)
13. grandiosity: Humble vs grandiose (0=modest/understated, 1=operatic/epic)
14. provocative: Safe vs provocative (0=family-friendly, 1=transgressive/edgy)
15. wholesomeness: Cynical vs wholesome (0=dark/bleak, 1=warm/heartfelt)
16. cynicism: Optimistic vs cynical (0=hopeful/idealistic, 1=nihilistic/jaded)
17. symmetry: Chaotic vs symmetrical (0=messy/unpredictable, 1=precise/controlled)
18. grind: Casual vs demanding (0=accessible/easy, 1=demanding/challenging)
19. mystery: Transparent vs mysterious (0=clear/explained, 1=enigmatic/ambiguous)
20. camp: Earnest vs campy (0=sincere/serious, 1=over-the-top/self-aware)

## Rules:
- Score each dimension from 0.0 to 1.0 (use one decimal place)
- Consider the OVERALL work, not just moments
- Be calibrated: 0.5 is neutral, extremes (0.0 or 1.0) are rare
- Output ONLY valid JSON with all 20 keys

## Output Format:
{"grit": 0.0, "whimsy": 0.0, "cerebral": 0.0, "pacing": 0.0, "complexity": 0.0, "intimacy": 0.0, "adrenaline": 0.0, "aesthetic": 0.0, "melancholy": 0.0, "prestige": 0.0, "nostalgia": 0.0, "surrealism": 0.0, "grandiosity": 0.0, "provocative": 0.0, "wholesomeness": 0.0, "cynicism": 0.0, "symmetry": 0.0, "grind": 0.0, "mystery": 0.0, "camp": 0.0}`,
    user: `Score this content:

Title: ${ctx.title}
${ctx.genres?.length ? `Genres: ${ctx.genres.join(', ')}` : ''}
${ctx.keywords?.length ? `Keywords: ${ctx.keywords.slice(0, 10).join(', ')}` : ''}
Overview: ${ctx.overview}`
});

// ============================================================================
// GENERATION
// ============================================================================

/**
 * Generate vibe scores for any media content
 * 
 * @param config - LLM configuration
 * @param context - Content metadata (title, overview, genres, keywords)
 * @returns VibeScores object or null on failure
 */
export async function generateVibeScores(
    config: { apiKey: string; provider: string; model?: string; endpoint?: string },
    context: VibeContext
): Promise<VibeScores | null> {
    if (!config.apiKey) {
        console.warn('[Vibe Scoring] No LLM API key configured');
        return null;
    }

    try {
        const prompt = VIBE_SCORES_PROMPT(context);

        const response = await callLLM({
            userPrompt: prompt.user,
            systemPrompt: prompt.system,
            apiKey: config.apiKey,
            provider: config.provider,
            model: config.model,
            endpoint: config.endpoint,
            maxTokens: 200  // JSON output is compact
        });

        // Extract JSON from response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.warn(`[Vibe Scoring] No JSON found in response for "${context.title}"`);
            return null;
        }

        const parsed = JSON.parse(jsonMatch[0]) as Partial<VibeScores>;

        // Validate and normalize all 20 dimensions
        const scores: VibeScores = { ...EMPTY_VIBE_SCORES };
        for (const dim of VIBE_DIMENSIONS) {
            const value = parsed[dim];
            if (typeof value === 'number' && value >= 0 && value <= 1) {
                scores[dim] = Math.round(value * 10) / 10;  // Round to 1 decimal
            }
        }

        console.log(`[Vibe Scoring] Generated scores for "${context.title}"`);
        return scores;

    } catch (error) {
        console.error(`[Vibe Scoring] Failed for "${context.title}":`, error);
        return null;
    }
}

/**
 * Calculate Euclidean distance between two vibe profiles
 * Lower = more similar
 */
export function vibeDistance(a: VibeScores, b: VibeScores): number {
    let sum = 0;
    for (const dim of VIBE_DIMENSIONS) {
        sum += Math.pow((a[dim] || 0) - (b[dim] || 0), 2);
    }
    return Math.sqrt(sum);
}

/**
 * Calculate weighted similarity between two vibe profiles
 * Higher = more similar (0.0 to 1.0)
 * 
 * @param a - First vibe profile
 * @param b - Second vibe profile
 * @param weights - Optional dimension weights (defaults to equal)
 */
export function vibeSimilarity(
    a: VibeScores,
    b: VibeScores,
    weights?: Partial<Record<keyof VibeScores, number>>
): number {
    const maxDistance = Math.sqrt(VIBE_DIMENSIONS.length);  // Max possible distance
    const distance = vibeDistance(a, b);
    return 1 - (distance / maxDistance);
}
