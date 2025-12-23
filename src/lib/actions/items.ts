'use server'

import { db } from '@/lib/db'
import { items, itemsToTags, users } from '@/db/schema'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { desc, eq, like, and, sql } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { downloadImageFromUrl } from './upload'
import { getGuestUserId } from './auth'


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
        query ? like(items.name, `%${query}%`) : undefined
    )

    const [totalCountResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(items)
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
            ratings: true
        }
    })

    // Transform to match UI expectation (flatten tags) and filter ratings
    const transformedItems = result.map(item => ({
        ...item,
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
        tags: item.tags.map(t => t.tag),
        ratings: userId ? item.ratings.filter(r => r.userId === userId) : [],
        category: item.category
    }
}


export async function createItem(data: FormData | {
    name: string
    description: string
    categoryId: string
    image: string
    tags?: string[] // Add tags to type
}) {
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
        // metadata not supported in object mode yet
    }

    // Auto-localize external images
    if (image && image.startsWith('http')) {
        const localPath = await downloadImageFromUrl(image)
        if (localPath) {
            image = localPath
        }
    }

    const [newItem] = await db.insert(items).values({
        name,
        description,
        categoryId,
        image,
        metadata,
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
}) {
    let name: string | undefined
    let description: string | undefined
    let categoryId: string | undefined
    let image: string | undefined
    let metadata: string | undefined
    let tagIds: string[] | undefined

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
        metadata = data.metadata
        tagIds = data.tags
    }

    // Prepare update object with only defined fields
    const updateData: any = { updatedAt: new Date() }
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (categoryId !== undefined) updateData.categoryId = categoryId
    if (image !== undefined) {
        // Auto-localize external images
        if (image && image.startsWith('http')) {
            const localPath = await downloadImageFromUrl(image)
            if (localPath) {
                updateData.image = localPath
            } else {
                updateData.image = image
            }
        } else {
            updateData.image = image
        }
    }
    if (metadata !== undefined) updateData.metadata = metadata

    await db.update(items)
        .set(updateData)
        .where(eq(items.id, id))

    // Update tags if provided
    if (tagIds !== undefined) {
        // First delete existing tags
        await db.delete(itemsToTags).where(eq(itemsToTags.itemId, id))

        // Then insert new tags
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
    if (categoryId || updateData.categoryId) {
        // Try to invalidate mostly relevant paths. 
        // We might not know old categoryId if we only have new one, but revalidating new one is good.
        if (updateData.categoryId) revalidatePath(`/categories/${updateData.categoryId}`)
    }
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
    // 1. Create item
    const [newItem] = await db.insert(items).values({
        name: challenger.name,
        description: challenger.description,
        categoryId: categoryId,
        eloScore: initialElo,
        image: challenger.image, // Ideally we'd download this if it was a real URL
    }).returning()

    // 2. Add "New Discovery" tag if possible?
    // Let's just return for now.

    revalidatePath(`/categories/${categoryId}`)
    return newItem
}
