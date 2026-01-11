/**
 * Shared types and utilities for all content harvesters
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { callLLM } from '@/lib/llm';
import { decrypt } from '@/lib/encryption';

// ============================================================================
// TYPES
// ============================================================================

export interface HarvestItem {
    title: string;
    description: string;
    image_url: string | null;
    category_type: string;
    external_ids: Record<string, any>;
    metadata: Record<string, any>;
    release_year?: number | null;
    original_language?: string | null;
    embedding?: number[];
    tags?: string[];
    cached_tags?: { id: string, name: string }[];
}

export interface HarvestResult {
    success: number;
    skipped: number;
    failed: number;
    category: string;
}

export interface LLMConfig {
    provider: string;
    apiKey: string;
    model?: string;
    endpoint?: string;
}

// ============================================================================
// SHARED UTILITIES
// ============================================================================

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Simple concurrency limiter (p-limit style)
 */
export function createLimiter(concurrency: number) {
    let active = 0;
    const queue: (() => void)[] = [];

    return async <T>(fn: () => Promise<T>): Promise<T> => {
        while (active >= concurrency) {
            await new Promise<void>(resolve => queue.push(resolve));
        }
        active++;
        try {
            return await fn();
        } finally {
            active--;
            const next = queue.shift();
            if (next) next();
        }
    };
}

// Global limiter for AI rewrites (5 concurrent)
export const aiLimiter = createLimiter(5);

// ============================================================================
// LLM CONFIG (fetched directly from database)
// ============================================================================

let cachedLLMConfig: LLMConfig | null = null;

export async function getLLMConfig(supabase: ReturnType<typeof createServiceRoleClient>): Promise<LLMConfig> {
    if (cachedLLMConfig) return cachedLLMConfig;

    async function getSetting(key: string): Promise<string | null> {
        const { data } = await (supabase.from('system_settings') as any)
            .select('value')
            .eq('key', key)
            .single();
        return data?.value ? decrypt(data.value) : null;
    }

    const provider = await getSetting('llm_provider') || 'openrouter';
    let apiKey = await getSetting('llm_api_key');
    const model = await getSetting('llm_model');
    const endpoint = await getSetting('llm_endpoint');

    if (!apiKey) {
        switch (provider) {
            case 'anthropic': apiKey = await getSetting('anthropic_api_key'); break;
            case 'openai': apiKey = await getSetting('openai_api_key'); break;
            case 'openrouter': apiKey = await getSetting('openrouter_api_key'); break;
            case 'google': apiKey = await getSetting('google_ai_api_key'); break;
        }
    }

    if (!apiKey) {
        apiKey = await getSetting('openrouter_api_key') ||
            await getSetting('anthropic_api_key') ||
            await getSetting('openai_api_key') ||
            await getSetting('google_ai_api_key') || '';
    }

    cachedLLMConfig = { provider, apiKey: apiKey || '', model: model || undefined, endpoint: endpoint || undefined };
    return cachedLLMConfig;
}

// ============================================================================
// AI DESCRIPTION REWRITE (with refusal handling)
// ============================================================================

// Patterns that indicate the AI is refusing to generate content
const REFUSAL_PATTERNS = [
    // Direct refusals
    "I can't generate", "I cannot generate", "I am unable to",
    "I'm not able to", "I apologize, but", "I can't help with",
    "I won't be able to", "I must decline", "I cannot create",
    "I can't create", "I cannot provide", "I can't provide",
    // Content policy triggers
    "sexually explicit", "adult content", "harmful content",
    "violates my safety", "inappropriate content", "explicit content",
    "mature content", "NSFW", "not appropriate",
    // Soft refusals (offers to help with something else)
    "I'm happy to help with other", "happy to help with those instead",
    "If you have other", "I'd be glad to help with",
    // Meta-commentary
    "As an AI", "I cannot fulfill", "against my guidelines",
    "content policy", "safety guidelines"
];

// Fallback model for mature/controversial content
const GROK_MODEL = 'x-ai/grok-4.1-fast';

/**
 * Check if a response contains refusal patterns
 */
function isRefusal(response: string): boolean {
    const lowerResponse = response.toLowerCase();

    // Check for explicit refusal patterns
    const hasRefusalPattern = REFUSAL_PATTERNS.some(pattern =>
        lowerResponse.includes(pattern.toLowerCase())
    );

    if (hasRefusalPattern) return true;

    // Heuristic: If response mentions "help" near the end and is very long, it's likely a refusal
    if (lowerResponse.includes("help") && response.length > 200 &&
        (lowerResponse.includes("instead") || lowerResponse.includes("other"))) {
        return true;
    }

    return false;
}

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

        let description = response.trim();

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

            description = response.trim();

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
        return originalDescription;

    } catch {
        console.warn(`⚠️ Description rewrite failed for "${title}"`);
        return originalDescription;
    }
}

// ============================================================================
// AI TAG GENERATION
// ============================================================================

