'use server'

import { db } from '@/lib/db'
import { ratings, users } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs'
import { getGuestUserId } from './auth'

export async function assignItemToTier(itemId: string, tier: string, categoryId: string) {
    const userId = await getGuestUserId()
    console.log(`[assignItemToTier] User: ${userId}, Item: ${itemId}, Tier: "${tier}"`)

    // Check if there's an existing tier rating for this item by this user
    const existing = await db.query.ratings.findFirst({
        where: and(
            eq(ratings.itemId, itemId),
            eq(ratings.userId, userId),
            eq(ratings.type, 'TIER')
        )
    })

    if (existing) {
        // Update existing tier rating
        await db.update(ratings)
            .set({ tier, value: getTierValue(tier) })
            .where(eq(ratings.id, existing.id))
    } else {
        // Create new tier rating
        await db.insert(ratings).values({
            itemId,
            userId,
            tier,
            value: getTierValue(tier),
            type: 'TIER'
        })
    }

    revalidatePath(`/categories/${categoryId}`)
}

export async function removeItemTier(itemId: string, categoryId: string) {
    const userId = await getGuestUserId()

    // Delete tier ratings for this item by this user
    await db.delete(ratings)
        .where(and(
            eq(ratings.itemId, itemId),
            eq(ratings.userId, userId),
            eq(ratings.type, 'TIER')
        ))

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
