/**
 * Vibe Scoring System v2
 * 
 * 20-dimensional psychometric scoring for cross-category media comparison.
 * Each dimension is scored 0.0-1.0 to enable universal "vibe matching"
 * across TV shows, movies, games, books, music, etc.
 * 
 * v2 Improvements:
 * - Exemplar anchoring: Curated reference shows for each dimension extreme
 * - Power normalization: Spreads clustered scores for better differentiation
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
// EXEMPLAR ANCHORS (Curated reference shows for calibration)
// ============================================================================

/**
 * High-scoring exemplars for each dimension
 * These are shows that embody the extreme (1.0) of each vibe
 */
const DIMENSION_EXEMPLARS: Record<keyof VibeScores, { high: string[]; description: string }> = {
    grit: {
        high: ['The Wire', 'The Shield', 'Generation Kill'],
        description: 'Raw, unvarnished, realistic. Institutional realism without Hollywood gloss.'
    },
    whimsy: {
        high: ['Pushing Daisies', 'The Good Place', 'Schmigadoon!'],
        description: 'Playful, colorful, storybook. Dream logic and joyful absurdity.'
    },
    cerebral: {
        high: ['Westworld (S1)', 'Devs', 'Primer'],
        description: 'Intellectual, puzzle-box, philosophical. Demands active engagement.'
    },
    pacing: {
        high: ['24', 'Reacher', 'Squid Game'],
        description: 'Breathless, relentless momentum. Every episode ends on a cliffhanger; you physically cannot stop watching.'
    },
    complexity: {
        high: ['Dark', 'Westworld (S1)', 'Primer'],
        description: 'Labyrinthine, multi-threaded, requires a literal timeline chart. Three timelines, fifty characters, nothing is what it seems.'
    },
    intimacy: {
        high: ['In Treatment', 'The Bear', 'Fleabag'],
        description: 'Claustrophobic, character-focused, small-scale. Microscopic drama.'
    },
    adrenaline: {
        high: ['Squid Game', 'Breaking Bad (Ozymandias)', 'Chernobyl'],
        description: 'Intense, high-stakes, heart-pounding. Visceral physical anxiety.'
    },
    aesthetic: {
        high: ['Hannibal', 'Euphoria', 'Legion'],
        description: 'Stylized, visual-first, artful. Murder scenes as Renaissance paintings.'
    },
    melancholy: {
        high: ['The Leftovers', 'Six Feet Under', 'BoJack Horseman'],
        description: 'Sorrowful, grief-stricken, heavy. Profound meditation on loss.'
    },
    prestige: {
        high: ['Twin Peaks: The Return', 'The Crown', 'Mad Men'],
        description: 'Arthouse, cinematic, serious. Defies convention, like a Great American Novel.'
    },
    nostalgia: {
        high: ['Stranger Things', 'GLOW', 'Freaks and Geeks'],
        description: 'Retro, pastiche, evocative. Weaponized period aesthetics.'
    },
    surrealism: {
        high: ['Atlanta', 'Twin Peaks', 'Man Seeking Woman'],
        description: 'Dreamlike, absurdist, bizarre. Literal monsters for dating anxieties.'
    },
    grandiosity: {
        high: ['Game of Thrones', 'Foundation', 'Rome'],
        description: 'Operatic, epic, larger-than-life. Dragons and the fate of continents.'
    },
    provocative: {
        high: ['Euphoria', 'Black Mirror', 'The Boys'],
        description: 'Transgressive, shocking, boundary-pushing. Designed to disturb.'
    },
    wholesomeness: {
        high: ['Ted Lasso', "Schitt's Creek", 'The Great British Bake Off'],
        description: 'Warm, optimistic, comforting. Kindness as narrative force.'
    },
    cynicism: {
        high: ['Succession', 'Veep', "It's Always Sunny in Philadelphia"],
        description: 'Nihilistic, self-interested, bleak. No hugging, no learning.'
    },
    symmetry: {
        high: ['Severance', 'Mr. Robot', 'Kubrick films'],
        description: 'Obsessively composed, every frame a calculated grid. Symmetrical hallways, centered subjects, sterile perfection like a Wes Anderson dollhouse or a Kubrick tracking shot.'
    },
    grind: {
        high: ['The Wire', 'Deadwood', 'Tinker Tailor Soldier Spy'],
        description: 'Demanding, dense, unforgiving. Expects you to keep up.'
    },
    mystery: {
        high: ['Lost', 'Severance', 'Yellowjackets'],
        description: 'Enigmatic, question-driven. The Mystery Box approach.'
    },
    camp: {
        high: ['Riverdale', 'American Horror Story', 'True Blood'],
        description: 'Over-the-top, theatrical, self-aware. Excess with a wink.'
    }
};

