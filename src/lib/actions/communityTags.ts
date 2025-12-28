'use server'

import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { collectionTags, categories } from '@/db/schema'
import { eq, and, sql, inArray } from 'drizzle-orm'

// Admin-only tags that regular users cannot add
const ADMIN_ONLY_TAGS = ['#Featured', '#Curated', '#Editor\'s Pick', '#Staff Pick', '#Trending']

// Auto-included tag for public collections
const AUTO_PUBLIC_TAG = '#Community'

/**
 * Add a community tag to a collection
 */
export async function addCollectionTag(categoryId: string, tag: string) {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) {
        return { success: false, error: 'Not authenticated' }
    }

    const userId = session.user.id
    const isAdmin = (session.user as any).role === 'ADMIN'

    // Normalize tag (ensure it starts with #)
    const normalizedTag = tag.startsWith('#') ? tag : `#${tag}`

    // Check if this is an admin-only tag
    if (ADMIN_ONLY_TAGS.includes(normalizedTag) && !isAdmin) {
        return { success: false, error: 'This tag is restricted to administrators' }
    }

    // Check existing user-added tags count (max 3 per user per collection)
    const existingUserTags = await db.select()
        .from(collectionTags)
        .where(and(
            eq(collectionTags.categoryId, categoryId),
            eq(collectionTags.addedBy, userId)
        ))

    if (existingUserTags.length >= 3) {
        return { success: false, error: 'You can only add up to 3 tags per collection' }
    }

    // Check if this exact tag already exists on this collection
    const existingTag = await db.select()
        .from(collectionTags)
        .where(and(
            eq(collectionTags.categoryId, categoryId),
            eq(collectionTags.tag, normalizedTag)
        ))
        .limit(1)

    if (existingTag.length > 0) {
        return { success: false, error: 'This tag already exists on this collection' }
    }

    // Add the tag
    await db.insert(collectionTags).values({
        categoryId,
        tag: normalizedTag,
        addedBy: userId,
        isAdminOnly: ADMIN_ONLY_TAGS.includes(normalizedTag)
    })

    return { success: true, tag: normalizedTag }
}

/**
 * Remove a community tag from a collection
 */
export async function removeCollectionTag(categoryId: string, tagId: string) {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) {
        return { success: false, error: 'Not authenticated' }
    }

    const userId = session.user.id
    const isAdmin = (session.user as any).role === 'ADMIN'

    // Get the tag
    const tag = await db.select()
        .from(collectionTags)
        .where(eq(collectionTags.id, tagId))
        .limit(1)

    if (tag.length === 0) {
        return { success: false, error: 'Tag not found' }
    }

    const tagData = tag[0]

    // Check permissions: admins can remove any, users can only remove their own
    if (!isAdmin && tagData.addedBy !== userId) {
        return { success: false, error: 'You can only remove tags you added' }
    }

    // Admin-only tags can only be removed by admins
    if (tagData.isAdminOnly && !isAdmin) {
        return { success: false, error: 'Admin-only tags can only be removed by administrators' }
    }

    await db.delete(collectionTags).where(eq(collectionTags.id, tagId))

    return { success: true }
}

/**
 * Get all tags for a collection
 */
export async function getCollectionTags(categoryId: string) {
    const tags = await db.select()
        .from(collectionTags)
        .where(eq(collectionTags.categoryId, categoryId))
        .orderBy(collectionTags.createdAt)

    return tags
}

/**
 * Get tags for multiple collections (batch)
 */
export async function getBatchCollectionTags(categoryIds: string[]) {
    if (categoryIds.length === 0) return {}

    const tags = await db.select()
        .from(collectionTags)
        .where(inArray(collectionTags.categoryId, categoryIds))

    const result: Record<string, typeof tags> = {}
    for (const id of categoryIds) {
        result[id] = tags.filter(t => t.categoryId === id)
    }
    return result
}

/**
 * Ensure #Community tag exists for a public collection
 */
export async function ensureCommunityTag(categoryId: string) {
    // Check if the collection is public
    const category = await db.query.categories.findFirst({
        where: eq(categories.id, categoryId)
    })

    if (!category?.isPublic) {
        return { success: false, error: 'Collection is not public' }
    }

    // Check if #Community tag already exists
    const existingTag = await db.select()
        .from(collectionTags)
        .where(and(
            eq(collectionTags.categoryId, categoryId),
            eq(collectionTags.tag, AUTO_PUBLIC_TAG)
        ))
        .limit(1)

    if (existingTag.length > 0) {
        return { success: true, exists: true }
    }

    // Add #Community tag (system-generated, no addedBy)
    await db.insert(collectionTags).values({
        categoryId,
        tag: AUTO_PUBLIC_TAG,
        addedBy: null,
        isAdminOnly: false
    })

    return { success: true, added: true }
}

/**
 * Admin action: Add a featured/admin-only tag
 */
export async function addAdminTag(categoryId: string, tag: string) {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) {
        return { success: false, error: 'Not authenticated' }
    }

    const isAdmin = (session.user as any).role === 'ADMIN'
    if (!isAdmin) {
        return { success: false, error: 'Admin access required' }
    }

    const normalizedTag = tag.startsWith('#') ? tag : `#${tag}`

    // Check if tag already exists
    const existingTag = await db.select()
        .from(collectionTags)
        .where(and(
            eq(collectionTags.categoryId, categoryId),
            eq(collectionTags.tag, normalizedTag)
        ))
        .limit(1)

    if (existingTag.length > 0) {
        return { success: false, error: 'Tag already exists' }
    }

    await db.insert(collectionTags).values({
        categoryId,
        tag: normalizedTag,
        addedBy: session.user.id,
        isAdminOnly: true
    })

    return { success: true, tag: normalizedTag }
}
