'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { requireAdmin } from '@/lib/auth'
import { refreshMetadata } from '@/lib/services/enrichment/MetadataService'
import { buildEmbeddingText } from '@/lib/ai/structured-description'
import { generateEmbedding } from '@/lib/harvesters/shared'

interface FixMatchResult {
    success: boolean
    error?: string
    updatedItem?: Record<string, any>
}

/**
 * Fix an item's match by updating its external ID and refreshing metadata.
 * This is an admin-only action.
 */
export async function fixItemMatch(
    itemId: string,
    providerId: string,
    providerSource: string
): Promise<FixMatchResult> {
    try {
        await requireAdmin()

        // Use service role client for updates to bypass any strict RLS on specific columns if needed
        const supabase = createServiceRoleClient()

        console.log(`[FixMatch] Fixing match for item ${itemId} -> ${providerSource}:${providerId}`)

        // 1. First, fetch the current item to get existing external_ids
        const { data: currentItem, error: fetchError } = await supabase
            .from('global_items')
            .select('external_ids')
            .eq('id', itemId)
            .single()

        if (fetchError) {
            console.error('[FixMatch] Failed to fetch item:', fetchError)
            return { success: false, error: 'Failed to fetch item' }
        }

        // 2. Update the external_ids JSON with the new provider ID
        // Map provider source to the key used in external_ids
        const providerKey = providerSource === 'TMDB' ? 'tmdb' : providerSource.toLowerCase()

        // Strip any prefix from the providerId (e.g., "tmdb-627725" -> "627725")
        const cleanProviderId = providerId.replace(/^[a-z]+-/i, '')

        const updatedExternalIds = {
            ...(currentItem?.external_ids as Record<string, any> || {}),
            [providerKey]: cleanProviderId
        }

        const updateData: Record<string, any> = {
            external_ids: updatedExternalIds,
            last_metadata_update: new Date().toISOString()
        }

        const { error: updateError } = await supabase
            .from('global_items')
            .update(updateData)
            .eq('id', itemId)

        if (updateError) {
            console.error('[FixMatch] Failed to update external ID:', updateError)
            return { success: false, error: 'Failed to update item ID' }
        }

        // 2. Refresh metadata immediately
        // We use force: true to overwrite existing data with the new match's data
        const metadataResult = await refreshMetadata(supabase, itemId, { force: true })

        if (!metadataResult.success) {
            console.error('[FixMatch] Metadata refresh failed:', metadataResult.error)
            return { success: false, error: 'ID updated, but metadata refresh failed: ' + metadataResult.error }
        }

        // 3. Update enriched data
        if (Object.keys(metadataResult.enrichedData).length > 0) {
            const { error: dataUpdateError } = await (supabase as any)
                .from('global_items')
                .update(metadataResult.enrichedData)
                .eq('id', itemId)

            if (dataUpdateError) {
                console.error('[FixMatch] Failed to save enriched data:', dataUpdateError)
                return { success: false, error: 'Failed to save new metadata' }
            }
        }

        // 4. Regenerate embedding for the new content
        try {
            const { data: updatedItem } = await (supabase as any)
                .from('global_items')
                .select('*')
                .eq('id', itemId)
                .single()

            if (updatedItem) {
                const embeddingText = buildEmbeddingText(updatedItem)
                const embedding = await generateEmbedding(embeddingText)

                if (embedding) {
                    await (supabase as any)
                        .from('global_items')
                        .update({ embedding })
                        .eq('id', itemId)
                }
            }
        } catch (embedError) {
            console.warn('[FixMatch] Embedding generation failed (non-critical):', embedError)
        }

        revalidatePath('/items/' + itemId)
        revalidatePath('/admin/data-browser')

        // Fetch final updated item to return
        const { data: finalItem } = await supabase
            .from('global_items')
            .select('*')
            .eq('id', itemId)
            .single()

        return { success: true, updatedItem: finalItem }
    } catch (error) {
        console.error('[FixMatch] Unexpected error:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
}
