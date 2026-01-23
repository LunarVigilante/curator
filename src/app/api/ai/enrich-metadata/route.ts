import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { refreshMetadata } from '@/lib/services/enrichment'
import { buildEmbeddingText } from '@/lib/ai/structured-description'
import { generateEmbedding } from '@/lib/harvesters/shared'

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
export async function POST(request: NextRequest) {
    const startTime = Date.now()

    try {
        const { itemId, title, type, force = false } = await request.json()

        if (!itemId) {
            return NextResponse.json(
                { error: 'Missing required field: itemId' },
                { status: 400 }
            )
        }

        // Use service role client to bypass RLS
        const supabase = createServiceRoleClient()

        console.log(`[Enrich] Starting metadata refresh for "${title || itemId}"...`)

        // Step 1: Refresh metadata from external providers (fast)
        const metadataResult = await refreshMetadata(supabase, itemId, { force })

        if (!metadataResult.success) {
            return NextResponse.json(
                { error: metadataResult.error || 'Failed to refresh metadata' },
                { status: 500 }
            )
        }

        // Step 2: Update the item with enriched metadata
        if (Object.keys(metadataResult.enrichedData).length > 0) {
            console.log(`[Enrich] Updating item ${itemId} with ${Object.keys(metadataResult.enrichedData).length} fields:`, Object.keys(metadataResult.enrichedData))
            console.log('[Enrich] Data being saved:', JSON.stringify(metadataResult.enrichedData, null, 2).slice(0, 500))

            const { data: updateData, error: updateError } = await (supabase.from('global_items') as any)
                .update(metadataResult.enrichedData)
                .eq('id', itemId)
                .select()

            if (updateError) {
                console.error('[Enrich] ❌ Database update FAILED:', updateError)
                return NextResponse.json(
                    { error: updateError.message },
                    { status: 500 }
                )
            }

            console.log(`[Enrich] ✅ Database update SUCCESS. Updated rows:`, updateData?.length || 0)
        } else {
            console.log('[Enrich] No data to update')
        }

        // Step 3: Regenerate embedding with new metadata
        const { data: updatedItem } = await (supabase.from('global_items') as any)
            .select('*')
            .eq('id', itemId)
            .single()

        if (updatedItem) {
            const embeddingText = buildEmbeddingText(updatedItem)
            const embedding = await generateEmbedding(embeddingText)

            if (embedding) {
                await (supabase.from('global_items') as any)
                    .update({ embedding })
                    .eq('id', itemId)
            }
        }

        const duration = Date.now() - startTime
        console.log(`[Enrich] ✅ Completed in ${duration}ms - ${metadataResult.fieldsUpdated.length} fields updated`)

        return NextResponse.json({
            success: true,
            enriched: metadataResult.fieldsUpdated.length > 0,
            fieldsUpdated: metadataResult.fieldsUpdated,
            enrichedData: metadataResult.enrichedData,
            providerName: metadataResult.providerName,
            duration
        })

    } catch (error: any) {
        console.error('[Enrich] Error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to enrich metadata' },
            { status: 500 }
        )
    }
}
