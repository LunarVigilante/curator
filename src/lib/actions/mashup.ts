'use server'

import { db } from '@/lib/db';
import { items, globalItems, users } from '@/db/schema';
import { eq, and, isNotNull } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

export async function getCommonGround(partnerId: string, categoryId: string) {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session?.user?.id) {
        throw new Error("Unauthorized");
    }

    const userId = session.user.id;

    // 1. Fetch User A items
    const userAItems = await db.query.items.findMany({
        where: and(
            eq(items.userId, userId),
            eq(items.categoryId, categoryId),
            isNotNull(items.globalItemId)
        ),
        with: {
            globalItem: true
        }
    });

    // 2. Fetch User B items
    const userBItems = await db.query.items.findMany({
        where: and(
            eq(items.userId, partnerId),
            eq(items.categoryId, categoryId),
            isNotNull(items.globalItemId)
        ),
        with: {
            globalItem: true
        }
    });

    // 3. Map B items by globalItemId for easy lookup
    const userBMap = new Map(userBItems.map(item => [item.globalItemId, item]));

    // 4. Find intersection and compute composite score
    const commonItems = userAItems.filter(item => userBMap.has(item.globalItemId)).map(itemA => {
        const itemB = userBMap.get(itemA.globalItemId)!;
        const compositeScore = (itemA.eloScore + itemB.eloScore) / 2;

        return {
            id: itemA.globalItemId!,
            name: itemA.globalItem?.title || itemA.name || 'Unknown',
            image: itemA.globalItem?.imageUrl || itemA.image,
            userAScore: itemA.eloScore,
            userBScore: itemB.eloScore,
            compositeScore
        };
    });

    // 5. Sort by composite score and return top 10
    return commonItems
        .sort((a, b) => b.compositeScore - a.compositeScore)
        .slice(0, 10);
}
