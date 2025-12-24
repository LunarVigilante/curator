'use server'

import { db } from '@/lib/db'
import { items, itemsToTags, users, globalItems } from '@/db/schema'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { desc, eq, like, and, or, sql } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { downloadImageFromUrl } from './upload'
import { getGuestUserId } from '@/lib/actions/auth'
// Fixed import path to be local active auth file, OR correct if it is in ../auth
// Wait, I previously changed it to `../auth` and it failed. 
// Let's check where `getGuestUserId` is defined. 
// It is likely in `src/lib/actions/auth.ts` or `src/lib/auth.ts`?
// I see `src/lib/actions/auth.ts` was edited in earlier turns.
// I will check `src/lib/actions/auth.ts` content first.



export async function getItems(
    query?: string,
    page: number = 1,
    limit: number = 12,
    categoryId?: string
) {
    const userId = await getGuestUserId()
    const offset = (page - 1) * limit

    const whereClause = and(
        categoryId ? eq(items.categoryId, categoryId) : undefined,
        query ? or(
            like(globalItems.title, `%${query}%`),
            like(items.name, `%${query}%`) // Fallback for migration
        ) : undefined
    )

    const [totalCountResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(items)
        .leftJoin(globalItems, eq(items.globalItemId, globalItems.id))
        .where(whereClause)

    const totalCount = totalCountResult?.count || 0

    const isUnlimited = limit === 0
    const drizzleLimit = isUnlimited ? undefined : limit
    const drizzleOffset = isUnlimited ? 0 : offset

    const result = await db.query.items.findMany({
        where: whereClause,
        orderBy: [desc(items.createdAt)],
        limit: drizzleLimit,
        offset: drizzleOffset,
        with: {
            tags: {
                with: {
                    tag: true
                }
            },
            ratings: true,
            globalItem: true
        }
    })

    // Transform to match UI expectation (flatten tags) and handle missing items
    const transformedItems = result.map(item => ({
        ...item,
        // Prioritize global data, fallback to old item data for migration
        name: item.globalItem?.title || item.name || 'Untitled',
        description: item.globalItem?.description || item.description,
        image: item.globalItem?.imageUrl || item.image,
        tags: item.tags.map(t => t.tag),
        ratings: userId ? item.ratings.filter(r => r.userId === userId) : []
    }))

    return {
        items: transformedItems,
        totalCount,
        totalPages: isUnlimited ? 1 : Math.ceil(totalCount / limit)
    }
}

export async function getItem(id: string) {
    const userId = await getGuestUserId()

    const item = await db.query.items.findFirst({
        where: eq(items.id, id),
        with: {
            tags: {
                with: {
                    tag: true
                }
            },
            ratings: true,
            globalItem: true,
            category: {
                with: {
                    customRanks: true
                }
            }
        }
    })

    if (!item) return null

    // Transform to match UI expectation
    return {
        ...item,
        name: item.globalItem?.title || item.name || 'Untitled',
        description: item.globalItem?.description || item.description,
        image: item.globalItem?.imageUrl || item.image,
        tags: item.tags.map(t => t.tag),
        ratings: userId ? item.ratings.filter(r => r.userId === userId) : [],
        category: item.category
    }
}


async function upsertGlobalItem(data: {
    externalId?: string | null
    title: string
    description?: string | null
    imageUrl?: string | null
    metadata?: string | null
}) {
    // 1. Check for existing GlobalItem by externalId
    if (data.externalId) {
        const existing = await db.query.globalItems.findFirst({
            where: eq(globalItems.externalId, data.externalId)
        })
        if (existing) return existing
    }

    // 2. Check for existing GlobalItem by exact title + image as fallback
    const existing = await db.query.globalItems.findFirst({
        where: and(
            eq(globalItems.title, data.title),
            eq(globalItems.imageUrl, data.imageUrl || '')
        )
    })
    if (existing) return existing

    // 3. Create new GlobalItem
    const [newItem] = await db.insert(globalItems).values({
        externalId: data.externalId,
        title: data.title,
        description: data.description,
        imageUrl: data.imageUrl,
        metadata: data.metadata,
    }).returning()

    return newItem
}

export async function createItem(data: FormData | {
    name: string
    description: string
    categoryId: string
    image: string
    tags?: string[]
}) {
    const userId = await getGuestUserId()
    let name: string
    let description: string
    let categoryId: string
    let image: string
    let metadata: string | null = null
    let tagIds: string[] = []

    if (data instanceof FormData) {
        name = data.get('name') as string
        description = data.get('description') as string
        categoryId = data.get('category') as string
        image = data.get('image') as string
        metadata = data.get('metadata') as string
        const tagsJson = data.get('tags') as string
        if (tagsJson) {
            tagIds = JSON.parse(tagsJson)
        }
    } else {
        name = data.name
        description = data.description
        categoryId = data.categoryId
        image = data.image
        tagIds = data.tags || []
    }

    // Auto-localize external images
    if (image && image.startsWith('http')) {
        const localPath = await downloadImageFromUrl(image)
        if (localPath) {
            image = localPath
        }
    }

    // Upsert GlobalItem first
    let externalId: string | null = null
    if (metadata) {
        try {
            const meta = JSON.parse(metadata)
            externalId = meta.externalId || meta.id || null
        } catch (e) { }
    }

    const globalItem = await upsertGlobalItem({
        externalId,
        title: name,
        description,
        imageUrl: image,
        metadata
    })

    const [newItem] = await db.insert(items).values({
        globalItemId: globalItem.id,
        userId,
        categoryId,
        eloScore: 1200,
    }).returning()

    if (tagIds.length > 0) {
        await db.insert(itemsToTags).values(
            tagIds.map(tagId => ({
                itemId: newItem.id,
                tagId
            }))
        )
    }

    revalidatePath('/items')
    if (categoryId) {
        revalidatePath(`/categories/${categoryId}`)
    }
}

export async function updateItem(id: string, data: FormData | {
    name?: string
    description?: string
    categoryId?: string
    image?: string
    metadata?: string
    tags?: string[]
    notes?: string
    tier?: string
    rank?: number
}) {
    let name: string | undefined
    let description: string | undefined
    let categoryId: string | undefined
    let image: string | undefined
    let metadata: string | undefined
    let tagIds: string[] | undefined
    let notes: string | undefined
    let tier: string | undefined
    let rank: number | undefined

    if (data instanceof FormData) {
        name = data.get('name') as string
        description = data.get('description') as string
        categoryId = data.get('category') as string
        image = data.get('image') as string
        metadata = data.get('metadata') as string
        notes = data.get('notes') as string
        tier = data.get('tier') as string
        rank = Number(data.get('rank')) || undefined
        const tagsJson = data.get('tags') as string
        if (tagsJson) {
            tagIds = JSON.parse(tagsJson)
        }
    } else {
        name = data.name
        description = data.description
        categoryId = data.categoryId
        image = data.image
        metadata = data.metadata
        tagIds = data.tags
        notes = data.notes
        tier = data.tier
        rank = data.rank
    }

    // 1. Handle GlobalItem updates if name/image changed
    // In a shared system, users shouldn't easily change global metadata unless they have permissions.
    // However, for this MVP, we'll allow it or just update the current user's link.
    // For now, let's keep GlobalItem as is and only update instance fields.

    // Prepare update object for instance fields
    const updateData: any = { updatedAt: new Date() }
    if (categoryId !== undefined) updateData.categoryId = categoryId
    if (notes !== undefined) updateData.notes = notes
    if (tier !== undefined) updateData.tier = tier
    if (rank !== undefined) updateData.rank = rank

    await db.update(items)
        .set(updateData)
        .where(eq(items.id, id))

    // Update tags if provided
    if (tagIds !== undefined) {
        await db.delete(itemsToTags).where(eq(itemsToTags.itemId, id))
        if (tagIds.length > 0) {
            await db.insert(itemsToTags).values(
                tagIds.map(tagId => ({
                    itemId: id,
                    tagId
                }))
            )
        }
    }

    revalidatePath(`/items/${id}`)
    revalidatePath('/items')
    if (categoryId) revalidatePath(`/categories/${categoryId}`)
}

// Helper to apply AI suggestions (tags by name, description)
import { tags as tagsSchema } from '@/db/schema'

export async function applyItemEnhancement(itemId: string, enhancement: { suggested_tags: string[], suggested_description: string }) {
    // 1. Resolve Tags (Create if not exist)
    const tagIds: string[] = []

    // Get existing tags for the item first to merge? 
    // Usually enhancements suggest *additional* or *refined* tags. 
    // Let's assume we want to MERGE with existing tags to be safe, or replacing?
    // The prompt implies "suggested tags", typically strictly better. 
    // Let's Fetch existing tags first to be safe and Append unique new ones.
    const existingItem = await getItem(itemId)
    const currentTagIds = existingItem?.tags.map(t => t.id) || []

    // Process suggested tags
    for (const tagName of enhancement.suggested_tags) {
        // Check if tag exists
        let tag = await db.query.tags.findFirst({
            where: eq(tagsSchema.name, tagName)
        })

        if (!tag) {
            // Create new tag
            const [newTag] = await db.insert(tagsSchema).values({ name: tagName }).returning()
            tag = newTag
        }

        tagIds.push(tag.id)
    }

    // Merge with current tags (avoid duplicates)
    const finalTagIds = Array.from(new Set([...currentTagIds, ...tagIds]))

    // 2. Update Item
    await updateItem(itemId, {
        description: enhancement.suggested_description,
        tags: finalTagIds
    })
}

export async function deleteItem(id: string) {
    await db.delete(items).where(eq(items.id, id))

    revalidatePath('/items')
    redirect('/items')
}

import { ChallengerItem } from './discovery'

export async function updateItemScores(updates: { id: string, elo: number }[]) {
    // Process updates in batches or parallel
    await db.transaction(async (tx) => {
        for (const update of updates) {
            await tx.update(items)
                .set({ eloScore: update.elo })
                .where(eq(items.id, update.id))
        }
    })

    // We don't know exactly which category was updated, so we might need to rely on revalidating specific paths or generic ones.
    // For now, revalidate everything relevant.
    revalidatePath('/items')
    revalidatePath('/categories')
}

export async function addChallengerItem(challenger: ChallengerItem, categoryId: string, initialElo: number) {
    const userId = await getGuestUserId()

    // 1. Upsert GlobalItem
    const globalItem = await upsertGlobalItem({
        externalId: challenger.id,
        title: challenger.name,
        description: challenger.description,
        imageUrl: challenger.image,
    })

    // 2. Create local item instance
    const [newItem] = await db.insert(items).values({
        globalItemId: globalItem.id,
        userId,
        categoryId: categoryId,
        eloScore: initialElo,
    }).returning()

    revalidatePath(`/categories/${categoryId}`)
    return newItem
}

export async function ignoreItem(itemId: string) {
    const userId = await getGuestUserId()

    // Check if item exists in user library
    const existing = await db.query.items.findFirst({
        where: and(
            eq(items.id, itemId),
            eq(items.userId, userId)
        )
    })

    if (existing) {
        // Update status
        await db.update(items)
            .set({ status: 'IGNORED', updatedAt: new Date() })
            .where(eq(items.id, itemId))
    } else {
        // If it's a temp/challenger item not in DB, we'd need to add it as IGNORED.
        // But temp items usually have ID 'temp-...', so we can't update them directly.
        // Frontend handles ignoring temp items by just not showing them, 
        // BUT if "Never Show" is clicked for a global/challenger, we SHOULD persist that ban.
        // Current implementation assumes we only ignore things we track. 
        // For "Discovery" items, we'd ideally blacklist the externalId.
        // For MVP: We only support ignoring existing User Items.
    }

    revalidatePath('/items')
}

import { TournamentService } from '@/lib/services/TournamentService'

export async function getTournamentPool(categoryId: string, size: number = 20) {
    const userId = await getGuestUserId()
    return await TournamentService.generateTournamentPool(userId, categoryId, size, true)
}