export async function generateTags(
    supabase: ReturnType<typeof createServiceRoleClient>,
    title: string,
    description: string,
    type: string
): Promise<string[]> {
    try {
        const config = await getLLMConfig(supabase);
        if (!config.apiKey) return [];

        const systemPrompt = `You are an expert curator. Generate 3-5 relevant tags for the item.
Return ONLY a comma-separated list of tags. No numbering, no quotes.
Example: "Cinematic, Dystopian, Sci-Fi, Atmospheric"`;

        const userPrompt = `Generate tags for:
Title: ${title}
Type: ${type}
Description: ${description}`;

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
            .filter(t => t.length > 2 && t.length < 30) // Sanity check
            .slice(0, 8); // Max 8 tags
    } catch {
        console.warn(`⚠️ Tag generation failed for "${title}"`);
        return [];
    }
}

/**
 * Ensures tags exist in database and returns their IDs
 */
export async function ensureTags(
    supabase: ReturnType<typeof createServiceRoleClient>,
    tagNames: string[]
): Promise<{ id: string, name: string }[]> {
    if (!tagNames.length) return [];

    // Deduplicate and normalize
    const uniqueNames = [...new Set(tagNames.map(n => n.trim()).filter(n => n.length > 0))];

    // 1. Get existing
    const { data: existing } = await supabase
        .from('tags')
        .select('id, name')
        .in('name', uniqueNames);

    const existingMap = new Map((existing || []).map((t: any) => [t.name.toLowerCase(), t]));
    const toCreate = uniqueNames.filter(name => !existingMap.has(name.toLowerCase()));

    // 2. Create missing
    let newTags: any[] = [];
    if (toCreate.length > 0) {
        const { data, error } = await (supabase.from('tags') as any)
            .insert(toCreate.map(name => ({ name })))
            .select('id, name');

        if (!error && data) {
            newTags = data;
        }
    }

    // 3. Combine
    const allTags = [...(existing || []), ...newTags];
    return allTags;
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

export async function checkItemExists(
    supabase: ReturnType<typeof createServiceRoleClient>,
    externalIdKey: string,
    externalIdValue: string | number
): Promise<boolean> {
    const { data } = await supabase
        .from('global_items')
        .select('id')
        .contains('external_ids', { [externalIdKey]: externalIdValue })
        .limit(1);
    return !!(data && data.length > 0);
}

export async function upsertItem(
    supabase: ReturnType<typeof createServiceRoleClient>,
    item: HarvestItem,
    externalIdKey: string,
    externalIdValue: string | number
): Promise<boolean> {
    // Check if item with same external_id already exists
    const { data: existing } = await supabase
        .from('global_items')
        .select('id')
        .contains('external_ids', { [externalIdKey]: externalIdValue })
        .limit(1);

    if (existing && existing.length > 0) {
        // Update existing record
        const { error } = await (supabase.from('global_items') as any)
            .update({
                description: item.description,
                image_url: item.image_url,
                metadata: item.metadata,
                release_year: item.release_year,
                original_language: item.original_language,
                ...(item.cached_tags ? { cached_tags: item.cached_tags } : {}),
                ...(item.embedding ? { embedding: item.embedding } : {})
            })
            .eq('id', (existing[0] as any).id);

        if (error) {
            console.error(`❌ Update failed for "${item.title}":`, error.message);
            return false;
        }
    } else {
        // Insert new - handle potential title conflicts
        let titleToUse = item.title;

        // Check if title already exists in this category (case-insensitive)
        const { data: titleConflict } = await (supabase.from('global_items') as any)
            .select('id, title')
            .ilike('title', item.title)
            .eq('category_type', item.category_type)
            .limit(1);

        if (titleConflict && titleConflict.length > 0) {
            // Title conflict exists - append year if available
            const year = item.release_year ||
                (item.metadata?.release_date ? new Date(item.metadata.release_date).getFullYear() : null);

            if (year && !item.title.includes(`(${year})`)) {
                titleToUse = `${item.title} (${year})`;
                console.log(`   ⚠️ Title conflict, using: "${titleToUse}"`);
            } else {
                // No year available or already has year, skip to avoid duplicate
                console.log(`   ⏭️ Skipping duplicate title: "${item.title}"`);
                return false;
            }
        }

        const { error } = await (supabase.from('global_items') as any).insert({
            ...item,
            title: titleToUse
        });

        if (error) {
            // If still getting unique constraint violation, log and skip
            if (error.code === '23505') {
                console.log(`   ⏭️ Duplicate detected, skipping: "${titleToUse}"`);
                return false;
            }
            console.error(`❌ Insert failed for "${titleToUse}":`, error.message);
            return false;
        }
    }

    return true;
}

// ============================================================================
// EMBEDDING GENERATION
// ============================================================================

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;
const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";

export async function generateEmbedding(text: string): Promise<number[] | null> {
    if (!VOYAGE_API_KEY) return null;

    try {
        const response = await fetch(VOYAGE_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${VOYAGE_API_KEY}`,
            },
            body: JSON.stringify({
                model: "voyage-3",
                input: [text],
            }),
        });

        if (!response.ok) return null;

        const data = await response.json();
        return data.data?.[0]?.embedding || null;
    } catch {
        return null;
    }
}
