/**
 * LLM Description Rewriting
 * 
 * AI-powered description generation with refusal handling and fallback
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { callLLM } from '@/lib/llm';
import { cleanDescription } from '@/lib/utils/html';
import { getLLMConfig } from './config';
import { isRefusal, GROK_MODEL } from './refusal';

/**
 * Rewrite a description using LLM with automatic fallback for refusals
 * 
 * @param supabase - Supabase client
 * @param title - Content title
 * @param originalDescription - Original description text
 * @param type - Content type (movie, tv, etc.)
 * @returns Rewritten description or original if all attempts fail
 */
export async function rewriteDescription(
    supabase: ReturnType<typeof createServiceRoleClient>,
    title: string,
    originalDescription: string,
    type: string
): Promise<string> {
    if (!originalDescription) return '';

    try {
        const config = await getLLMConfig(supabase);
        if (!config.apiKey) return originalDescription;

        const systemPrompt = `You are an expert curator writing compelling descriptions for a media database.

Write a flowing 2-3 paragraph description (150-250 words total) that:

PARAGRAPH 1: Describe the core premise and what makes it unique. Hook the reader.

PARAGRAPH 2: Weave in key themes, character archetypes (e.g. "reluctant hero", "anti-hero"), and story tropes (e.g. "found family", "redemption arc") naturally into the prose. Mention the mood and tone. Include searchable keywords fans would use.

PARAGRAPH 3 (optional, if space allows): Who would enjoy this and why. Comparable titles if helpful.

End with a brief footer on a new line:
Year: YYYY | Creator: [Name] | Notable Awards: [Awards or "None"]

CRITICAL RULES:
- Write in flowing prose, NOT bullet points or numbered lists
- Do NOT use section headers like "PREMISE:", "THEMES:", "TONE:" etc.
- Do NOT use markdown formatting
- Return ONLY the description text`;

        const userPrompt = `Generate a description for:
Title: ${title}
Type: ${type}
Additional Context: ${originalDescription}`;

        // ============================================
        // ATTEMPT 1: Primary Model
        // ============================================
        let response = await callLLM({
            userPrompt,
            systemPrompt,
            apiKey: config.apiKey,
            provider: config.provider,
            model: config.model,
            endpoint: config.endpoint,
            timeoutMs: 60000
        });

        let description = cleanDescription(response.trim());

        // Check for refusal
        if (!isRefusal(description) && description.length > 20) {
            return description;
        }

        // ============================================
        // ATTEMPT 2: Fallback to Grok (same prompts, different model)
        // ============================================
        console.warn(`   ⚠️ Primary model refused "${title}". Switching to Grok...`);

        try {
            response = await callLLM({
                userPrompt,  // Same prompt as primary
                systemPrompt,  // Same system prompt as primary
                apiKey: config.apiKey,
                provider: 'openrouter',
                model: GROK_MODEL,
                timeoutMs: 60000
            });

            description = cleanDescription(response.trim());

            // Check Grok response for refusal too
            if (!isRefusal(description) && description.length > 20) {
                return description;
            }
        } catch {
            console.warn(`   ⚠️ Grok fallback failed for "${title}"`);
        }

        // ============================================
        // FINAL FALLBACK: Original Description
        // ============================================
        console.error(`   ❌ All models refused "${title}". Using original description.`);
        return cleanDescription(description);
    } catch {
        console.warn(`⚠️ Description rewrite failed for "${title}"`);
        return originalDescription;
    }
}
