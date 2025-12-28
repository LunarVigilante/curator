'use server'

import { db } from '@/lib/db'
import { users, items, userTopPicks, globalItems, categories } from '@/db/schema'
import { eq, desc, and, sql } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

// ============================================================================
// Profile Types
// ============================================================================

export type PublicProfile = {
    id: string
    name: string
    displayName: string | null
    bio: string | null
    image: string | null
    coverImage: string | null
    isPublic: boolean
    profileViews: number
    createdAt: Date
    topPicks: {
        id: string
        name: string
        image: string | null
        tier: string | null
        categoryName: string | null
    }[]
    stats: {
        totalItems: number
        totalCollections: number
        followerCount: number
    }
}

// ============================================================================
// Auth Helper
// ============================================================================

async function getCurrentUserId(): Promise<string | null> {
    const session = await auth.api.getSession({ headers: await headers() })
    return session?.user?.id || null
}

// ============================================================================
// Profile Actions
// ============================================================================

/**
 * Get the current user's profile data for editing
 */
export async function getMyProfile() {
    const userId = await getCurrentUserId()
    if (!userId) return null

    const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: {
            id: true,
            name: true,
            displayName: true,
            bio: true,
            image: true,
            coverImage: true,
            isPublic: true,
            email: true,
        }
    })

    return user
}

/**
 * Update the current user's profile
 */
export async function updateProfile(data: {
    displayName?: string
    bio?: string
    isPublic?: boolean
    image?: string
    coverImage?: string
}): Promise<{ success: boolean; error?: string }> {
    const userId = await getCurrentUserId()
    if (!userId) {
        return { success: false, error: 'Not authenticated' }
    }

    try {
        await db.update(users)
            .set({
                displayName: data.displayName,
                bio: data.bio,
                isPublic: data.isPublic,
                image: data.image,
                coverImage: data.coverImage,
            })
            .where(eq(users.id, userId))

        revalidatePath('/profile')
        revalidatePath(`/profile/${userId}`)
        return { success: true }
    } catch (error) {
        console.error('Failed to update profile:', error)
        return { success: false, error: 'Failed to update profile' }
    }
}

/**
 * Update the current user's display name (direct action for settings page)
 */
export async function updateUsername(name: string): Promise<{ success: boolean; error?: string }> {
    if (!name || name.trim().length < 2) {
        return { success: false, error: 'Name must be at least 2 characters' }
    }

    const userId = await getCurrentUserId()
    if (!userId) {
        return { success: false, error: 'Not authenticated' }
    }

    try {
        await db.update(users)
            .set({ name: name.trim() })
            .where(eq(users.id, userId))

        revalidatePath('/settings')
        revalidatePath('/profile')
        return { success: true }
    } catch (error) {
        console.error('Failed to update username:', error)
        return { success: false, error: 'Failed to update name' }
    }
}

import { verifications } from '@/db/schema'
import { gt } from 'drizzle-orm'

/**
 * Request email change - sends verification to new email
 */
export async function requestEmailChange(newEmail: string): Promise<{ success: boolean; error?: string }> {
    if (!newEmail || !newEmail.includes('@')) {
        return { success: false, error: 'Please enter a valid email address' }
    }

    const userId = await getCurrentUserId()
    if (!userId) {
        return { success: false, error: 'Not authenticated' }
    }

    // Check if email is already in use
    const existingUser = await db.query.users.findFirst({
        where: eq(users.email, newEmail)
    })

    if (existingUser) {
        return { success: false, error: 'This email is already in use' }
    }

    try {
        // Generate 6-digit code
        const code = Math.floor(100000 + Math.random() * 900000).toString()
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

        // Store pending email
        await db.update(users)
            .set({ pendingEmail: newEmail })
            .where(eq(users.id, userId))

        // Create verification record
        await db.insert(verifications).values({
            identifier: newEmail,
            value: crypto.randomUUID(),
            verificationCode: code,
            expiresAt,
        })

        // Send verification email
        const { sendEmailChangeVerification } = await import('@/lib/emailAdapter')
        await sendEmailChangeVerification({ email: newEmail, code })

        return { success: true }
    } catch (error) {
        console.error('Email change request error:', error)
        return { success: false, error: 'Failed to send verification email' }
    }
}

/**
 * Confirm email change with verification code
 */
