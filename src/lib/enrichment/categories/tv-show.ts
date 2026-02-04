/**
 * TV Show Enrichment Module
 * 
 * Consolidated module for all TV show-specific enrichment logic:
 * - Description generation (Semantic Weaving with scripted/unscripted detection)
 * - Tag generation (4-bucket taxonomy)
 * - Embedding text building
 * 
 * This module re-exports from tv-show-description.ts and adds tag generation.
 */

import { callLLM } from '@/lib/llm';
import type { LLMConfig } from '@/lib/harvesters/shared';

// Re-export description functions
export {
    generateTvShowDescription,
    buildTvShowEmbeddingText,
    isUnscriptedTvShow
} from '@/lib/ai/tv-show-description';

// Re-export types
export type { StructuredDescription } from '@/lib/ai/structured-description';
export type { TvShowEmbeddingData } from '@/lib/ai/tv-show-description';

// ============================================================================
// TV SHOW TAG GENERATION (4-Bucket Taxonomy)
// ============================================================================

/**
 * Generate structured tags for TV shows using 4-bucket taxonomy:
 * - sub_genres: Niche classification
 * - tropes: Narrative DNA (TV Tropes terminology)
 * - mood: Emotional signature
 * - format: Structure/pacing
 * 
 * Returns 15-20 high-density tags for vector search optimization.
 */
export async function generateTvShowTags(
    config: LLMConfig,
    title: string,
    description: string
): Promise<string[]> {
    const systemPrompt = `You are a senior media analyst and taxonomy expert. Your task is to extract a highly granular, structured tag set for a television show to be used in a high-dimensional vector search engine.

Goal: Create 15-20 high-density tags that capture the "DNA" of the show beyond basic genres.

Output the tags as a JSON object with EXACTLY these four buckets:

1. "sub_genres" (3-5 tags): Niche classification. Do NOT use broad terms like "Drama." Use precise industry terms (e.g., "nordic noir", "workplace sitcom", "political thriller", "prestige drama", "teen soap").

2. "tropes" (4-6 tags): Narrative DNA using TV Tropes terminology (e.g., "found family", "enemies to lovers", "the chosen one", "fish out of water", "dark and troubled past", "slow burn romance").

3. "mood" (3-5 tags): Emotional signature. Sensory or emotional adjectives describing the vibe (e.g., "cerebral", "bleak", "whimsical", "adrenaline-fueled", "cozy", "claustrophobic", "melancholic").

4. "format" (2-4 tags): Structure/pacing descriptors (e.g., "binge-worthy", "slow-burn", "anthology", "miniseries", "procedural", "serialized", "prestige limited series").

CONSTRAINTS:
- Output ONLY valid JSON. No markdown, no explanation.
- All tags MUST be lowercase.
- Do NOT use obvious/spammy tags like "tv show" or the show's title.
- Base tags STRICTLY on the provided description. Do not hallucinate.

Example output:
{
  "sub_genres": ["family drama", "class satire", "corporate thriller"],
  "tropes": ["dysfunctional family", "sibling rivalry", "the patriarch", "succession crisis"],
  "mood": ["darkly comedic", "tense", "cynical", "addictive"],
  "format": ["serialized", "binge-worthy", "prestige drama"]
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
        const allTags: string[] = [
            ...(parsed.sub_genres || []),
            ...(parsed.tropes || []),
            ...(parsed.mood || []),
            ...(parsed.format || [])
        ];

        // Normalize and deduplicate
        return [...new Set(
            allTags
                .map(t => t.toLowerCase().trim())
                .filter(t => t.length > 2 && t.length < 40)
        )].slice(0, 20); // Max 20 tags

    } catch (error) {
        console.warn(`⚠️ TV tag parsing failed for "${title}":`, error);
        return [];
    }
}
