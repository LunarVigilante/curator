/**
 * Shared types and utilities for all content harvesters
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { callLLM } from '@/lib/llm';
import { decrypt } from '@/lib/encryption';
import type { StructuredDescription } from '@/lib/ai/structured-description';

// ============================================================================
// TYPES
// ============================================================================

export interface HarvestItem {
    title: string;
    description: string;
    description_parts?: StructuredDescription;
    image_url: string | null;
    category_type: string;
    external_ids: Record<string, any>;
    metadata: Record<string, any>;
    release_year?: number | null;
    original_language?: string | null;
    origin_countries?: string[] | null;
    embedding?: number[];
    tags?: string[];
    cached_tags?: { id: string, name: string }[];
    // Additional fields used for rich embeddings
    genres?: string[];
    cast?: string[];
    director?: string;
    studio?: string;
    developers?: string[];
    publishers?: string[];
    designers?: string[];
    mechanics?: string[];
    platforms?: string[];
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

/**
 * Decode HTML entities (e.g., &amp;#039; -> ')
 */
export function decodeHTMLEntities(text: string): string {
    if (!text) return '';
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&#39;/g, "'")
        .replace(/&#x27;/g, "'")
        .replace(/&ndash;/g, '–')
        .replace(/&mdash;/g, '—')
        .replace(/&hellip;/g, '…')
        .replace(/&#10;/g, ' ')
        .replace(/&nbsp;/g, ' ');
}

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Patterns to remove - only match at START of line or after newline
const HEADER_PATTERNS = [
    /(?:^|\n)\s*(?:\d+\.\s*)?PREMISE\s*:?\s*/gim,
    /(?:^|\n)\s*(?:\d+\.\s*)?THEMES?\s*(?:&|AND)?\s*TROPES?\s*:?\s*/gim,
    /(?:^|\n)\s*(?:\d+\.\s*)?TONE\s*(?:&|AND)?\s*APPEAL\s*:?\s*/gim,
    /(?:^|\n)\s*(?:\d+\.\s*)?CHARACTER\s*ARCHETYPES?\s*:?\s*/gim,
    /(?:^|\n)\s*(?:\d+\.\s*)?STORY\s*TROPES?\s*:?\s*/gim,
    /(?:^|\n)\s*(?:\d+\.\s*)?FOOTER\s*:?\s*/gim,
];

export function cleanDescription(description: string): string {
    let cleaned = description;

    // 1. Remove Headers
    for (const pattern of HEADER_PATTERNS) {
        cleaned = cleaned.replace(pattern, '');
    }

    // 2. Fix Paragraphs
    // Replace 3+ newlines with 2 newlines (standard paragraph break)
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

    // Replace multiple spaces (NOT newlines) with single space
    cleaned = cleaned.replace(/[^\S\r\n]{2,}/g, ' ');

    // Trim lines
    cleaned = cleaned.split('\n').map(line => line.trim()).join('\n');

    return cleaned.trim();
}

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
                description_parts: item.description_parts || null,
                image_url: item.image_url,
                metadata: item.metadata,
                release_year: item.release_year,
                original_language: item.original_language,
                origin_countries: item.origin_countries,
                last_metadata_update: new Date().toISOString(),
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
