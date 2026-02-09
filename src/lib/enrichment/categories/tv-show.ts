/**
 * TV Show Enrichment Module
 * 
 * Consolidated module for all TV show-specific enrichment logic:
 * - Description generation (Semantic Weaving with scripted/unscripted detection)
 * - Tag generation (4-bucket taxonomy)
 * - Embedding text building
 * - Franchise classification (Save the Cat methodology)
 * 
 * This module re-exports from tv-show-description.ts and adds tag generation.
 */

import { callLLM } from '@/lib/llm';
import type { LLMConfig } from '@/lib/harvesters/shared';
import {
    canonicalizeTags,
    matchCanonicalTag,
    ALL_CANONICAL_TAGS,
    CANONICAL_TAG_SET,
    CANONICAL_SUB_GENRES,
    CANONICAL_TROPES,
    CANONICAL_MOODS,
    CANONICAL_FORMATS,
} from '@/lib/enrichment/canonical-tags';

// Re-export description functions
export {
    generateTvShowDescription,
    buildTvShowEmbeddingText,
    buildTvShowVectorText,  // Optimized for embedding (Super-Document template)
    // isUnscriptedTvShow - DEPRECATED: Use detectTvBucket instead
    detectTvBucket,
    detectTvFormat,         // 6-label format taxonomy detection
    detectGenreLens,
    isAnthology,
    inferShowrunner,
    translateToArchetypes,  // LLM character archetype translation
    CHARACTER_ARCHETYPES    // Extensible archetype definitions
} from '@/lib/ai/tv-show-description';

// Re-export franchise classification (Save the Cat methodology)
export {
    classifyFranchiseType,      // LLM-based franchise classification
    detectFranchiseHeuristic,   // Keyword-based fallback
    extractPilotBeats,          // Pilot beat sheet extraction
    getFranchiseLabel,          // Human-readable label
    getFranchiseEngine,         // Franchise engine description
    FRANCHISE_DEFINITIONS       // Extensible franchise definitions
} from '@/lib/ai/franchise-classification';

// Re-export canonical tags for downstream consumers
export {
    canonicalizeTags,
    matchCanonicalTag,
    ALL_CANONICAL_TAGS,
    CANONICAL_TAG_SET,
} from '@/lib/enrichment/canonical-tags';

// Re-export types
export type { StructuredDescription } from '@/lib/ai/structured-description';
export type {
    TvShowEmbeddingData,
    TvBucket,
    TvFormat,               // 6-label format type
    GenreLens,
    LifecycleState,         // Lifecycle FSM state
    ArchetypeId             // Archetype identifier type
} from '@/lib/ai/tv-show-description';

export type {
    FranchiseType,          // Save the Cat franchise type
    PilotBeats              // Pilot beat sheet structure
} from '@/lib/ai/franchise-classification';


// ============================================================================
// TV SHOW TAG GENERATION (4-Bucket Taxonomy + Canonical Registry)
// ============================================================================

/**
 * Sample N random elements from an array for prompt diversity.
 */
function sampleTags(tags: readonly string[], n: number): string[] {
    const shuffled = [...tags].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, n);
}

/**
 * Generate structured tags for TV shows using 4-bucket taxonomy:
 * - sub_genres: Niche classification
 * - tropes: Narrative DNA (TV Tropes terminology)
 * - mood: Emotional signature
 * - format: Structure/pacing
 * 
 * Uses a hybrid canonical approach:
 * 1. Prompt shows ~10 curated examples per bucket as style guidance
 * 2. LLM generates single-concept tags (no compound phrases)
 * 3. Post-processing fuzzy-matches to canonical registry
 * 4. Up to 2 wildcard tags per item for novel concepts
 * 
 * Returns 15-20 high-density canonicalized tags.
 */
export async function generateTvShowTags(
    config: LLMConfig,
    title: string,
    description: string
): Promise<string[]> {
    // Sample diverse examples for prompt — avoids LLM fixating on same tags
    const subGenreExamples = sampleTags(CANONICAL_SUB_GENRES, 12).join('", "');
    const tropeExamples = sampleTags(CANONICAL_TROPES, 12).join('", "');
    const moodExamples = sampleTags(CANONICAL_MOODS, 10).join('", "');
    const formatExamples = sampleTags(CANONICAL_FORMATS, 8).join('", "');

    const systemPrompt = `You are a senior media analyst and taxonomy expert. Extract a structured tag set for a TV show for a vector search engine.

Goal: 15-20 tags that capture the show's DNA beyond basic genres.

Output as JSON with EXACTLY these four buckets:

1. "sub_genres" (3-5 tags): Niche classification. Use precise terms like: "${subGenreExamples}"

2. "tropes" (4-6 tags): Narrative DNA. Use recognizable trope names like: "${tropeExamples}"

3. "mood" (3-5 tags): Emotional/sensory signature. Use single-concept adjectives like: "${moodExamples}"

4. "format" (2-4 tags): Structure/pacing like: "${formatExamples}"

CRITICAL CONSTRAINTS:
- Each tag MUST be a single concept — NO compound phrases like "cerebral yet kinetic" or "slow-burn serialized mystery".
- All tags lowercase.
- Output ONLY valid JSON. No markdown, no explanation.
- Do NOT use obvious tags like "tv show" or the show title.
- Base tags on the provided description only.

Example:
{
  "sub_genres": ["family drama", "class satire", "corporate thriller"],
  "tropes": ["dysfunctional family", "sibling rivalry", "power corrupts"],
  "mood": ["darkly comedic", "tense", "cynical"],
  "format": ["serialized", "binge-worthy"]
}`;

    const userPrompt = `Generate structured taxonomy tags for this TV show:

Title: ${title}
Description: ${description}`;

    try {
        const response = await callLLM({
            userPrompt,
            systemPrompt,
            apiKey: config.apiKey,
            provider: config.provider,
            model: config.model,
            endpoint: config.endpoint,
            maxTokens: 500
        });

        // Parse JSON response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.warn(`⚠️ TV tag generation returned non-JSON for "${title}"`);
            return [];
        }

        const parsed = JSON.parse(jsonMatch[0]);

        // Flatten all buckets into a single tag array
        const rawTags: string[] = [
            ...(parsed.sub_genres || []),
            ...(parsed.tropes || []),
            ...(parsed.mood || []),
            ...(parsed.format || [])
        ].filter(t => typeof t === 'string');

        // Canonicalize: fuzzy match → canonical registry, max 2 wildcards
        const canonicalized = canonicalizeTags(rawTags);

        return canonicalized.slice(0, 20); // Max 20 tags

    } catch (error) {
        console.warn(`⚠️ TV tag parsing failed for "${title}":`, error);
        return [];
    }
}
