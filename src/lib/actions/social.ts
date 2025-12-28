'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { follows } from '@/db/schema'; // Ensure this export exists in schema.ts
import { eq, and } from 'drizzle-orm';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

export async function toggleFollow(targetUserId: string) {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session) {
        throw new Error("Unauthorized");
    }

    const currentUserId = session.user.id;

    if (currentUserId === targetUserId) {
        throw new Error("Cannot follow yourself");
    }

    // Check if already following
    const existing = await db.select().from(follows).where(
        and(
            eq(follows.followerId, currentUserId),
            eq(follows.followingId, targetUserId)
        )
    ).get();

    if (existing) {
        // Unfollow
        await db.delete(follows).where(
            and(
                eq(follows.followerId, currentUserId),
                eq(follows.followingId, targetUserId)
            )
        );
        revalidatePath('/');
        return { isFollowing: false };
    } else {
        // Follow
        await db.insert(follows).values({
            followerId: currentUserId,
            followingId: targetUserId,
        });

        // Log Activity
        // Ideally we fetch the target user's name for richer display
        // For MVP we can just log the ID and fetch later, OR fetch now.
        // Let's rely on the Feed component to fetch or just log the ID if we want to be fast.
        // But the plan said "stores item names". Let's try to pass the ID and let the UI resolve, 
        // OR fetch the name here. Fetching name is cleaner for JSON data storage.
        const targetUser = await db.query.users.findFirst({
            where: eq(users.id, targetUserId),
            columns: { name: true }
        });

        if (targetUser) {
            await logActivity(currentUserId, 'FOLLOWED_USER', { targetUserName: targetUser.name, targetUserId });
        }

        revalidatePath('/');
        return { isFollowing: true };
    }
}

import { logActivity } from '@/lib/actions/activity';
import { users } from '@/db/schema';

export async function getFollowedUsers(userId: string) {
    const results = await db.query.follows.findMany({
        where: eq(follows.followerId, userId),
        with: {
            following: true // This relies on the relation defined in schema.ts
        }
    });

    return results.map(r => r.following);
}

export async function isFollowingUser(followerId: string, targetUserId: string) {
    const existing = await db.select().from(follows).where(
        and(
            eq(follows.followerId, followerId),
            eq(follows.followingId, targetUserId)
        )
    ).get();

    return !!existing;
}
