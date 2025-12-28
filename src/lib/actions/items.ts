'use server'

import { db } from '@/lib/db'
import { items, itemsToTags, users, globalItems } from '@/db/schema'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { desc, eq, like, and, or, sql } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { downloadImageFromUrl } from './upload'
import { getGuestUserId } from '@/lib/actions/auth'
import { parseItemMetadata } from '@/lib/types/metadata'
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


import { z } from 'zod'

// Zod Schemas
const createItemSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional().default(""),
    categoryId: z.string().uuid(),
    image: z.string().optional().default(""),
    tags: z.array(z.string()).optional().default([]),
    metadata: z.string().optional().nullable() // JSON string or null
})

const updateItemSchema = z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    categoryId: z.string().uuid().optional(),
    image: z.string().optional(),
    metadata: z.string().optional(), // JSON string
    tags: z.array(z.string()).optional(),
    notes: z.string().optional(),
    tier: z.string().optional(),
    rank: z.number().optional()
})

// Internal Logic (Pure Async Function)
export async function createItemInternal(input: z.input<typeof createItemSchema>) {
    const data = createItemSchema.parse(input)
    const userId = await getGuestUserId()
    let { name, description, categoryId, image, tags: tagIds, metadata } = data

    // ... (rest of function) ...
    // Note: I need to output the rest of the function content or just the top part if I use replace.
    // I can't easily partially replace without restating logic if I change the variable name `data` to `input` and then parse.
    // Actually, I can just do `const data = createItemSchema.parse(input)` and keeping the rest is fine if existing code used `data`.

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
        const parsedMeta = parseItemMetadata(typeof metadata === 'string' ? metadata : JSON.stringify(metadata))
        externalId = parsedMeta?.externalId || null
    }

    const globalItem = await upsertGlobalItem({
        externalId,
        title: name,
        description,
        imageUrl: image,
        metadata: typeof metadata === 'string' ? metadata : (metadata ? JSON.stringify(metadata) : null)
    })

    const [newItem] = await db.insert(items).values({
        globalItemId: globalItem.id,
        userId,
        categoryId,
        eloScore: 1200,
    }).returning()

    if (tagIds && tagIds.length > 0) {
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
    return newItem
}

// Global Item Logic (Helper)
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


import { zfd } from 'zod-form-data'

// FormData schemas using zod-form-data
const createItemFormSchema = zfd.formData({
    name: zfd.text(z.string().min(1)),
    description: zfd.text(z.string().optional().default("")),
    category: zfd.text(z.string().uuid()),
    image: zfd.text(z.string().optional().default("")),
    metadata: zfd.text(z.string().optional().nullable()),
    tags: zfd.text(z.string().optional()) // JSON string that we'll parse
})

export async function createItem(formData: FormData) {
    // Safe parsing with zod-form-data
    const result = createItemFormSchema.safeParse(formData)

    if (!result.success) {
        console.error('createItem validation failed:', result.error.issues)
        throw new Error('Invalid form data')
    }

    const { name, description, category, image, metadata, tags: tagsJson } = result.data

    // Safely parse tags JSON
    let tagIds: string[] = []
    if (tagsJson) {
        try {
            const parsed = JSON.parse(tagsJson)
            if (Array.isArray(parsed)) {
                tagIds = parsed
            }
        } catch (e) {
            console.warn('Failed to parse tags JSON:', e)
        }
    }

    await createItemInternal({
        name,
        description: description || "",
        categoryId: category,
        image: image || "",
        metadata: metadata,
        tags: tagIds
    })
}


// Update Logic Internal
export async function updateItemInternal(id: string, input: z.input<typeof updateItemSchema>) {
    const data = updateItemSchema.parse(input)
    const { name, description, categoryId, image, metadata, tags: tagIds, notes, tier, rank } = data

    // Fetch existing item to get globalItemId
    const existingItem = await db.query.items.findFirst({
        where: eq(items.id, id),
        with: { globalItem: true }
    })

    // ... rest of logic
    if (!existingItem) {
        throw new Error('Item not found')
    }

    // Auto-localize external images
    let finalImage = image
    if (finalImage && finalImage.startsWith('http')) {
        const localPath = await downloadImageFromUrl(finalImage)
        if (localPath) {
            finalImage = localPath
        }
    }

    // Update GlobalItem if name/description/image changed
    if (existingItem.globalItemId && (name || description !== undefined || finalImage)) {
        const globalUpdateData: any = {}
        if (name) globalUpdateData.title = name
        if (description !== undefined) globalUpdateData.description = description
        if (finalImage) globalUpdateData.imageUrl = finalImage
        if (metadata) globalUpdateData.metadata = metadata

        if (Object.keys(globalUpdateData).length > 0) {
            await db.update(globalItems)
                .set(globalUpdateData)
                .where(eq(globalItems.id, existingItem.globalItemId))
        }
    }

    // Prepare update object for instance fields
    const updateData: any = { updatedAt: new Date() }
    if (categoryId !== undefined) updateData.categoryId = categoryId
    if (notes !== undefined) updateData.notes = notes
    if (tier !== undefined) updateData.tier = tier
    if (rank !== undefined) updateData.rank = rank

    if (Object.keys(updateData).length > 1) { // >1 because updatedAt is always there
        await db.update(items)
            .set(updateData)
            .where(eq(items.id, id))
    }

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
    if (existingItem.categoryId) revalidatePath(`/categories/${existingItem.categoryId}`)
}

