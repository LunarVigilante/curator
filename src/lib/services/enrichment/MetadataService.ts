/**
 * Metadata Service
 * 
 * Handles fetching metadata from external providers using the provider registry.
 * This is the "fast path" - no AI calls, just API fetches.
 * 
 * Each category routes to its appropriate provider:
 * - MOVIE, TV_SHOW → TMDBProvider + OMDB
 * - VIDEO_GAME → VideoGameProvider (IGDB)
 * - BOARD_GAME → BoardGameProvider (BGG)
 * - ANIME, MANGA → AnimeProvider (AniList)
 * - MUSIC_* → MusicProvider (Spotify)
 * - BOOK → BookProvider (Google Books)
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { getProviderForCategory, hasProvider } from './providers'

// ============================================================================
// TYPES
// ============================================================================

export interface MetadataRefreshResult {
    success: boolean
    fieldsUpdated: string[]
    enrichedData: Record<string, any>
    providerName?: string
    error?: string
}

export interface MetadataRefreshOptions {
    force?: boolean // Overwrite existing values
}

// ============================================================================
// MAIN SERVICE FUNCTION
// ============================================================================

/**
 * Refresh metadata for an item from external providers.
 * This is fast (no AI) - just fetches from the appropriate provider.
 */
export async function refreshMetadata(
    supabase: SupabaseClient,
    itemId: string,
    options: MetadataRefreshOptions = {}
): Promise<MetadataRefreshResult> {
    const { force = false } = options

    // Get current item
    const { data: existingItem, error: fetchError } = await (supabase.from('global_items') as any)
        .select('*')
        .eq('id', itemId)
        .single()

    if (fetchError || !existingItem) {
        return { success: false, fieldsUpdated: [], enrichedData: {}, error: 'Item not found' }
    }

    const { category_type: type } = existingItem

    // Check if we have a provider for this category
    if (!hasProvider(type)) {
        console.warn(`[MetadataService] No provider for category: ${type}`)
        return {
            success: true,
            fieldsUpdated: [],
            enrichedData: {},
            error: `No metadata provider for category: ${type}`
        }
    }

    // Get the appropriate provider
    const provider = getProviderForCategory(type)
    if (!provider) {
        return {
            success: false,
            fieldsUpdated: [],
            enrichedData: {},
            error: `Provider not found for category: ${type}`
        }
    }

    // Fetch metadata using the provider
    console.log(`[MetadataService] Using ${provider.name} for ${existingItem.title}`)
    const result = await provider.fetchMetadata(existingItem, force)

    if (!result.success) {
        return {
            success: false,
            fieldsUpdated: [],
            enrichedData: {},
            providerName: provider.name,
            error: result.error
        }
    }

    return {
        success: true,
        fieldsUpdated: result.fieldsUpdated,
        enrichedData: result.data,
        providerName: provider.name
    }
}
