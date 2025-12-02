'use server'

import { db } from '@/lib/db'
import { ratings } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

export async function assignItemToTier(itemId: string, tier: string, categoryId: string) {
    // Check if there's an existing tier rating for this item
    const existing = await db.query.ratings.findFirst({
        where: and(
            eq(ratings.itemId, itemId),
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
            tier,
            value: getTierValue(tier),
            type: 'TIER'
        })
    }

    revalidatePath(`/categories/${categoryId}`)
}

export async function removeItemTier(itemId: string, categoryId: string) {
    // Delete tier ratings for this item
    await db.delete(ratings)
        .where(and(
            eq(ratings.itemId, itemId),
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
