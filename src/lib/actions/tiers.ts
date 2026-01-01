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

/**
 * Assign tiers S-F to items based on ELO scores.
 * Uses percentile distribution:
 * - S tier: top 10%
 * - A tier: 10-30%
 * - B tier: 30-50%
 * - C tier: 50-70%
 * - D tier: 70-90%
 * - F tier: bottom 10%
 */
export async function assignTiersFromElo(
    updates: { id: string; elo: number }[],
    categoryId: string
) {
    if (updates.length === 0) return { updated: 0 }

    const supabase = await createClient()

    // Sort by ELO descending (highest first)
    const sorted = [...updates].sort((a, b) => b.elo - a.elo)
    const total = sorted.length

    // Calculate tier boundaries based on percentiles
    const getTier = (index: number): string => {
        const percentile = (index / total) * 100
        if (percentile < 10) return 'S'
        if (percentile < 30) return 'A'
        if (percentile < 50) return 'B'
        if (percentile < 70) return 'C'
        if (percentile < 90) return 'D'
        return 'F'
    }

    // Batch update all items
    let updated = 0
    for (let i = 0; i < sorted.length; i++) {
        const item = sorted[i]
        const tier = getTier(i)

        const { error } = await (supabase.from('items') as any)
            .update({ tier, elo_score: item.elo })
            .eq('id', item.id)

        if (!error) updated++
    }

    revalidatePath(`/categories/${categoryId}`)
    return { updated }
}
