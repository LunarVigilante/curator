/**
 * LLM Configuration Service
 * 
 * Fetches LLM provider settings from database with caching
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { decrypt } from '@/lib/encryption';

export interface LLMConfig {
    provider: string;
    apiKey: string;
    model?: string;
    endpoint?: string;
}

let cachedLLMConfig: LLMConfig | null = null;

/**
 * Get LLM configuration from database (cached after first call)
 */
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

/**
 * Clear the cached LLM config (for testing or manual refresh)
 */
export function clearLLMConfigCache(): void {
    cachedLLMConfig = null;
}
