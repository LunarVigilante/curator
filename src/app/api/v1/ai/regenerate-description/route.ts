import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { generateStructuredDescription, combineDescription, buildEmbeddingText } from '@/lib/ai/structured-description'
import { generateEmbedding } from '@/lib/harvesters/shared'
import { withAiApi, internalError, validationError, notFound } from '@/lib/middleware'
import { parseRequestBody, regenerateDescriptionSchema } from '@/lib/validation/api-schemas'
import { log } from 'next-axiom'

/**
 * API endpoint to regenerate an item's description using AI.
 * 
 * This is the AI-POWERED path:
 * - Generates 4-part structured description (premise, themes, tone, style)
 * - Generates/updates AI tags
 * - Regenerates embedding
 */
export const POST = withAiApi(async (request: NextRequest) => {
    const startTime = Date.now()

    // Validate request body with Zod schema
    const validation = await parseRequestBody(request, regenerateDescriptionSchema)
    if (!validation.success) {
        return validationError(validation.error)
    }

    const { itemId, title, type, includeTags } = validation.data

    const supabase = await createClient()
    const serviceSupabase = createServiceRoleClient()

    log.info('[RegenDesc] Starting AI description generation', { itemId, title })

    // Get current item for context
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingItem, error: fetchError } = await (supabase as any)
        .from('global_items')
        .select('*')
        .eq('id', itemId)
        .single()

    if (fetchError || !existingItem) {
        return notFound('Item not found')
    }

    // Step 1: Generate 4-part structured description
    const description_parts = await generateStructuredDescription(serviceSupabase, {
        title,
        originalDescription: existingItem.description || '',
        type,
        metadata: existingItem.metadata
    })

    const description = combineDescription(description_parts)
    log.info('[RegenDesc] Description generated', { itemId, length: description.length })

    // Step 2: Generate tags (if enabled)
    let tagsGenerated: string[] = []
    if (includeTags) {
        try {
            const tagResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/v1/ai/generate-tags`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    itemId,
                    title,
                    description,
                    type,
                    genres: existingItem.genres
                })
            })

            if (tagResponse.ok) {
                const tagResult = await tagResponse.json()
                tagsGenerated = tagResult.tags || []
            }
        } catch (tagError) {
            log.warn('[RegenDesc] Tag generation failed (non-blocking)', { error: String(tagError) })
        }
    }

    // Step 3: Build and generate new embedding
    const embeddingText = buildEmbeddingText({
        ...existingItem,
        description,
        description_parts
    })
    const embedding = await generateEmbedding(embeddingText)

    // Step 4: Update the item
    const updateData: Record<string, unknown> = {
        description,
        description_parts
    }

    if (embedding) {
        updateData.embedding = embedding
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (serviceSupabase as any)
        .from('global_items')
        .update(updateData)
        .eq('id', itemId)

    if (updateError) {
        log.error('[RegenDesc] Update failed', { error: updateError.message })
        return internalError(updateError.message)
    }

    const duration = Date.now() - startTime
    log.info('[RegenDesc] Completed', { itemId, duration, tagsGenerated: tagsGenerated.length })

    return NextResponse.json({
        success: true,
        description,
        description_parts,
        tagsGenerated: tagsGenerated.length,
        embeddingUpdated: !!embedding,
        duration
    })
})
