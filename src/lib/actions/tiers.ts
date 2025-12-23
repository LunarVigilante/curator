'use server'

import { db } from '@/lib/db'
import { items, ratings, users } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs'
import { getGuestUserId } from './auth'

export async function assignItemToTier(itemId: string, tier: string, categoryId: string) {
    console.log(`[assignItemToTier] Item: ${itemId}, Tier: "${tier}"`)

    await db.update(items)
        .set({ tier })
        .where(eq(items.id, itemId))

    revalidatePath(`/categories/${categoryId}`)
}

export async function removeItemTier(itemId: string, categoryId: string) {
    await db.update(items)
        .set({ tier: null })
        .where(eq(items.id, itemId))

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
