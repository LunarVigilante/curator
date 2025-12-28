'use server'

import { callLLM } from '@/lib/llm'
import { SystemConfigService } from '@/lib/services/SystemConfigService'
import { db } from '@/lib/db'
import { globalItems } from '@/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { z } from 'zod'

const generateDescriptionSchema = z.object({
    title: z.string().min(1),
    type: z.string().min(1),
    context: z.string().optional()
})

const generateTagsSchema = z.object({
    title: z.string().min(1),
    type: z.string().min(1),
    description: z.string().optional()
})

// =============================================================================
// SECURITY: Sanitize user input to prevent prompt injection
// =============================================================================

function sanitizeInput(input: string | undefined, maxLength = 200): string {
    if (!input) return ''
    return input
        .replace(/[\n\r]/g, ' ')      // Strip newlines
        .replace(/</g, '&lt;')         // Escape < 
        .replace(/>/g, '&gt;')         // Escape >
        .replace(/\s+/g, ' ')          // Collapse whitespace
        .trim()
        .substring(0, maxLength)
}

export async function generateDescriptionAction(input: z.input<typeof generateDescriptionSchema>) {
    try {
        const { title, type, context } = generateDescriptionSchema.parse(input)

        // 1. Check Cache
        const normalizedType = type.toUpperCase().replace(/\s+/g, '_');
        const existingItem = await db.query.globalItems.findFirst({
            where: and(
                sql`lower(${globalItems.title}) = lower(${title})`,
                // Try to match type if possible, but fallback to title-only match if fuzzy
                // For now, strict type match to avoid cross-pollination (e.g. Game vs Movie)
                // We use LIKE or just standard equality on normalized type
                eq(globalItems.categoryType, normalizedType)
            )
        });

        if (existingItem?.description) {
            console.log(`[AI Cache] Hit for description: "${title}"`);
            return { description: existingItem.description };
        }

        // Fetch LLM config from database
        const provider = await SystemConfigService.getDecryptedConfig('llm_provider') || 'openrouter';
        const apiKey = await SystemConfigService.getDecryptedConfig('llm_api_key');
        const endpoint = await SystemConfigService.getDecryptedConfig('llm_endpoint');
        const model = await SystemConfigService.getDecryptedConfig('llm_model');
        const anannasKey = await SystemConfigService.getDecryptedConfig('anannas_api_key');
        const anthropicKey = await SystemConfigService.getDecryptedConfig('anthropic_api_key');
        const openaiKey = await SystemConfigService.getDecryptedConfig('openai_api_key');
        const openrouterKey = await SystemConfigService.getDecryptedConfig('openrouter_api_key');
        const googleAiKey = await SystemConfigService.getDecryptedConfig('google_ai_api_key');

        let finalApiKey = apiKey;
        if (!finalApiKey) {
            switch (provider) {
                case 'ananas': finalApiKey = anannasKey; break;
                case 'anthropic': finalApiKey = anthropicKey; break;
                case 'openai': finalApiKey = openaiKey; break;
                case 'openrouter': finalApiKey = openrouterKey; break;
                case 'google': finalApiKey = googleAiKey; break;
            }
        }
        finalApiKey = finalApiKey || openrouterKey || anannasKey || anthropicKey || openaiKey || googleAiKey;

        if (!finalApiKey) {
            throw new Error('LLM API Key not configured in System Settings')
        }

        const systemPrompt = `You are an expert curator and critic. Generate a compelling description for the given item.

DESCRIPTION FORMAT:
1. Body: Maximum 50 words. Focus on plot summary first, then the vibe/atmosphere.
2. Footer: After the body, append exactly this format on a new line after a double newline:

Year: YYYY | Creator: [Name] | Notable Awards: [Awards or "None"]

Return ONLY the description text. No JSON, no markdown, no quotes.`;

        const userPrompt = `Generate a description for:
Title: ${sanitizeInput(title, 150)}
Type: ${sanitizeInput(type, 50)}
${context ? `Additional Context: ${sanitizeInput(context, 300)}` : ''}`;

        const response = await callLLM({
            userPrompt,
            systemPrompt,
            apiKey: finalApiKey,
            provider,
            model: model || undefined,
            endpoint: endpoint || undefined
        });

        let description = response.trim();
        if (description.startsWith('{') || description.startsWith('"')) {
            try {
                const parsed = JSON.parse(description);
                description = typeof parsed === 'string' ? parsed : parsed.description || description;
            } catch (e) { }
        }

        // 2. Update Cache
        if (existingItem) {
            await db.update(globalItems)
                .set({ description })
                .where(eq(globalItems.id, existingItem.id));
        } else {
            // Note: We don't have externalId or image here usually, just title/desc
            await db.insert(globalItems).values({
                title,
                description,
                categoryType: normalizedType
            });
        }

        return { description }

    } catch (e: any) {
        console.error("Generate Description Error:", e)
        return { error: e.message || "Generation Failed" }
    }
}

