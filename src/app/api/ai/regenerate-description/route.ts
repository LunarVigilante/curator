import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { generateStructuredDescription, combineDescription, buildEmbeddingText } from '@/lib/ai/structured-description'
import { generateEmbedding } from '@/lib/harvesters/shared'

/**
 * API endpoint to regenerate an item's description using AI
 * Now uses 4-part structured description generation
 */
export async function POST(request: NextRequest) {
    try {
        const { itemId, title, type } = await request.json()

        if (!itemId || !title || !type) {
            return NextResponse.json(
                { error: 'Missing required fields: itemId, title, type' },
                { status: 400 }
            )
        }

        const supabase = await createClient()
        const serviceSupabase = createServiceRoleClient()

        // Get current item for context
        const { data: existingItem } = await (supabase.from('global_items') as any)
            .select('description, metadata')
            .eq('id', itemId)
            .single()

        // Generate 4-part structured description
        const description_parts = await generateStructuredDescription(serviceSupabase, {
            title,
            originalDescription: existingItem?.description || '',
            type,
            metadata: existingItem?.metadata
        })

        // Combine for backwards compatibility
        const description = combineDescription(description_parts)

        // Fetch full item for embedding
        const { data: fullItem } = await (supabase.from('global_items') as any)
            .select('*')
            .eq('id', itemId)
            .single()

        // Build rich embedding text
        const embeddingText = buildEmbeddingText({
            ...fullItem,
            description,
            description_parts
        })

        // Generate new embedding
        const embedding = await generateEmbedding(embeddingText)

        // Update the item in the database
        const updateData: any = {
            description,
            description_parts
        }

        if (embedding) {
            updateData.embedding = embedding
        }

        const { error: updateError } = await (supabase.from('global_items') as any)
            .update(updateData)
            .eq('id', itemId)

        if (updateError) {
            return NextResponse.json(
                { error: updateError.message },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            description,
            description_parts
        })

    } catch (error: any) {
        console.error('Regenerate description error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to regenerate description' },
            { status: 500 }
        )
    }
}
