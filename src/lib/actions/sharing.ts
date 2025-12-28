'use server'

import { db } from '@/lib/db'
import { shareCards, categories, items, globalItems, users } from '@/db/schema'
import { eq, desc, and, sql } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { nanoid } from 'nanoid'

// ============================================================================
// Auth Helper
// ============================================================================

async function getCurrentUserId(): Promise<string | null> {
    const session = await auth.api.getSession({ headers: await headers() })
    return session?.user?.id || null
}

// ============================================================================
// Share Card Types
// ============================================================================

export type ShareCardData = {
    id: string
    shareHash: string
    template: string
    imageUrl: string | null
    viewCount: number
    createdAt: Date
    category: {
        id: string
        name: string
        emoji: string | null
        color: string | null
    }
    curator: {
        id: string
        name: string
        displayName: string | null
        image: string | null
    }
    topItems: {
        id: string
        name: string
        image: string | null
        tier: string | null
    }[]
}

export type ShareTemplate = 'default' | 'instagram' | 'twitter'

// ============================================================================
// Share Actions
// ============================================================================

/**
 * Generate or get existing share card for a collection
 */
export async function generateShareCard(
    categoryId: string,
    template: ShareTemplate = 'default'
): Promise<{ success: boolean; error?: string; shareCard?: ShareCardData }> {
    const userId = await getCurrentUserId()
    if (!userId) {
        return { success: false, error: 'Not authenticated' }
    }

    // Verify category ownership
    const category = await db.query.categories.findFirst({
        where: eq(categories.id, categoryId),
        columns: {
            id: true,
            name: true,
            emoji: true,
            color: true,
            userId: true,
        }
    })

    if (!category) {
        return { success: false, error: 'Collection not found' }
    }

    if (category.userId !== userId) {
        return { success: false, error: 'Only the collection owner can create share cards' }
    }

    // Check for existing share card with same template
    const existing = await db.query.shareCards.findFirst({
        where: and(
            eq(shareCards.categoryId, categoryId),
            eq(shareCards.template, template)
        )
    })

    // Get curator info
    const curator = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { id: true, name: true, displayName: true, image: true }
    })

    // Get top 3 items (S tier or highest ELO)
    const topItems = await db
        .select({
            id: items.id,
            name: sql<string>`COALESCE(${globalItems.title}, ${items.name})`,
            image: sql<string | null>`COALESCE(${globalItems.imageUrl}, ${items.image})`,
            tier: items.tier,
        })
        .from(items)
        .leftJoin(globalItems, eq(items.globalItemId, globalItems.id))
        .where(eq(items.categoryId, categoryId))
        .orderBy(
            sql`CASE WHEN ${items.tier} = 'S' THEN 0 WHEN ${items.tier} = 'A' THEN 1 ELSE 2 END`,
            desc(items.eloScore)
        )
        .limit(3)

    if (existing) {
        // Return existing share card with fresh data
        return {
            success: true,
            shareCard: {
                id: existing.id,
                shareHash: existing.shareHash,
                template: existing.template,
                imageUrl: existing.imageUrl,
                viewCount: existing.viewCount,
                createdAt: existing.createdAt,
                category: {
                    id: category.id,
                    name: category.name,
                    emoji: category.emoji,
                    color: category.color,
                },
                curator: {
                    id: curator!.id,
                    name: curator!.name,
                    displayName: curator!.displayName,
                    image: curator!.image,
                },
                topItems: topItems.map(item => ({
                    id: item.id,
                    name: item.name || 'Untitled',
                    image: item.image,
                    tier: item.tier,
                })),
            }
        }
    }

    // Create new share card
    try {
        const shareHash = nanoid(10) // Short unique ID for URL
        const metadata = JSON.stringify({
            top3ItemIds: topItems.map(i => i.id),
            title: category.name,
            curatorName: curator?.displayName || curator?.name,
            generatedAt: new Date().toISOString(),
        })

        const [newCard] = await db.insert(shareCards)
            .values({
                categoryId,
                userId,
                shareHash,
                template,
                metadata,
            })
            .returning()

        return {
            success: true,
            shareCard: {
                id: newCard.id,
                shareHash: newCard.shareHash,
                template: newCard.template,
                imageUrl: newCard.imageUrl,
                viewCount: newCard.viewCount,
                createdAt: newCard.createdAt,
                category: {
                    id: category.id,
                    name: category.name,
                    emoji: category.emoji,
                    color: category.color,
                },
                curator: {
                    id: curator!.id,
                    name: curator!.name,
                    displayName: curator!.displayName,
                    image: curator!.image,
                },
                topItems: topItems.map(item => ({
                    id: item.id,
                    name: item.name || 'Untitled',
                    image: item.image,
                    tier: item.tier,
                })),
            }
        }
    } catch (error) {
        console.error('Failed to create share card:', error)
        return { success: false, error: 'Failed to create share card' }
    }
}

