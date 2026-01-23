/**
 * Enrichment Pipeline
 * 
 * High-level orchestration for item enrichment that can be used by:
 * - API endpoints (enrich-metadata, regenerate-description)
 * - Harvest scripts
 * - Backfill scripts
 * 
 * This ensures consistent behavior across all entry points.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { refreshMetadata, MetadataRefreshOptions } from './MetadataService'
import { buildEmbeddingText, StructuredDescription } from '@/lib/ai/structured-description'
import { generateEmbedding, generateTags, ensureTags, rewriteDescription } from '@/lib/harvesters/shared'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { generateStructuredDescription, combineDescription } from '@/lib/ai/structured-description'

// ============================================================================
// TYPES
// ============================================================================

export interface EnrichmentOptions {
    // Metadata options
    refreshMetadata?: boolean
    metadataForce?: boolean    // Overwrite existing metadata values

    // AI options
    generateDescription?: boolean
    generateTags?: boolean

    // Embedding (always regenerated if anything changes)
    skipEmbedding?: boolean

    // Context for AI generation
    context?: {
        overview?: string
        keywords?: string[]
        genres?: string[]
    }
}

export interface EnrichmentResult {
    success: boolean
    metadataUpdated: boolean
    descriptionGenerated: boolean
    tagsGenerated: number
    embeddingGenerated: boolean
    fieldsUpdated: string[]
    error?: string
}

// ============================================================================
// MAIN PIPELINE
// ============================================================================

/**
 * Full enrichment pipeline for an item.
 * 
 * Usage:
 * - For "Refresh Metadata" button: { refreshMetadata: true }
 * - For "Regen Description" button: { generateDescription: true, generateTags: true }
 * - For harvest scripts (new items): { refreshMetadata: true, generateDescription: true, generateTags: true }
 * - For backfill: { generateDescription: true, generateTags: true }
 */
export async function enrichItem(
    supabase: SupabaseClient,
    itemId: string,
    options: EnrichmentOptions = {}
): Promise<EnrichmentResult> {
    const {
        refreshMetadata: doMetadata = false,
        metadataForce = false,
        generateDescription: doDescription = false,
        generateTags: doTags = false,
        skipEmbedding = false,
        context
    } = options

    const result: EnrichmentResult = {
        success: false,
        metadataUpdated: false,
        descriptionGenerated: false,
        tagsGenerated: 0,
        embeddingGenerated: false,
        fieldsUpdated: []
    }

    try {
        // Get current item
        const { data: item, error: fetchError } = await (supabase.from('global_items') as any)
            .select('*')
            .eq('id', itemId)
            .single()

        if (fetchError || !item) {
            result.error = 'Item not found'
            return result
        }

        const updateData: Record<string, any> = {}

        // Step 1: Refresh metadata from external providers
        if (doMetadata) {
            const metadataResult = await refreshMetadata(supabase, itemId, { force: metadataForce })
            if (metadataResult.success && Object.keys(metadataResult.enrichedData).length > 0) {
                Object.assign(updateData, metadataResult.enrichedData)
                result.metadataUpdated = true
                result.fieldsUpdated.push(...metadataResult.fieldsUpdated)
            }
        }

        // Step 2: Generate AI description
        if (doDescription) {
            const serviceSupabase = createServiceRoleClient()
            const description_parts = await generateStructuredDescription(serviceSupabase, {
                title: item.title,
                originalDescription: context?.overview || item.description || '',
                type: item.category_type,
                metadata: item.metadata
            })

            if (description_parts.premise || description_parts.themes) {
                updateData.description = combineDescription(description_parts)
                updateData.description_parts = description_parts
                result.descriptionGenerated = true
                result.fieldsUpdated.push('description', 'description_parts')
            }
        }

        // Step 3: Generate AI tags
        if (doTags) {
            try {
                const description = updateData.description || item.description || ''
                const tagInput = [
                    ...(context?.keywords || item.keywords || []),
                    ...(context?.genres || item.genres || [])
                ].join(', ')

                const aiTagNames = await generateTags(
                    supabase,
                    item.title,
                    `${description} Keywords: ${tagInput}`,
                    item.category_type
                )

                if (aiTagNames && aiTagNames.length > 0) {
                    const validTags = await ensureTags(supabase, aiTagNames)
                    updateData.cached_tags = validTags
                    result.tagsGenerated = validTags.length
                    result.fieldsUpdated.push('cached_tags')
                }
            } catch (tagError) {
                console.warn('[EnrichPipeline] Tag generation failed (non-blocking):', tagError)
            }
        }

        // Step 4: Generate embedding (if anything changed)
        if (!skipEmbedding && Object.keys(updateData).length > 0) {
            const updatedItem = { ...item, ...updateData }
            const embeddingText = buildEmbeddingText(updatedItem)
            const embedding = await generateEmbedding(embeddingText)

            if (embedding) {
                updateData.embedding = embedding
                result.embeddingGenerated = true
                result.fieldsUpdated.push('embedding')
            }
        }

        // Step 5: Save to database
        if (Object.keys(updateData).length > 0) {
            const { error: updateError } = await (supabase.from('global_items') as any)
                .update(updateData)
                .eq('id', itemId)

            if (updateError) {
                result.error = updateError.message
                return result
            }
        }

        result.success = true
        return result

    } catch (error: any) {
        result.error = error.message || 'Unknown error'
        return result
    }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Metadata-only refresh (fast, no AI)
 */
export async function refreshItemMetadata(
    supabase: SupabaseClient,
    itemId: string,
    force: boolean = false
): Promise<EnrichmentResult> {
    return enrichItem(supabase, itemId, {
        refreshMetadata: true,
        metadataForce: force
    })
}

/**
 * AI content generation (description + tags + embedding)
 */
export async function regenerateItemContent(
    supabase: SupabaseClient,
    itemId: string
): Promise<EnrichmentResult> {
    return enrichItem(supabase, itemId, {
        generateDescription: true,
        generateTags: true
    })
}

/**
 * Full enrichment (metadata + AI + everything)
 * Used by harvest scripts for new items
 */
export async function fullEnrichment(
    supabase: SupabaseClient,
    itemId: string,
    context?: EnrichmentOptions['context']
): Promise<EnrichmentResult> {
    return enrichItem(supabase, itemId, {
        refreshMetadata: true,
        metadataForce: true,
        generateDescription: true,
        generateTags: true,
        context
    })
}