const updateItemFormSchema = zfd.formData({
    name: zfd.text(z.string().optional()),
    description: zfd.text(z.string().optional()),
    category: zfd.text(z.string().uuid().optional()),
    image: zfd.text(z.string().optional()),
    metadata: zfd.text(z.string().optional()),
    notes: zfd.text(z.string().optional()),
    tier: zfd.text(z.string().optional()),
    rank: zfd.text(z.string().optional()), // Parse as string, convert to number
    tags: zfd.text(z.string().optional()) // JSON string
})

export async function updateItem(id: string, formData: FormData) {
    // Safe parsing with zod-form-data
    const result = updateItemFormSchema.safeParse(formData)

    if (!result.success) {
        console.error('updateItem validation failed:', result.error.issues)
        throw new Error('Invalid form data')
    }

    const { name, description, category, image, metadata, notes, tier, rank: rankStr, tags: tagsJson } = result.data

    // Safely parse tags JSON
    let tagIds: string[] | undefined = undefined
    if (tagsJson) {
        try {
            const parsed = JSON.parse(tagsJson)
            if (Array.isArray(parsed)) {
                tagIds = parsed
            }
        } catch (e) {
            console.warn('Failed to parse tags JSON:', e)
        }
    }

    // Build clean data object (only include defined values)
    const cleanData: Record<string, unknown> = {}
    if (name) cleanData.name = name
    if (description !== undefined) cleanData.description = description
    if (category) cleanData.categoryId = category
    if (image) cleanData.image = image
    if (metadata) cleanData.metadata = metadata
    if (notes !== undefined) cleanData.notes = notes
    if (tier) cleanData.tier = tier
    if (rankStr) cleanData.rank = Number(rankStr)
    if (tagIds !== undefined) cleanData.tags = tagIds

    await updateItemInternal(id, cleanData)
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
    await updateItemInternal(itemId, {
        description: enhancement.suggested_description,
        tags: finalTagIds
    })
}

export async function deleteItem(id: string, categoryId?: string) {
    await db.delete(items).where(eq(items.id, id))

    // Revalidate the category page if we know which category
    if (categoryId) {
        revalidatePath(`/categories/${categoryId}`)
    }
    revalidatePath('/items')
    // Don't redirect - let the calling UI handle navigation
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

    if (!userId) return

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
    if (!userId) return []
    return await TournamentService.generateTournamentPool(userId, categoryId, size, true)
}

import { logActivity } from '@/lib/actions/activity'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

export async function submitMatchResult(winnerId: string, loserId: string) {
    const session = await auth.api.getSession({
        headers: await headers()
    })

    if (!session) return

    // helper to get name
    const getName = async (id: string) => {
        // If it looks like a temp id, we might not find it in DB unless it was just added.
        // However, TournamentModal passes the objects in the *client*. 
        // Ideally we pass names from client to avoid DB lookup for temp items?
        // But verifying is better. 
        // For MVP, passing names from client is acceptable if we treat this as a UI feed event.
        // If we only pass IDs, we can't look up "temp-xyz" items.
        // Let's change signature to accept names to support Challenger items that aren't persisted yet.
        const item = await db.query.items.findFirst({
            where: eq(items.id, id),
            with: { globalItem: true }
        })
        return item?.globalItem?.title || item?.name || 'Unknown Item'
    }

    // Since we might be voting on challengers that don't exist in DB yet, 
    // we should really pass the context (Category?) or Names from the client.
    // Let's stick to IDs and only log if they exist? 
    // No, "Alice ranked Dune (Challenger) above Star Wars" is a valid event.
    // I will overload this function or change it to accept metadata.
}

export async function submitMatchActivity(payload: {
    winnerId: string, winnerName: string,
    loserId: string, loserName: string
}) {
    const session = await auth.api.getSession({
        headers: await headers()
    })

    if (!session) return

    await logActivity(session.user.id, 'RANKED_ITEM', {
        winnerName: payload.winnerName,
        loserName: payload.loserName
    })
}