/**
 * Get share card by hash (public, no auth required)
 */
export async function getShareCardByHash(shareHash: string): Promise<ShareCardData | null> {
    const card = await db.query.shareCards.findFirst({
        where: eq(shareCards.shareHash, shareHash)
    })

    if (!card) return null

    // Increment view count
    await db.update(shareCards)
        .set({ viewCount: sql`${shareCards.viewCount} + 1` })
        .where(eq(shareCards.id, card.id))

    // Get category
    const category = await db.query.categories.findFirst({
        where: eq(categories.id, card.categoryId),
        columns: { id: true, name: true, emoji: true, color: true }
    })

    if (!category) return null

    // Get curator
    const curator = await db.query.users.findFirst({
        where: eq(users.id, card.userId),
        columns: { id: true, name: true, displayName: true, image: true }
    })

    if (!curator) return null

    // Get top items
    const topItems = await db
        .select({
            id: items.id,
            name: sql<string>`COALESCE(${globalItems.title}, ${items.name})`,
            image: sql<string | null>`COALESCE(${globalItems.imageUrl}, ${items.image})`,
            tier: items.tier,
        })
        .from(items)
        .leftJoin(globalItems, eq(items.globalItemId, globalItems.id))
        .where(eq(items.categoryId, card.categoryId))
        .orderBy(
            sql`CASE WHEN ${items.tier} = 'S' THEN 0 WHEN ${items.tier} = 'A' THEN 1 ELSE 2 END`,
            desc(items.eloScore)
        )
        .limit(3)

    return {
        id: card.id,
        shareHash: card.shareHash,
        template: card.template,
        imageUrl: card.imageUrl,
        viewCount: card.viewCount + 1,
        createdAt: card.createdAt,
        category: {
            id: category.id,
            name: category.name,
            emoji: category.emoji,
            color: category.color,
        },
        curator: {
            id: curator.id,
            name: curator.name,
            displayName: curator.displayName,
            image: curator.image,
        },
        topItems: topItems.map(item => ({
            id: item.id,
            name: item.name || 'Untitled',
            image: item.image,
            tier: item.tier,
        })),
    }
}

/**
 * Delete a share card
 */
export async function deleteShareCard(shareHash: string): Promise<{ success: boolean; error?: string }> {
    const userId = await getCurrentUserId()
    if (!userId) {
        return { success: false, error: 'Not authenticated' }
    }

    const card = await db.query.shareCards.findFirst({
        where: eq(shareCards.shareHash, shareHash),
        columns: { id: true, userId: true }
    })

    if (!card || card.userId !== userId) {
        return { success: false, error: 'Share card not found or not authorized' }
    }

    try {
        await db.delete(shareCards).where(eq(shareCards.id, card.id))
        return { success: true }
    } catch (error) {
        console.error('Failed to delete share card:', error)
        return { success: false, error: 'Failed to delete share card' }
    }
}