export async function confirmEmailChange(code: string): Promise<{ success: boolean; error?: string }> {
    if (!code || code.length !== 6) {
        return { success: false, error: 'Please enter a valid 6-digit code' }
    }

    const userId = await getCurrentUserId()
    if (!userId) {
        return { success: false, error: 'Not authenticated' }
    }

    // Get user with pending email
    const currentUser = await db.query.users.findFirst({
        where: eq(users.id, userId)
    })

    if (!currentUser?.pendingEmail) {
        return { success: false, error: 'No pending email change found' }
    }

    try {
        // Find verification record
        const verification = await db.query.verifications.findFirst({
            where: and(
                eq(verifications.identifier, currentUser.pendingEmail),
                eq(verifications.verificationCode, code),
                gt(verifications.expiresAt, new Date())
            )
        })

        if (!verification) {
            return { success: false, error: 'Invalid or expired verification code' }
        }

        // Update email and clear pending
        await db.update(users)
            .set({
                email: currentUser.pendingEmail,
                pendingEmail: null,
                emailVerified: true
            })
            .where(eq(users.id, userId))

        // Delete verification record
        await db.delete(verifications)
            .where(eq(verifications.id, verification.id))

        revalidatePath('/settings')
        return { success: true }
    } catch (error) {
        console.error('Confirm email change error:', error)
        return { success: false, error: 'Failed to update email' }
    }
}

/**
 * Cancel pending email change
 */
export async function cancelEmailChange(): Promise<{ success: boolean; error?: string }> {
    const userId = await getCurrentUserId()
    if (!userId) {
        return { success: false, error: 'Not authenticated' }
    }

    try {
        await db.update(users)
            .set({ pendingEmail: null })
            .where(eq(users.id, userId))

        return { success: true }
    } catch (error) {
        return { success: false, error: 'Failed to cancel' }
    }
}

/**
 * Get a public profile by user ID
 */
export async function getPublicProfile(userId: string): Promise<PublicProfile | null> {
    const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: {
            id: true,
            name: true,
            displayName: true,
            bio: true,
            image: true,
            coverImage: true,
            isPublic: true,
            profileViews: true,
            createdAt: true,
        }
    })

    if (!user) return null

    // Check if profile is public (or if viewer is the owner)
    const currentUserId = await getCurrentUserId()
    if (!user.isPublic && currentUserId !== userId) {
        return null
    }

    // Get top picks with item details
    const topPicksData = await db
        .select({
            id: items.id,
            name: sql<string>`COALESCE(${globalItems.title}, ${items.name})`,
            image: sql<string | null>`COALESCE(${globalItems.imageUrl}, ${items.image})`,
            tier: items.tier,
            categoryName: categories.name,
        })
        .from(userTopPicks)
        .innerJoin(items, eq(userTopPicks.itemId, items.id))
        .leftJoin(globalItems, eq(items.globalItemId, globalItems.id))
        .leftJoin(categories, eq(items.categoryId, categories.id))
        .where(eq(userTopPicks.userId, userId))
        .orderBy(userTopPicks.sortOrder)
        .limit(3)

    // Get stats
    const itemCount = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(items)
        .where(eq(items.userId, userId))

    const collectionCount = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(categories)
        .where(eq(categories.userId, userId))

    // Increment view count if not viewing own profile
    if (currentUserId !== userId) {
        await db.update(users)
            .set({ profileViews: sql`${users.profileViews} + 1` })
            .where(eq(users.id, userId))
    }

    return {
        id: user.id,
        name: user.name,
        displayName: user.displayName,
        bio: user.bio,
        image: user.image,
        coverImage: user.coverImage,
        isPublic: user.isPublic,
        profileViews: user.profileViews,
        createdAt: user.createdAt,
        topPicks: topPicksData.map(p => ({
            id: p.id,
            name: p.name || 'Untitled',
            image: p.image,
            tier: p.tier,
            categoryName: p.categoryName,
        })),
        stats: {
            totalItems: itemCount[0]?.count || 0,
            totalCollections: collectionCount[0]?.count || 0,
            followerCount: 0, // TODO: Implement follows count
        }
    }
}

/**
 * Get user's public collections for profile display
 */
export async function getUserPublicCollections(userId: string) {
    const collections = await db.query.categories.findMany({
        where: and(
            eq(categories.userId, userId),
            eq(categories.isPublic, true)
        ),
        with: {
            items: {
                columns: { id: true }
            }
        },
        orderBy: desc(categories.createdAt)
    })

    return collections.map(c => ({
        id: c.id,
        name: c.name,
        image: c.image,
        description: c.description,
        itemCount: c.items?.length || 0
    }))
}

// ============================================================================
// Top Picks Actions
// ============================================================================

/**
 * Get current user's top picks
 */
export async function getMyTopPicks() {
    const userId = await getCurrentUserId()
    if (!userId) return []

    const picks = await db
        .select({
            id: userTopPicks.id,
            itemId: items.id,
            name: sql<string>`COALESCE(${globalItems.title}, ${items.name})`,
            image: sql<string | null>`COALESCE(${globalItems.imageUrl}, ${items.image})`,
            tier: items.tier,
            sortOrder: userTopPicks.sortOrder,
        })
        .from(userTopPicks)
        .innerJoin(items, eq(userTopPicks.itemId, items.id))
        .leftJoin(globalItems, eq(items.globalItemId, globalItems.id))
        .where(eq(userTopPicks.userId, userId))
        .orderBy(userTopPicks.sortOrder)

    return picks
}