// ============================================================================
// NORMALIZATION
// ============================================================================

/**
 * Apply power normalization to spread clustered scores
 * Uses symmetric power function centered at 0.5
 * 
 * @param score - Raw score 0.0-1.0
 * @param k - Power factor (2-4 recommended, 3 is default)
 * @returns Normalized score 0.0-1.0 with better spread
 */
export function normalizeVibeScore(score: number, k: number = 3): number {
    // Center around 0.5
    const centered = score - 0.5;  // -0.5 to 0.5
    const sign = centered >= 0 ? 1 : -1;

    // Apply power function to absolute value, preserve sign
    const normalized = sign * Math.pow(Math.abs(centered) * 2, k) / 2;

    // Re-center and clamp
    return Math.max(0, Math.min(1, normalized + 0.5));
}

/**
 * Normalize all vibe scores with power curve
 */
export function normalizeVibeScores(scores: VibeScores, k: number = 3): VibeScores {
    const normalized: VibeScores = { ...EMPTY_VIBE_SCORES };
    for (const dim of VIBE_DIMENSIONS) {
        normalized[dim] = Math.round(normalizeVibeScore(scores[dim], k) * 10) / 10;
    }
    return normalized;
}

// ============================================================================
// PROMPT (Enhanced with Exemplars)
// ============================================================================

interface VibeContext {
    title: string;
    overview: string;
    genres?: string[];
    keywords?: string[];
}

const VIBE_SCORES_PROMPT = (ctx: VibeContext) => {
    // Build exemplar calibration section
    const exemplarLines = VIBE_DIMENSIONS.map(dim => {
        const ex = DIMENSION_EXEMPLARS[dim];
        return `${dim}: 1.0 = ${ex.high.slice(0, 2).join(', ')} (${ex.description.split('.')[0]})`;
    }).join('\n');

    return {
        system: `You are a Media Psychometrics Analyst. Score this content on exactly 20 "vibe" dimensions from 0.0 to 1.0.

## The 20 Dimensions (0.0 = opposite extreme, 1.0 = maximum):
1. grit: Polished/clean → Raw/brutal/unvarnished
2. whimsy: Grave/serious → Playful/storybook/absurd
3. cerebral: Visceral/primal → Intellectual/puzzle-box
4. pacing: Meditative/glacial/contemplative → Kinetic/breathless/cliffhanger-every-scene
5. complexity: Simple/linear/self-contained → Labyrinthine/multi-timeline/requires-a-wiki
6. intimacy: Epic/sweeping → Claustrophobic/personal
7. adrenaline: Tranquil/calm → Heart-pounding/intense
8. aesthetic: Functional/plain → Stylized/visual-first
9. melancholy: Joyful/uplifting → Sorrowful/grief-stricken
10. prestige: Mainstream/accessible → Arthouse/auteur
11. nostalgia: Contemporary/modern → Retro/period/pastiche
12. surrealism: Grounded/realistic → Dreamlike/bizarre
13. grandiosity: Humble/modest → Operatic/epic
14. provocative: Family-friendly/safe → Transgressive/shocking
15. wholesomeness: Dark/bleak → Warm/comforting
16. cynicism: Optimistic/hopeful → Nihilistic/jaded
17. symmetry: Chaotic/handheld/improvised/raw → Obsessively composed/symmetrical/Kubrickian/every-frame-a-painting
18. grind: Accessible/casual → Demanding/unforgiving
19. mystery: Clear/explained → Enigmatic/question-driven
20. camp: Earnest/sincere → Over-the-top/theatrical

## Calibration Anchors (use these as 1.0 reference points):
${exemplarLines}

## Scoring Rules:
- Use the FULL 0.0-1.0 range. Scores of 0.8+ should be rare (reserved for exemplar-level).
- 0.5 = neutral (neither extreme). Most dimensions for most shows should be 0.3-0.7.
- Be discriminating: high scores mean "this is DEFINING for this content"
- Consider the OVERALL work, not just memorable moments
- Output ONLY valid JSON with all 20 keys, one decimal place

## Output Format:
{"grit": 0.0, "whimsy": 0.0, "cerebral": 0.0, "pacing": 0.0, "complexity": 0.0, "intimacy": 0.0, "adrenaline": 0.0, "aesthetic": 0.0, "melancholy": 0.0, "prestige": 0.0, "nostalgia": 0.0, "surrealism": 0.0, "grandiosity": 0.0, "provocative": 0.0, "wholesomeness": 0.0, "cynicism": 0.0, "symmetry": 0.0, "grind": 0.0, "mystery": 0.0, "camp": 0.0}`,
        user: `Score this content:

Title: ${ctx.title}
${ctx.genres?.length ? `Genres: ${ctx.genres.join(', ')}` : ''}
${ctx.keywords?.length ? `Keywords: ${ctx.keywords.slice(0, 10).join(', ')}` : ''}
Overview: ${ctx.overview}`
    };
};