export async function generateTagsAction(input: z.input<typeof generateTagsSchema>) {
    try {
        const { title, type, description } = generateTagsSchema.parse(input)

        // 1. Check Cache
        const normalizedType = type.toUpperCase().replace(/\s+/g, '_');
        const existingItem = await db.query.globalItems.findFirst({
            where: and(
                sql`lower(${globalItems.title}) = lower(${title})`,
                eq(globalItems.categoryType, normalizedType)
            )
        });

        if (existingItem?.cachedTags) {
            try {
                const cached = JSON.parse(existingItem.cachedTags);
                if (Array.isArray(cached) && cached.length > 0) {
                    console.log(`[AI Cache] Hit for tags: "${title}"`);
                    return { tags: cached };
                }
            } catch (e) { /* Invalid JSON, regenerate */ }
        }

        // Fetch LLM config from database
        const provider = await SystemConfigService.getDecryptedConfig('llm_provider') || 'openrouter';
        const apiKey = await SystemConfigService.getDecryptedConfig('llm_api_key');
        const endpoint = await SystemConfigService.getDecryptedConfig('llm_endpoint');
        const model = await SystemConfigService.getDecryptedConfig('llm_model');
        const anannasKey = await SystemConfigService.getDecryptedConfig('anannas_api_key');
        const anthropicKey = await SystemConfigService.getDecryptedConfig('anthropic_api_key');
        const openaiKey = await SystemConfigService.getDecryptedConfig('openai_api_key');
        const openrouterKey = await SystemConfigService.getDecryptedConfig('openrouter_api_key');
        const googleAiKey = await SystemConfigService.getDecryptedConfig('google_ai_api_key');

        let finalApiKey = apiKey;
        if (!finalApiKey) {
            switch (provider) {
                case 'ananas': finalApiKey = anannasKey; break;
                case 'anthropic': finalApiKey = anthropicKey; break;
                case 'openai': finalApiKey = openaiKey; break;
                case 'openrouter': finalApiKey = openrouterKey; break;
                case 'google': finalApiKey = googleAiKey; break;
            }
        }
        finalApiKey = finalApiKey || openrouterKey || anannasKey || anthropicKey || openaiKey || googleAiKey;

        if (!finalApiKey) {
            throw new Error('LLM API Key not configured in System Settings')
        }

        const systemPrompt = `You are an expert curator. Generate 5-8 relevant tags for the given item.

TAG RULES:
- Generate 5-8 tags
- Include: Genre, Mood, Theme, Era/Period
- Be specific and useful for discovery
- Each tag should be 1-3 words

Return ONLY a comma-separated list of tags. No JSON, no quotes, no markdown.
Example: Action, Sci-Fi, Dark Atmosphere, 1990s, Cyberpunk, Neo-Noir`;

        const userPrompt = `Generate tags for:
Title: ${sanitizeInput(title, 150)}
Type: ${sanitizeInput(type, 50)}
${description ? `Description: ${sanitizeInput(description, 300)}` : ''}`;

        const response = await callLLM({
            userPrompt,
            systemPrompt,
            apiKey: finalApiKey,
            provider,
            model: model || undefined,
            endpoint: endpoint || undefined
        });

        // Parse comma-separated tags
        const tags = response
            .split(',')
            .map(tag => tag.trim())
            .filter(tag => tag.length > 0 && tag.length < 50)
            .slice(0, 8);

        // 2. Update Cache
        if (existingItem) {
            await db.update(globalItems)
                .set({ cachedTags: JSON.stringify(tags) })
                .where(eq(globalItems.id, existingItem.id));
        } else {
            await db.insert(globalItems).values({
                title,
                cachedTags: JSON.stringify(tags),
                categoryType: normalizedType
            });
        }

        return { tags }

    } catch (e: any) {
        console.error("Generate Tags Error:", e)
        return { error: e.message || "Generation Failed" }
    }
}

// Backward compatibility wrappers for legacy imports
export async function generateDescription(title: string, type: string): Promise<string | null> {
    const result = await generateDescriptionAction({ title, type })
    return result.description || null
}

export async function generateTags(title: string, description: string, type: string): Promise<{ id: string; name: string }[]> {
    const result = await generateTagsAction({ title, type, description })
    if (result.tags) {
        // Create tags and return them
        const { createTag } = await import('@/lib/actions/tags')
        const tagPromises = result.tags.map(async (tagName: string) => {
            const tag = await createTag(tagName)
            return tag
        })
        const tags = await Promise.all(tagPromises)
        return tags.filter((t): t is { id: string; name: string } => t !== null)
    }
    return []
}

// Stub for legacy import (TODO: implement properly if needed)
export async function suggestMetadataSchema(categoryName: string, categoryDescription?: string): Promise<{ name: string; type: 'text' | 'number' | 'date' | 'url'; required?: boolean }[]> {
    // Returns empty array - feature not yet implemented
    return []
}