/**
 * Get user's items available for top picks (excludes already picked items)
 */
export async function getMyItemsForTopPicks() {
    const userId = await getCurrentUserId()
    if (!userId) return []

    // Get current top pick item IDs
    const currentPicks = await db
        .select({ itemId: userTopPicks.itemId })
        .from(userTopPicks)
        .where(eq(userTopPicks.userId, userId))

    const pickedItemIds = currentPicks.map(p => p.itemId)

    // Get all user items with category info
    const userItems = await db.query.items.findMany({
        where: eq(items.userId, userId),
        with: {
            category: {
                columns: { name: true }
            },
            globalItem: {
                columns: { title: true, imageUrl: true }
            }
        },
        orderBy: desc(items.createdAt)
    })

    // Filter out already picked items and format
    return userItems
        .filter(item => !pickedItemIds.includes(item.id))
        .map(item => ({
            id: item.id,
            name: item.globalItem?.title || item.name,
            image: item.globalItem?.imageUrl || item.image,
            tier: item.tier,
            categoryName: item.category?.name || null
        }))
}

/**
 * Add an item to top picks (max 3)
 */
export async function addTopPick(itemId: string): Promise<{ success: boolean; error?: string }> {
    const userId = await getCurrentUserId()
    if (!userId) {
        return { success: false, error: 'Not authenticated' }
    }

    // Check current count
    const existing = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(userTopPicks)
        .where(eq(userTopPicks.userId, userId))

    if ((existing[0]?.count || 0) >= 3) {
        return { success: false, error: 'Maximum 3 top picks allowed. Remove one first.' }
    }

    // Check if item already in top picks
    const alreadyPicked = await db.query.userTopPicks.findFirst({
        where: and(
            eq(userTopPicks.userId, userId),
            eq(userTopPicks.itemId, itemId)
        )
    })

    if (alreadyPicked) {
        return { success: false, error: 'Item already in top picks' }
    }

    // Verify item belongs to user
    const item = await db.query.items.findFirst({
        where: and(
            eq(items.id, itemId),
            eq(items.userId, userId)
        )
    })

    if (!item) {
        return { success: false, error: 'Item not found or not owned by you' }
    }

    try {
        await db.insert(userTopPicks).values({
            userId,
            itemId,
            sortOrder: existing[0]?.count || 0,
        })

        revalidatePath('/profile')
        return { success: true }
    } catch (error) {
        console.error('Failed to add top pick:', error)
        return { success: false, error: 'Failed to add top pick' }
    }
}

/**
 * Remove an item from top picks
 */
export async function removeTopPick(itemId: string): Promise<{ success: boolean; error?: string }> {
    const userId = await getCurrentUserId()
    if (!userId) {
        return { success: false, error: 'Not authenticated' }
    }

    try {
        await db.delete(userTopPicks)
            .where(and(
                eq(userTopPicks.userId, userId),
                eq(userTopPicks.itemId, itemId)
            ))

        // Reorder remaining picks
        const remaining = await db
            .select({ id: userTopPicks.id })
            .from(userTopPicks)
            .where(eq(userTopPicks.userId, userId))
            .orderBy(userTopPicks.sortOrder)

        for (let i = 0; i < remaining.length; i++) {
            await db.update(userTopPicks)
                .set({ sortOrder: i })
                .where(eq(userTopPicks.id, remaining[i].id))
        }

        revalidatePath('/profile')
        return { success: true }
    } catch (error) {
        console.error('Failed to remove top pick:', error)
        return { success: false, error: 'Failed to remove top pick' }
    }
}

/**
 * Reorder top picks
 */
export async function reorderTopPicks(itemIds: string[]): Promise<{ success: boolean; error?: string }> {
    const userId = await getCurrentUserId()
    if (!userId) {
        return { success: false, error: 'Not authenticated' }
    }

    if (itemIds.length > 3) {
        return { success: false, error: 'Maximum 3 top picks allowed' }
    }

    try {
        for (let i = 0; i < itemIds.length; i++) {
            await db.update(userTopPicks)
                .set({ sortOrder: i })
                .where(and(
                    eq(userTopPicks.userId, userId),
                    eq(userTopPicks.itemId, itemIds[i])
                ))
        }

        revalidatePath('/profile')
        return { success: true }
    } catch (error) {
        console.error('Failed to reorder top picks:', error)
        return { success: false, error: 'Failed to reorder top picks' }
    }
}
