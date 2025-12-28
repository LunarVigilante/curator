'use server'

import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { collectionLikes, collectionSaves, categories, users } from '@/db/schema'
import { eq, and, sql, desc, inArray } from 'drizzle-orm'

/**
 * Toggle Like on a collection (public upvote)
 */
export async function toggleLike(categoryId: string) {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) {
        return { success: false, error: 'Not authenticated' }
    }

    const userId = session.user.id

    // Check if already liked
    const existing = await db.select()
        .from(collectionLikes)
        .where(and(
            eq(collectionLikes.userId, userId),
            eq(collectionLikes.categoryId, categoryId)
        ))
        .limit(1)

    if (existing.length > 0) {
        // Remove like
        await db.delete(collectionLikes).where(
            and(
                eq(collectionLikes.userId, userId),
                eq(collectionLikes.categoryId, categoryId)
            )
        )
        return { success: true, liked: false }
    } else {
        // Add like
        await db.insert(collectionLikes).values({
            userId,
            categoryId
        })
        return { success: true, liked: true }
    }
}

/**
 * Toggle Save on a collection (private bookmark)
 */
export async function toggleSave(categoryId: string) {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) {
        return { success: false, error: 'Not authenticated' }
    }

    const userId = session.user.id

    // Check if already saved
    const existing = await db.select()
        .from(collectionSaves)
        .where(and(
            eq(collectionSaves.userId, userId),
            eq(collectionSaves.categoryId, categoryId)
        ))
        .limit(1)

    if (existing.length > 0) {
        // Remove save
        await db.delete(collectionSaves).where(
            and(
                eq(collectionSaves.userId, userId),
                eq(collectionSaves.categoryId, categoryId)
            )
        )
        return { success: true, saved: false }
    } else {
        // Add save
        await db.insert(collectionSaves).values({
            userId,
            categoryId
        })
        return { success: true, saved: true }
    }
}

/**
 * Get like count for a collection
 */
export async function getLikeCount(categoryId: string) {
    const result = await db.select({ count: sql<number>`count(*)` })
        .from(collectionLikes)
        .where(eq(collectionLikes.categoryId, categoryId))

    return result[0]?.count || 0
}

/**
 * Get save count for a collection
 */
export async function getSaveCount(categoryId: string) {
    const result = await db.select({ count: sql<number>`count(*)` })
        .from(collectionSaves)
        .where(eq(collectionSaves.categoryId, categoryId))

    return result[0]?.count || 0
}

/**
 * Check if current user has liked/saved a collection
 */
export async function getInteractionStatus(categoryId: string) {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) {
        return { liked: false, saved: false }
    }

    const userId = session.user.id

    const [likedResult, savedResult] = await Promise.all([
        db.select().from(collectionLikes)
            .where(and(
                eq(collectionLikes.userId, userId),
                eq(collectionLikes.categoryId, categoryId)
            ))
            .limit(1),
        db.select().from(collectionSaves)
            .where(and(
                eq(collectionSaves.userId, userId),
                eq(collectionSaves.categoryId, categoryId)
            ))
            .limit(1)
    ])

    return { liked: likedResult.length > 0, saved: savedResult.length > 0 }
}

/**
 * Get batch interaction status for multiple collections (for Browse page)
 */
export async function getBatchInteractionStatus(categoryIds: string[]) {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id || categoryIds.length === 0) {
        return {}
    }

    const userId = session.user.id

    const [likes, saves] = await Promise.all([
        db.select().from(collectionLikes).where(eq(collectionLikes.userId, userId)),
        db.select().from(collectionSaves).where(eq(collectionSaves.userId, userId))
    ])

    const likedSet = new Set(likes.map(l => l.categoryId))
    const savedSet = new Set(saves.map(s => s.categoryId))

    const result: Record<string, { liked: boolean; saved: boolean }> = {}
    for (const id of categoryIds) {
        result[id] = {
            liked: likedSet.has(id),
            saved: savedSet.has(id)
        }
    }
    return result
}

/**
 * Get saved collections (bookmarks) for current user
 */
export async function getSavedCollections() {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) {
        return { data: [], error: 'Not authenticated' }
    }

    const userId = session.user.id

    // Get all saves for this user
    const saves = await db.select()
        .from(collectionSaves)
        .where(eq(collectionSaves.userId, userId))
        .orderBy(desc(collectionSaves.createdAt))

    if (saves.length === 0) {
        return { data: [] }
    }

    // Fetch category details using query API
    const categoryIds = saves.map(s => s.categoryId)
    const categoryData = await db.query.categories.findMany({
        where: inArray(categories.id, categoryIds),
        with: {
            owner: true,
            items: {
                columns: { id: true }
            }
        }
    })

    return { data: categoryData }
}

/**
 * Get like counts for multiple collections
 */
export async function getBatchLikeCounts(categoryIds: string[]) {
    if (categoryIds.length === 0) return {}

    const counts = await db.select({
        categoryId: collectionLikes.categoryId,
        count: sql<number>`count(*)`
    })
        .from(collectionLikes)
        .where(inArray(collectionLikes.categoryId, categoryIds))
        .groupBy(collectionLikes.categoryId)

    const result: Record<string, number> = {}
    for (const { categoryId, count } of counts) {
        result[categoryId] = count
    }
    return result
}

/**
 * Get liked collections for current user
 */
export async function getLikedCollections() {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) {
        return { data: [], error: 'Not authenticated' }
    }

    const userId = session.user.id

    // Get all likes for this user
    const likes = await db.select()
        .from(collectionLikes)
        .where(eq(collectionLikes.userId, userId))
        .orderBy(desc(collectionLikes.createdAt))

    if (likes.length === 0) {
        return { data: [] }
    }

    // Fetch category details using query API
    const categoryIds = likes.map(l => l.categoryId)
    const categoryData = await db.query.categories.findMany({
        where: inArray(categories.id, categoryIds),
        with: {
            owner: true,
            items: {
                columns: { id: true }
            }
        }
    })

    return { data: categoryData }
}

/**
 * Get users the current user is following
 */
import { follows } from '@/db/schema'

export async function getFollowing() {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) {
        return { data: [], error: 'Not authenticated' }
    }

    const userId = session.user.id

    // Get all follows for this user
    const followList = await db.select()
        .from(follows)
        .where(eq(follows.followerId, userId))
        .orderBy(desc(follows.createdAt))

    if (followList.length === 0) {
        return { data: [] }
    }

    // Fetch user details
    const followingIds = followList.map(f => f.followingId)
    const userData = await db.query.users.findMany({
        where: inArray(users.id, followingIds),
        columns: {
            id: true,
            name: true,
            email: true,
            image: true,
            bio: true,
            createdAt: true
        }
    })

    return { data: userData }
}
