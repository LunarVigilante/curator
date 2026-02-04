/**
 * Default Enrichment Module
 * 
 * Fallback enrichment logic for categories that don't have specialized modules.
 * Provides generic tag generation with simple comma-separated output.
 */

import { callLLM } from '@/lib/llm';
import type { LLMConfig } from '@/lib/harvesters/shared';

/**
 * Generate tags using the default/generic prompt
 */
export async function generateDefaultTags(
    config: LLMConfig,
    title: string,
    description: string,
    type: string
): Promise<string[]> {
    const systemPrompt = `You are an expert curator. Generate 3-5 relevant tags for the item.
Return ONLY a comma-separated list of tags. No numbering, no quotes.
Example: "Cinematic, Dystopian, Sci-Fi, Atmospheric"`;

    const userPrompt = `Generate tags for:
Title: ${title}
Type: ${type}
Description: ${description}`;

    try {
        const response = await callLLM({
            userPrompt,
            systemPrompt,
            apiKey: config.apiKey,
            provider: config.provider,
            model: config.model,
            endpoint: config.endpoint
        });

        return response.split(',')
            .map(t => t.trim())
            .filter(t => t.length > 2 && t.length < 30)
            .slice(0, 8);
    } catch {
        console.warn(`⚠️ Tag generation failed for "${title}"`);
        return [];
    }
}
