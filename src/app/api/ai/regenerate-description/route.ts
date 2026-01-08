import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateDescriptionAction } from '@/lib/actions/ai'

/**
 * API endpoint to regenerate an item's description using AI
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

        // Generate new description
        const result = await generateDescriptionAction({ title, type })

        if (result.error) {
            return NextResponse.json(
                { error: result.error },
                { status: 500 }
            )
        }

        // Update the item in the database
        const supabase = await createClient()
        const { error: updateError } = await (supabase.from('global_items') as any)
            .update({ description: result.description })
            .eq('id', itemId)

        if (updateError) {
            return NextResponse.json(
                { error: updateError.message },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            description: result.description
        })

    } catch (error: any) {
        console.error('Regenerate description error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to regenerate description' },
            { status: 500 }
        )
    }
}
