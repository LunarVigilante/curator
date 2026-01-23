import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { generateStructuredDescription, combineDescription, buildEmbeddingText } from '@/lib/ai/structured-description'
import { generateEmbedding } from '@/lib/harvesters/shared'

/**
 * API endpoint to regenerate an item's description using AI.
 * 
 * This is the AI-POWERED path:
 * - Generates 4-part structured description (premise, themes, tone, style)
 * - Generates/updates AI tags
 * - Regenerates embedding
 */
export async function POST(request: NextRequest) {
    const startTime = Date.now()

    try {
        const { itemId, title, type, includeTags = true } = await request.json()

        if (!itemId || !title || !type) {
            return NextResponse.json(
                { error: 'Missing required fields: itemId, title, type' },
                { status: 400 }
            )
        }

        const supabase = await createClient()
        const serviceSupabase = createServiceRoleClient()

        console.log(`[RegenDesc] Starting AI description generation for "${title}"...`)

        // Get current item for context
        const { data: existingItem, error: fetchError } = await (supabase.from('global_items') as any)
            .select('*')
            .eq('id', itemId)
            .single()

        if (fetchError || !existingItem) {
            return NextResponse.json(
                { error: 'Item not found' },
                { status: 404 }
            )
        }

        // Step 1: Generate 4-part structured description
        console.log(`[RegenDesc] Generating structured description...`)
        const description_parts = await generateStructuredDescription(serviceSupabase, {
            title,
            originalDescription: existingItem.description || '',
            type,
            metadata: existingItem.metadata
        })

        const description = combineDescription(description_parts)
        console.log(`[RegenDesc] ✅ Description generated (${description.length} chars)`)

        // Step 2: Generate tags (if enabled)
        let tagsGenerated: string[] = []
        if (includeTags) {
            console.log(`[RegenDesc] Generating AI tags...`)
            try {
                const tagResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/ai/generate-tags`, {
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
                    console.log(`[RegenDesc] ✅ Generated ${tagsGenerated.length} tags`)
                }
            } catch (tagError) {
                console.warn('[RegenDesc] Tag generation failed (non-blocking):', tagError)
            }
        }

        // Step 3: Build and generate new embedding
        console.log(`[RegenDesc] Generating embedding...`)
        const embeddingText = buildEmbeddingText({
            ...existingItem,
            description,
            description_parts
        })
        const embedding = await generateEmbedding(embeddingText)

        // Step 4: Update the item
        const updateData: Record<string, any> = {
            description,
            description_parts
        }

        if (embedding) {
            updateData.embedding = embedding
        }

        // Use service role client for update to bypass RLS
        const { error: updateError } = await (serviceSupabase.from('global_items') as any)
            .update(updateData)
            .eq('id', itemId)

        if (updateError) {
            console.error('[RegenDesc] Update failed:', updateError)
            return NextResponse.json(
                { error: updateError.message },
                { status: 500 }
            )
        }

        const duration = Date.now() - startTime
        console.log(`[RegenDesc] ✅ Completed in ${duration}ms`)

        return NextResponse.json({
            success: true,
            description,
            description_parts,
            tagsGenerated: tagsGenerated.length,
            embeddingUpdated: !!embedding,
            duration
        })

    } catch (error: any) {
        console.error('[RegenDesc] Error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to regenerate description' },
            { status: 500 }
        )
    }
}
