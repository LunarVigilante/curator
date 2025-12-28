'use server'

import { db } from '@/lib/db'
import { ratings } from '@/db/schema'
import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { getGuestUserId } from './auth'

export async function rateItem(itemId: string, value: number, type: 'NUMERICAL' | 'TIER' | 'HYBRID', tier?: string) {
    const userId = await getGuestUserId()
    if (!userId) return

    // Delete existing rating for this user/item to prevent duplicates
    await db.delete(ratings).where(and(
        eq(ratings.itemId, itemId),
        eq(ratings.userId, userId)
    ))

    await db.insert(ratings).values({
        itemId,
        value,
        type,
        tier,
        userId: userId
    })

    revalidatePath(`/items/${itemId}`)
}
