'use server';

import { db } from '@/lib/db';
import { activities } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export type ActivityType = 'RANKED_ITEM' | 'CREATED_LIST' | 'FOLLOWED_USER';

export async function logActivity(userId: string, type: ActivityType, data: any) {
    try {
        await db.insert(activities).values({
            userId,
            type,
            data: JSON.stringify(data),
        });
        // We generally don't need to revalidate immediately for this as it's a feed, 
        // effectively passive, but good to keep in mind.
    } catch (error) {
        console.error("Failed to log activity:", error);
        // Fail silently to not block main user action
    }
}

export async function getRecentActivities(limit: number = 20) {
    const results = await db.query.activities.findMany({
        orderBy: [desc(activities.createdAt)],
        limit: limit,
        with: {
            user: true
        }
    });

    return results.map(activity => ({
        ...activity,
        data: JSON.parse(activity.data)
    }));
}
