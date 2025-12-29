'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function assignItemToTier(itemId: string, tier: string, categoryId: string) {
    console.log(`[assignItemToTier] Item: ${itemId}, Tier: "${tier}"`)
    const supabase = await createClient()

    const { error } = await (supabase.from('items') as any)
        .update({ tier })
        .eq('id', itemId)

    if (error) throw error
    revalidatePath(`/categories/${categoryId}`)
}

export async function removeItemTier(itemId: string, categoryId: string) {
    const supabase = await createClient()

    const { error } = await (supabase.from('items') as any)
        .update({ tier: null })
        .eq('id', itemId)

    if (error) throw error
    revalidatePath(`/categories/${categoryId}`)
}

// Helper to convert tier to numeric value for sorting
function getTierValue(tier: string): number {
    const tierValues: Record<string, number> = {
        'S': 100,
        'A': 85,
        'B': 70,
        'C': 55,
        'D': 40,
        'F': 25
    }
    return tierValues[tier] || 0
}
