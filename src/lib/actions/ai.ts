'use server'

import { callLLM } from '@/lib/llm'
import { SystemConfigService } from '@/lib/services/SystemConfigService'
import { createClient } from '@/lib/supabase/server'
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
            return { description: existingItem.description };
        }

        // If cached description was a refusal, log it
        if (existingItem?.description && isRefusal(existingItem.description)) {
            console.log(`[AI Cache] Skipping cached refusal for: "${title}" - regenerating...`);
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

        const systemPrompt = `You are an expert curator and critic optimizing descriptions for semantic search and discovery.

DESCRIPTION FORMAT (150-250 words total):

1. PREMISE (2-3 sentences): Core plot/concept and what makes it unique

2. THEMES & TROPES (2-3 sentences): Explicitly name relevant themes and tropes that fans would search for:
   - Character archetypes: "overpowered protagonist", "reluctant hero", "anti-hero", "chosen one"
   - Story tropes: "isekai", "time loop", "found family", "enemies-to-lovers", "redemption arc"
   - Themes: "power fantasy", "coming of age", "existential crisis", "revenge", "survival"

3. TONE & APPEAL (1-2 sentences): Who would enjoy this and why. Mood keywords.

4. FOOTER (on new line after double newline):
Year: YYYY | Creator: [Name] | Notable Awards: [Awards or "None"]

CRITICAL: Include searchable keywords that match how fans describe this genre/type.
Return ONLY the description text. No JSON, no markdown, no quotes.`;

        const userPrompt = `Generate a description for:
Title: ${sanitizeInput(title, 150)}
Type: ${sanitizeInput(type, 50)}
${context ? `Additional Context: ${sanitizeInput(context, 300)}` : ''}`;

        // ============================================
        // ATTEMPT 1: Primary Model
        // ============================================
        let response = await callLLM({
            userPrompt,
            systemPrompt,
            apiKey: finalApiKey,
            provider,
            model: model || undefined,
            endpoint: endpoint || undefined,
            timeoutMs: 60000
        });

        let description = response.trim();
        if (description.startsWith('{') || description.startsWith('"')) {
            try {
                const parsed = JSON.parse(description);
                description = typeof parsed === 'string' ? parsed : parsed.description || description;
            } catch { }
        }

        // Check for refusal - if so, try Grok
        if (isRefusal(description)) {
            console.log(`[AI] Primary model refused "${title}". Switching to Grok...`);

            // ============================================
            // ATTEMPT 2: Grok Fallback (same prompt, different model)
            // ============================================
            try {
                response = await callLLM({
                    userPrompt,  // Same prompt as primary
                    systemPrompt,  // Same system prompt as primary
                    apiKey: openrouterKey || finalApiKey,
                    provider: 'openrouter',
                    model: 'x-ai/grok-4.1-fast',
                    timeoutMs: 60000
                });

                description = response.trim();

                // If Grok also refused, use a generic placeholder
                if (isRefusal(description)) {
                    console.log(`[AI] Grok also refused "${title}". Using placeholder.`);
                    description = `${title} - A ${type.toLowerCase()} title. No detailed description available.`;
                }
            } catch (grokError) {
                console.log(`[AI] Grok fallback failed for "${title}". Using placeholder.`);
                description = `${title} - A ${type.toLowerCase()} title. No detailed description available.`;
            }
        }

        // 2. Update Cache (only if not a refusal)
        if (!isRefusal(description)) {
            if (existingItem) {
                await (supabase.from('global_items') as any)
                    .update({ description })
                    .eq('id', existingItem.id)
            } else {
                await (supabase.from('global_items') as any).insert({
                    title,
                    description,
                    category_type: normalizedType
                })
            }
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
        const supabase = await createClient()

        // 1. Check Cache
        const normalizedType = type.toUpperCase().replace(/\s+/g, '_');
        const { data: existingItem } = await (supabase.from('global_items') as any)
            .select('*')
            .ilike('title', title)
            .eq('category_type', normalizedType)
            .single()

        if (existingItem?.cached_tags) {
            try {
                const cached = JSON.parse(existingItem.cached_tags);
                if (Array.isArray(cached) && cached.length > 0) {
                    console.log(`[AI Cache] Hit for tags: "${title}"`);
                    return { tags: cached };
                }
            } catch { /* Invalid JSON, regenerate */ }
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
        const tags = response
            .split(',')
            .map(tag => tag.trim())
            .filter(tag => tag.length > 0 && tag.length < 50)
            .slice(0, 8);

        // 2. Update Cache
        if (existingItem) {
            await (supabase.from('global_items') as any)
                .update({ cached_tags: JSON.stringify(tags) })
                .eq('id', existingItem.id)
        } else {
            await (supabase.from('global_items') as any).insert({
                title,
                cached_tags: JSON.stringify(tags),
                category_type: normalizedType
            })
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
        return tags.filter((t: any): t is { id: string; name: string } => t !== null)
    }
    return []
}

// Stub for legacy import (TODO: implement properly if needed)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function suggestMetadataSchema(_categoryName: string, _categoryDescription?: string): Promise<{ name: string; type: 'text' | 'number' | 'date' | 'url'; required?: boolean }[]> {
    // Returns empty array - feature not yet implemented
    return []
}
