import { db } from '@/lib/db';
import { systemSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { encrypt, decrypt } from '@/lib/encryption';
import { unstable_noStore as noStore } from 'next/cache';
import { cache } from 'react';

// =============================================================================
// TYPED SYSTEM SETTINGS
// =============================================================================

/**
 * All known system configuration keys.
 * This provides autocomplete and compile-time validation.
 */
export type SystemSettingKey =
    // Media API Keys
    | 'tmdb_api_key'
    | 'rawg_api_key'
    | 'google_books_api_key'
    | 'spotify_client_id'
    | 'spotify_client_secret'
    | 'bgg_api_key'
    | 'comicvine_api_key'
    // Media API URLs (custom endpoints)
    | 'tmdb_api_url'
    | 'rawg_api_url'
    | 'google_books_api_url'
    | 'spotify_api_url'
    | 'anilist_api_url'
    | 'comicvine_api_url'
    | 'bgg_api_url'
    | 'itunes_api_url'
    // LLM Configuration
    | 'llm_provider'
    | 'llm_api_key'
    | 'llm_endpoint'
    | 'llm_model'
    | 'anannas_api_key'
    | 'anthropic_api_key'
    | 'openai_api_key'
    | 'openrouter_api_key'
    | 'google_ai_api_key'
    // Email Configuration
    | 'resend_api_key'
    | 'resend_from_email'
    // Vector DB (for future AI recommendations)
    | 'embedding_provider'
    | 'embedding_model'
    | 'vector_db_provider'
    | 'vector_db_url'
    | 'vector_db_api_key'
    | 'vector_db_index'
    // Feature Flags
    | 'feature_ai_critic'
    | 'feature_smart_sort'
    | 'feature_recommendations'
    | 'feature_challenges'

/**
 * Typed settings map. All values are strings (decrypted).
 * Use Partial since not all keys may be present.
 */
export type SystemSettings = Partial<Record<SystemSettingKey, string>>

// =============================================================================
// REQUEST-MEMOIZED INTERNAL HELPERS
// These are wrapped with cache() from React to dedupe calls within a single request.
// If the same key is requested multiple times in one request, DB+decrypt happens once.
// =============================================================================

/**
 * Memoized: Fetches all settings from DB and decrypts them.
 * Cached per-request so multiple calls return the same promise.
 */
const fetchAllSettingsDecrypted = cache(async (): Promise<SystemSettings> => {
    const allSettings = await db.query.systemSettings.findMany();
    const config: SystemSettings = {};
    for (const s of allSettings) {
        config[s.key as SystemSettingKey] = decrypt(s.value);
    }
    return config;
});

/**
 * Memoized: Fetches a single setting from DB and decrypts it.
 * Cached per-request per-key.
 */
const fetchSingleSettingDecrypted = cache(async (key: SystemSettingKey): Promise<string | null> => {
    const setting = await db.query.systemSettings.findFirst({
        where: eq(systemSettings.key, key),
    });
    if (!setting) return null;
    return decrypt(setting.value);
});


export class SystemConfigService {
    /**
     * INTERNAL: Fetches all settings properly decrypted as a map.
     * Use this for internal services (e.g. MediaService) that need API keys.
     * Request-memoized: safe to call multiple times per request.
     */
    static async getRawConfigMap(): Promise<SystemSettings> {
        return fetchAllSettingsDecrypted();
    }

    /**
     * READ: Fetches and decrypts a setting for internal server use.
     * Request-memoized: same key fetched twice in one request = 1 DB call.
     * WARNING: Never expose the result of this directly to the client API response
     * if the setting is marked as secret.
     */
    static async getDecryptedConfig(key: SystemSettingKey): Promise<string | null> {
        return fetchSingleSettingDecrypted(key);
    }

    /**
     * MANAGE: Fetches all settings for the Admin Dashboard.
     * Automatically masks secrets.
     */
    static async getAllSettings() {
        noStore();
        const allSettings = await db.query.systemSettings.findMany({
            orderBy: systemSettings.category,
        });

        return allSettings.map(setting => ({
            key: setting.key,
            value: setting.isSecret ? '********' : decrypt(setting.value),
            category: setting.category,
            isSecret: setting.isSecret,
            updatedAt: setting.updatedAt,
        }));
    }

    /**
     * UPDATE: Encrypts and saves a setting.
     */
    static async updateSetting(
        key: string,
        rawValue: string,
        category: string = 'GENERAL',
        isSecret: boolean = false
    ) {
        // Encrypt immediately
        const encryptedValue = encrypt(rawValue);

        // Upsert logic
        await db.insert(systemSettings)
            .values({
                key,
                value: encryptedValue,
                category,
                isSecret,
            })
            .onConflictDoUpdate({
                target: systemSettings.key,
                set: {
                    value: encryptedValue,
                    category,
                    isSecret,
                    updatedAt: new Date(),
                },
            });

        // Return public view (masked if secret)

        return {
            key,
            value: isSecret ? '********' : rawValue,
            category,
            isSecret,
        };
    }

    /**
     * DISCOVERY: Fetches available models for a given provider.
     * Currently supports dynamic fetching for Ollama.
     */
    static async getAvailableModels(provider: string) {
        if (provider === 'ollama') {
            try {
                // Default Ollama port
                const res = await fetch('http://127.0.0.1:11434/api/tags', { next: { revalidate: 0 } })
                if (!res.ok) return []
                const data = await res.json()
                // Ollama returns { models: [ { name: '...', ... } ] }
                return data.models.map((m: any) => ({
                    id: m.name,
                    name: m.name
                }))
            } catch (error) {
                console.error("Failed to fetch Ollama models:", error)
                return []
            }
        }

        // Return empty for others (handled by client-side static list for now)
        return []
    }
}
