import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { refreshMetadata } from '@/lib/services/enrichment'
import { buildEmbeddingText } from '@/lib/ai/structured-description'
import { generateEmbedding } from '@/lib/harvesters/shared'
import { withAiApi, internalError, validationError } from '@/lib/middleware'
import { parseRequestBody, enrichMetadataSchema } from '@/lib/validation/api-schemas'
import { log } from 'next-axiom'

/**
 * API endpoint to enrich item metadata from external providers.
 * 
 * This is the FAST path:
 * - Fetches from TMDB, OMDB, BGG, Spotify, etc.
 * - NO AI description generation (use /regenerate-description for that)
 * - Generates embedding after metadata update
 * 
 * Uses service role client to bypass RLS for database updates.
 */
export const POST = withAiApi(async (request: NextRequest) => {
    const startTime = Date.now()

    try {
        // Validate request body with Zod schema
        const validation = await parseRequestBody(request, enrichMetadataSchema)
        if (!validation.success) {
            return validationError(validation.error)
        }

        const { itemId, title, force } = validation.data

        // Use service role client to bypass RLS
        const supabase = createServiceRoleClient()

        log.info('[Enrich] Starting metadata refresh', { itemId, title })

        // Step 1: Refresh metadata from external providers (fast)
        const metadataResult = await refreshMetadata(supabase, itemId, { force })

        if (!metadataResult.success) {
            return internalError(metadataResult.error || 'Failed to refresh metadata')
        }

        // Step 2: Update the item with enriched metadata
        if (Object.keys(metadataResult.enrichedData).length > 0) {
            log.info('[Enrich] Updating item', {
                itemId,
                fieldsCount: Object.keys(metadataResult.enrichedData).length
            })

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error: updateError } = await (supabase as any)
                .from('global_items')
                .update(metadataResult.enrichedData)
                .eq('id', itemId)

            if (updateError) {
                log.error('[Enrich] Database update failed', { error: updateError.message })
                return internalError(updateError.message)
            }
        }

        // Step 3: Regenerate embedding with new metadata
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: updatedItem } = await (supabase as any)
            .from('global_items')
            .select('*')
            .eq('id', itemId)
            .single()

        if (updatedItem) {
            try {
                const embeddingText = buildEmbeddingText(updatedItem)
                const embedding = await generateEmbedding(embeddingText)

                if (embedding) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    await (supabase as any)
                        .from('global_items')
                        .update({ embedding })
                        .eq('id', itemId)
                }
            } catch (embeddingError) {
                // Log but don't fail the request if embedding fails
                log.warn('[Enrich] Embedding generation failed', {
                    itemId,
                    error: embeddingError instanceof Error ? embeddingError.message : 'Unknown error'
                })
            }
        }

        const duration = Date.now() - startTime
        log.info('[Enrich] Completed', {
            itemId,
            duration,
            fieldsUpdated: metadataResult.fieldsUpdated.length
        })

        return NextResponse.json({
            success: true,
            enriched: metadataResult.fieldsUpdated.length > 0,
            fieldsUpdated: metadataResult.fieldsUpdated,
            enrichedData: metadataResult.enrichedData,
            providerName: metadataResult.providerName,
            duration
        })
    } catch (error) {
        log.error('[Enrich] Unexpected error', {
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
        })
        return internalError(error instanceof Error ? error.message : 'An unexpected error occurred')
    }
})
