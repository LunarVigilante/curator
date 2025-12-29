'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getGuestUserId } from './auth'

export async function rateItem(itemId: string, value: number, type: 'NUMERICAL' | 'TIER' | 'HYBRID', tier?: string) {
    const userId = await getGuestUserId()
    if (!userId) return

    const supabase = await createClient()

    // Delete existing rating for this user/item to prevent duplicates
    await (supabase.from('ratings') as any)
        .delete()
        .eq('item_id', itemId)
        .eq('user_id', userId)

    await (supabase.from('ratings') as any).insert({
        item_id: itemId,
        value,
        type,
        tier,
        user_id: userId
    })

    revalidatePath(`/items/${itemId}`)
}