// ============================================================================
// GENERATION
// ============================================================================

/**
 * Generate vibe scores for any media content
 * 
 * @param config - LLM configuration
 * @param context - Content metadata (title, overview, genres, keywords)
 * @param normalize - Whether to apply power normalization (default: true)
 * @returns VibeScores object or null on failure
 */
export async function generateVibeScores(
    config: { apiKey: string; provider: string; model?: string; endpoint?: string },
    context: VibeContext,
    normalize: boolean = true
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
            maxTokens: 300  // Slightly more for enhanced prompt
        });

        // Extract JSON from response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.warn(`[Vibe Scoring] No JSON found in response for "${context.title}"`);
            return null;
        }

        const parsed = JSON.parse(jsonMatch[0]) as Partial<VibeScores>;

        // Validate and collect raw scores
        const rawScores: VibeScores = { ...EMPTY_VIBE_SCORES };
        for (const dim of VIBE_DIMENSIONS) {
            const value = parsed[dim];
            if (typeof value === 'number' && value >= 0 && value <= 1) {
                rawScores[dim] = Math.round(value * 10) / 10;  // Round to 1 decimal
            }
        }

        // Apply normalization if enabled
        const finalScores = normalize ? normalizeVibeScores(rawScores) : rawScores;

        return finalScores;

    } catch (error) {
        console.error(`   ║    ⚠️ Vibe scoring failed:`, error);
        return null;
    }
}

// ============================================================================
// DISTANCE & SIMILARITY
// ============================================================================

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

/**
 * Get the N most extreme dimensions for a vibe profile
 * Useful for summarizing what makes a show distinctive
 */
export function getTopVibes(scores: VibeScores, n: number = 5): { dimension: keyof VibeScores; score: number; direction: 'high' | 'low' }[] {
    const extremes: { dimension: keyof VibeScores; score: number; deviation: number; direction: 'high' | 'low' }[] = [];

    for (const dim of VIBE_DIMENSIONS) {
        const score = scores[dim];
        const deviation = Math.abs(score - 0.5);
        extremes.push({
            dimension: dim,
            score,
            deviation,
            direction: score >= 0.5 ? 'high' : 'low'
        });
    }

    return extremes
        .sort((a, b) => b.deviation - a.deviation)
        .slice(0, n)
        .map(({ dimension, score, direction }) => ({ dimension, score, direction }));
}
