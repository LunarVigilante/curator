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
    embedding?: number[];
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
// AI DESCRIPTION REWRITE
// ============================================================================

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

        const systemPrompt = `You are an expert curator and critic. Generate a compelling description for the given item.

DESCRIPTION FORMAT:
1. Body: Maximum 50 words. Focus on plot summary first, then the vibe/atmosphere.
2. Footer: After the body, append exactly this format on a new line after a double newline:

Year: YYYY | Creator: [Name] | Notable Awards: [Awards or "None"]

Return ONLY the description text. No JSON, no markdown, no quotes.`;

        const userPrompt = `Generate a description for:
Title: ${title}
Type: ${type}
Additional Context: ${originalDescription}`;

        const response = await callLLM({
            userPrompt,
            systemPrompt,
            apiKey: config.apiKey,
            provider: config.provider,
            model: config.model,
            endpoint: config.endpoint,
            timeoutMs: 60000
        });

        const description = response.trim();
        return description.length > 20 ? description : originalDescription;
    } catch (error) {
        console.warn(`⚠️ Description rewrite failed for "${title}"`);
        return originalDescription;
    }
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
    return data && data.length > 0;
}

export async function upsertItem(
    supabase: ReturnType<typeof createServiceRoleClient>,
    item: HarvestItem,
    externalIdKey: string,
    externalIdValue: string | number
): Promise<boolean> {
    const { data: existing } = await supabase
        .from('global_items')
        .select('id')
        .contains('external_ids', { [externalIdKey]: externalIdValue })
        .limit(1);

    if (existing && existing.length > 0) {
        // Update existing
        const { error } = await (supabase.from('global_items') as any)
            .update({
                description: item.description,
                image_url: item.image_url,
                metadata: item.metadata,
            })
            .eq('id', existing[0].id);

        if (error) {
            console.error(`❌ Update failed for "${item.title}":`, error.message);
            return false;
        }
    } else {
        // Insert new
        const { error } = await (supabase.from('global_items') as any).insert(item);

        if (error) {
            console.error(`❌ Insert failed for "${item.title}":`, error.message);
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
