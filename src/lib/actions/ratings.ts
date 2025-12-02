'use server'

import { db } from '@/lib/db'
import { ratings } from '@/db/schema'
import { revalidatePath } from 'next/cache'

export async function rateItem(itemId: string, value: number, type: 'NUMERICAL' | 'TIER' | 'HYBRID', tier?: string) {
    await db.insert(ratings).values({
        itemId,
        value,
        type,
        tier,
    })

    revalidatePath(`/items/${itemId}`)
}
