'use server'

import { callLLM } from '@/lib/llm'
import { SystemConfigService } from '@/lib/services/SystemConfigService'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
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
        const supabase = await createClient()
        const serviceClient = createServiceRoleClient()

        // Refusal patterns - don't use cached descriptions that contain these
        const REFUSAL_PATTERNS = [
            "I can't generate", "I cannot generate", "I am unable to",
            "I'm not able to", "I apologize, but", "I can't help with",
            "sexually explicit", "adult content", "harmful content",
            "violates my safety", "I cannot fulfill", "As an AI",
            "happy to help with those instead", "If you have other"
        ];

        const isRefusal = (text: string) => {
            const lower = text.toLowerCase();
            return REFUSAL_PATTERNS.some(p => lower.includes(p.toLowerCase()));
        };

        // 1. Check Cache (but skip if cached description is a refusal)
        const normalizedType = type.toUpperCase().replace(/\s+/g, '_');
        const { data: existingItem } = await (supabase.from('global_items') as any)
            .select('*')
            .ilike('title', title)
            .eq('category_type', normalizedType)
            .single()

        if (existingItem?.description && !isRefusal(existingItem.description)) {
            console.log(`[AI Cache] Hit for description: "${title}"`);
            return { description: existingItem.description, description_parts: existingItem.description_parts };
        }

        // If cached description was a refusal, log it
        if (existingItem?.description && isRefusal(existingItem.description)) {
            console.log(`[AI Cache] Skipping cached refusal for: "${title}" - regenerating...`);
        }

        // 2. Generate 4-part structured description using new system
        console.log(`[AI] Generating structured description for: "${title}"`);

        // Import structured description functions
        const { generateStructuredDescription, combineDescription } = await import('@/lib/ai/structured-description');

        const description_parts = await generateStructuredDescription(serviceClient, {
            title: sanitizeInput(title, 150),
            originalDescription: context || '',
            type: normalizedType,
            metadata: {}
        });

        // Combine for backwards-compatible description field
        const description = combineDescription(description_parts);

        // Check for refusal in any part
        const hasRefusal = [description_parts.premise, description_parts.themes, description_parts.tone, description_parts.style]
            .some(part => isRefusal(part || ''));

        if (hasRefusal) {
            console.log(`[AI] Structured generation had refusal for "${title}". Using placeholder.`);
            return {
                description: `${title} - A ${type.toLowerCase()} title. No detailed description available.`,
                description_parts: null
            };
        }

        // 3. Update Cache with both description and description_parts
        if (existingItem) {
            await (supabase.from('global_items') as any)
                .update({ description, description_parts, last_metadata_update: new Date().toISOString() })
                .eq('id', existingItem.id)
        } else {
            await (supabase.from('global_items') as any).insert({
                title,
                description,
                description_parts,
                category_type: normalizedType
            })
        }

        console.log(`[AI] Structured description generated for "${title}"`);
        return { description, description_parts }

    } catch (e: any) {
        console.error("Generate Description Error:", e)
        return { error: e.message || "Generation Failed" }
    }
}

export async function generateTagsAction(input: z.input<typeof generateTagsSchema>) {
    try {
        const { title, type, description } = generateTagsSchema.parse(input)
        const supabase = createServiceRoleClient() // Use service role for global_items access

        // 1. Check Cache
        const normalizedType = type.toUpperCase().replace(/\s+/g, '_');
        const { data: existingItem } = await (supabase.from('global_items') as any)
            .select('*')
            .ilike('title', title)
            .eq('category_type', normalizedType)
            .single()

        // cached_tags is a jsonb column, so Supabase returns it as a native array, not a string
        if (existingItem?.cached_tags && Array.isArray(existingItem.cached_tags)) {
            // Check if these are proper {id, name} objects or just strings
            const cached = existingItem.cached_tags
            if (cached.length > 0 && typeof cached[0] === 'object' && cached[0].id && cached[0].name) {
                console.log(`[AI Cache] Hit for tags: "${title}"`);
                return { tags: cached.map((t: any) => t.name) };
            }
        }

        // Fetch LLM config from database
        console.log('[AI Tags] Fetching LLM configuration...');
        const provider = await SystemConfigService.getDecryptedConfig('llm_provider') || 'openrouter';
        const apiKey = await SystemConfigService.getDecryptedConfig('llm_api_key');
        const endpoint = await SystemConfigService.getDecryptedConfig('llm_endpoint');
        const model = await SystemConfigService.getDecryptedConfig('llm_model');
        const anannasKey = await SystemConfigService.getDecryptedConfig('anannas_api_key');
        const anthropicKey = await SystemConfigService.getDecryptedConfig('anthropic_api_key');
        const openaiKey = await SystemConfigService.getDecryptedConfig('openai_api_key');
        const openrouterKey = await SystemConfigService.getDecryptedConfig('openrouter_api_key');
        const googleAiKey = await SystemConfigService.getDecryptedConfig('google_ai_api_key');

        console.log('[AI Tags] Provider:', provider);
        console.log('[AI Tags] Model:', model);
        console.log('[AI Tags] Has llm_api_key:', !!apiKey);
        console.log('[AI Tags] Has openrouter_api_key:', !!openrouterKey);

        let finalApiKey = apiKey;
        if (!finalApiKey) {
            console.log('[AI Tags] No llm_api_key, falling back to provider-specific key...');
            switch (provider) {
                case 'ananas': finalApiKey = anannasKey; break;
                case 'anthropic': finalApiKey = anthropicKey; break;
                case 'openai': finalApiKey = openaiKey; break;
                case 'openrouter': finalApiKey = openrouterKey; break;
                case 'google': finalApiKey = googleAiKey; break;
            }
        }
        finalApiKey = finalApiKey || openrouterKey || anannasKey || anthropicKey || openaiKey || googleAiKey;

        console.log('[AI Tags] Final API key found:', !!finalApiKey);

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
        const tagNames = response
            .split(',')
            .map(tag => tag.trim())
            .filter(tag => tag.length > 0 && tag.length < 50)
            .slice(0, 8);

        // 2. Create tags in the tags table and get back {id, name} objects
        const { createTagsBatch } = await import('@/lib/actions/tags')
        const validTags = await createTagsBatch(tagNames)

        // 3. Update Cache with proper {id, name}[] format (not stringified!)
        if (existingItem) {
            const { error } = await (supabase.from('global_items') as any)
                .update({ cached_tags: validTags, last_metadata_update: new Date().toISOString() })
                .eq('id', existingItem.id)
            if (error) {
                console.error('[AI Tags] Failed to update cached_tags:', error)
            }
        } else {
            const { error } = await (supabase.from('global_items') as any).insert({
                title,
                cached_tags: validTags,
                category_type: normalizedType
            })
            if (error) {
                console.error('[AI Tags] Failed to insert cached_tags:', error)
            }
        }

        return { tags: tagNames }

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
        // Create tags and return them (normalization happens in createTag)
        const { createTag } = await import('@/lib/actions/tags')
        const tagPromises = result.tags.map(async (tagName: string) => {
            const tag = await createTag(tagName)
            return tag
        })
        const tags = await Promise.all(tagPromises)
        return tags.filter((t: any): t is { id: string; name: string } => t !== null && t !== undefined)
    }
    return []
}

// Stub for legacy import (TODO: implement properly if needed)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function suggestMetadataSchema(_categoryName: string, _categoryDescription?: string): Promise<{ name: string; type: 'text' | 'number' | 'date' | 'url'; required?: boolean }[]> {
    // Returns empty array - feature not yet implemented
    return []
}
