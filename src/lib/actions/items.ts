'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { downloadImageFromUrl } from './upload'
import { getGuestUserId } from '@/lib/actions/auth'
import { parseItemMetadata } from '@/lib/types/metadata'
import { z } from 'zod'
import { zfd } from 'zod-form-data'
import { getSession } from '@/lib/auth'
import { searchMediaAction } from './media'
import { getCategory } from './categories'
import { transformItem, transformItems } from '@/lib/utils/transformItem'

export async function getItems(
    query?: string,
    page: number = 1,
    limit: number = 12,
    categoryId?: string
) {
    const userId = await getGuestUserId()
    const supabase = await createClient()
    const offset = (page - 1) * limit

    // Build query
    let queryBuilder = (supabase.from('items') as any)
        .select(`
            *,
            global_item:global_items(*),
            tags:items_to_tags(tag:tags(*)),
            ratings(*)
        `, { count: 'exact' })

    if (categoryId) {
        queryBuilder = queryBuilder.eq('category_id', categoryId)
    }

    if (query) {
        // Search in both global_items title and items name
        queryBuilder = queryBuilder.or(`name.ilike.%${query}%,global_item.title.ilike.%${query}%`)
    }

    queryBuilder = queryBuilder
        .order('created_at', { ascending: false })

    if (limit > 0) {
        queryBuilder = queryBuilder.range(offset, offset + limit - 1)
    }

    const { data, count, error } = await queryBuilder

    if (error) throw error

    const totalCount = count || 0

    // Transform items using shared helper
    const transformedItems = transformItems(data || [], userId || undefined)

    return {
        items: transformedItems,
        totalCount,
        totalPages: limit > 0 ? Math.ceil(totalCount / limit) : 1
    }
}

export async function getItem(id: string) {
    const userId = await getGuestUserId()
    const supabase = await createClient()

    const { data: item, error } = await (supabase.from('items') as any)
        .select(`
            *,
            global_item:global_items(*),
            tags:items_to_tags(tag:tags(*)),
            ratings(*),
            category:categories(*, custom_ranks:custom_ranks(*))
        `)
        .eq('id', id)
        .single()

    if (error && error.code !== 'PGRST116') throw error
    if (!item) return null

    // Transform using shared helper
    return transformItem(item, userId || undefined)
}

// Zod Schemas
const createItemSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional().default(""),
    categoryId: z.string().uuid(),
    image: z.string().optional().default(""),
    tags: z.array(z.string()).optional().default([]),
    metadata: z.string().optional().nullable()
})

const updateItemSchema = z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    categoryId: z.string().uuid().optional(),
    image: z.string().optional(),
    metadata: z.string().optional(),
    tags: z.array(z.string()).optional(),
    notes: z.string().optional(),
    tier: z.string().optional(),
    rank: z.number().optional(),
    categoryType: z.string().optional()
})

export async function createItemInternal(input: z.input<typeof createItemSchema>) {
    const data = createItemSchema.parse(input)
    const userId = await getGuestUserId()
    const supabase = await createClient()
    const { name, description, categoryId, tags: tagIds, metadata } = data
    let image = data.image

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

    const { data: newItem, error } = await (supabase.from('items') as any)
        .insert({
            global_item_id: globalItem.id,
            user_id: userId,
            category_id: categoryId,
            elo_score: 1200,
        })
        .select()
        .single()

    if (error) throw error

    if (tagIds && tagIds.length > 0) {
        await (supabase.from('items_to_tags') as any).insert(
            tagIds.map(tagId => ({
                item_id: newItem.id,
                tag_id: tagId
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
    categoryType?: string | null
}) {
    const supabase = await createClient()

    // 3. Extract tags from metadata for cached_tags logic (Reusable)
    let cachedTags: string[] = []
    let parsedMeta: any = null
    if (data.metadata) {
        try {
            parsedMeta = JSON.parse(data.metadata)
            if (Array.isArray(parsedMeta.genres)) cachedTags.push(...parsedMeta.genres)
            if (Array.isArray(parsedMeta.tags)) cachedTags.push(...parsedMeta.tags.slice(0, 10))
            if (Array.isArray(parsedMeta.categories)) cachedTags.push(...parsedMeta.categories)
            cachedTags = [...new Set(cachedTags)]

            // DEBUG LOGGING
            console.log(`[upsertGlobalItem] Title: "${data.title}"`)
            console.log(`[upsertGlobalItem] Metadata Keys: ${Object.keys(parsedMeta).join(', ')}`)
            if (parsedMeta.categories) console.log(`[upsertGlobalItem] Categories: ${JSON.stringify(parsedMeta.categories)}`)
            console.log(`[upsertGlobalItem] Extracted Cached Tags: ${JSON.stringify(cachedTags)}`)
        } catch (e) {
            console.error('[upsertGlobalItem] Metadata parse error:', e)
        }
    } else {
        console.log(`[upsertGlobalItem] No metadata provided for "${data.title}"`)
    }

    // UPDATE HELPER: If we found an existing item, check if we can improve it
    const updateExisting = async (existing: any) => {
        const updates: any = {}
        let hasUpdates = false

        // Update external_id if missing
        if (!existing.external_id && data.externalId) {
            updates.external_id = data.externalId
            hasUpdates = true
        }

        // Update description if missing and present in new data
        if (!existing.description && data.description) {
            updates.description = data.description
            hasUpdates = true
        }

        // Update cached_tags if missing
        if ((!existing.cached_tags || existing.cached_tags.length === 0) && cachedTags.length > 0) {
            updates.cached_tags = cachedTags
            hasUpdates = true
        }

        // Update metadata if missing or we have more info (simple check)
        if (!existing.metadata && parsedMeta) {
            updates.metadata = parsedMeta
            hasUpdates = true
        }

        // Update Image URL if missing
        if (!existing.image_url && data.imageUrl) {
            updates.image_url = data.imageUrl
            hasUpdates = true
        }

        // Update category_type if provided (Correction)
        if (data.categoryType && existing.category_type !== data.categoryType) {
            updates.category_type = data.categoryType
            hasUpdates = true
        }

        if (hasUpdates) {
            console.log(`[upsertGlobalItem] Enhancing existing item "${existing.title}" with new data`)
            const { data: updated, error } = await (supabase.from('global_items') as any)
                .update(updates)
                .eq('id', existing.id)
                .select()
                .single()

            if (!error && updated) return updated
        }
        return existing
    }

    // 1. Check for existing GlobalItem by externalId
    if (data.externalId) {
        const { data: existing } = await (supabase.from('global_items') as any)
            .select('*')
            .eq('external_id', data.externalId)
            .single()
        if (existing) return await updateExisting(existing)
    }

    // 2. Check for existing GlobalItem by exact title + image as fallback
    const { data: existingByTitle } = await (supabase.from('global_items') as any)
        .select('*')
        .eq('title', data.title)
        .eq('image_url', data.imageUrl || '')
        .single()
    if (existingByTitle) return await updateExisting(existingByTitle)

    // 4. Create new GlobalItem with cached_tags populated
    const { data: newItem, error } = await (supabase.from('global_items') as any)
        .insert({
            external_id: data.externalId,
            title: data.title,
            description: data.description,
            image_url: data.imageUrl,
            metadata: parsedMeta,
            cached_tags: cachedTags.length > 0 ? cachedTags : null,
            category_type: data.categoryType
        })
        .select()
        .single()

    if (error) throw error
    return newItem
}

// FormData schemas using zod-form-data
const createItemFormSchema = zfd.formData({
    name: zfd.text(z.string().min(1)),
    description: zfd.text(z.string().optional().default("")),
    category: zfd.text(z.string().uuid()),
    image: zfd.text(z.string().optional().default("")),
    metadata: zfd.text(z.string().optional().nullable()),
    tags: zfd.text(z.string().optional()),
    categoryType: zfd.text(z.string().optional())
})

export async function createItem(formData: FormData) {
    const result = createItemFormSchema.safeParse(formData)

    if (!result.success) {
        console.error('createItem validation failed:', result.error.issues)
        throw new Error('Invalid form data')
    }

    const { name, description, category, image, metadata, tags: tagsJson } = result.data

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

export async function updateItemInternal(id: string, input: z.input<typeof updateItemSchema>) {
    const userId = await getGuestUserId()
    if (!userId) throw new Error('Unauthorized: Not authenticated')

    const data = updateItemSchema.parse(input)
    const supabase = await createClient()
    const { name, description, categoryId, image, metadata, tags: tagIds, notes, tier, rank, categoryType } = data

    // Fetch existing item to get globalItemId and verify ownership
    const { data: existingItem, error: fetchError } = await (supabase.from('items') as any)
        .select('*, global_item:global_items(*)')
        .eq('id', id)
        .single()

    if (fetchError || !existingItem) {
        throw new Error('Item not found')
    }

    // Verify ownership
    if (existingItem.user_id !== userId) {
        throw new Error('Unauthorized: You do not own this item')
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
    if (existingItem.global_item_id && (name || description !== undefined || finalImage)) {
        const globalUpdateData: any = {}
        if (name) globalUpdateData.title = name
        if (description !== undefined) globalUpdateData.description = description
        if (finalImage) globalUpdateData.image_url = finalImage
        if (metadata) globalUpdateData.metadata = JSON.parse(metadata)
        if (categoryType) globalUpdateData.category_type = categoryType

        if (Object.keys(globalUpdateData).length > 0) {
            await (supabase.from('global_items') as any)
                .update(globalUpdateData)
                .eq('id', existingItem.global_item_id)
        }
    }

    // Prepare update object for instance fields
    const updateData: any = { updated_at: new Date().toISOString() }
    if (categoryId !== undefined) updateData.category_id = categoryId
    if (notes !== undefined) updateData.notes = notes
    if (tier !== undefined) updateData.tier = tier
    if (rank !== undefined) updateData.rank = rank

    if (Object.keys(updateData).length > 1) {
        await (supabase.from('items') as any)
            .update(updateData)
            .eq('id', id)
    }

    // Update tags if provided
    if (tagIds !== undefined) {
        await (supabase.from('items_to_tags') as any).delete().eq('item_id', id)
        if (tagIds.length > 0) {
            await (supabase.from('items_to_tags') as any).insert(
                tagIds.map(tagId => ({
                    item_id: id,
                    tag_id: tagId
                }))
            )
        }
    }

    revalidatePath(`/items/${id}`)
    revalidatePath('/items')
    if (categoryId) revalidatePath(`/categories/${categoryId}`)
    if (existingItem.category_id) revalidatePath(`/categories/${existingItem.category_id}`)
}

const updateItemFormSchema = zfd.formData({
    name: zfd.text(z.string().optional()),
    description: zfd.text(z.string().optional()),
    category: zfd.text(z.string().uuid().optional()),
    image: zfd.text(z.string().optional()),
    metadata: zfd.text(z.string().optional()),
    notes: zfd.text(z.string().optional()),
    tier: zfd.text(z.string().optional()),
    rank: zfd.text(z.string().optional()),
    tags: zfd.text(z.string().optional()),
    categoryType: zfd.text(z.string().optional())
})

export async function updateItem(id: string, formData: FormData) {
    const result = updateItemFormSchema.safeParse(formData)

    if (!result.success) {
        console.error('updateItem validation failed:', result.error.issues)
        throw new Error('Invalid form data')
    }

    const { name, description, category, image, metadata, notes, tier, rank: rankStr, tags: tagsJson } = result.data

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
    if (formData.get('categoryType')) cleanData.categoryType = formData.get('categoryType') as string

    await updateItemInternal(id, cleanData)
}

export async function applyItemEnhancement(itemId: string, enhancement: { suggested_tags: string[], suggested_description: string }) {
    const supabase = await createClient()
    const tagIds: string[] = []

    const existingItem = await getItem(itemId)
    const currentTagIds = existingItem?.tags?.map((t: any) => t.id) || []

    for (const tagName of enhancement.suggested_tags) {
        // Check if tag exists
        let { data: tag } = await (supabase.from('tags') as any)
            .select('*')
            .eq('name', tagName)
            .single()

        if (!tag) {
            const { data: newTag, error } = await (supabase.from('tags') as any)
                .insert({ name: tagName })
                .select()
                .single()
            if (error) throw error
            tag = newTag
        }

        tagIds.push(tag.id)
    }

    const finalTagIds = Array.from(new Set([...currentTagIds, ...tagIds]))

    await updateItemInternal(itemId, {
        description: enhancement.suggested_description,
        tags: finalTagIds
    })
}

export async function deleteItem(id: string, categoryId?: string) {
    const userId = await getGuestUserId()
    if (!userId) throw new Error('Unauthorized: Not authenticated')

    const supabase = await createClient()

    // Verify ownership before deletion
    const { data: item, error: fetchError } = await (supabase.from('items') as any)
        .select('user_id')
        .eq('id', id)
        .single()

    if (fetchError && fetchError.code !== 'PGRST116') throw fetchError
    if (!item) throw new Error('Item not found')
    if (item.user_id !== userId) throw new Error('Unauthorized: You do not own this item')

    const { error } = await (supabase.from('items') as any)
        .delete()
        .eq('id', id)

    if (error) throw error

    if (categoryId) {
        revalidatePath(`/categories/${categoryId}`)
    }
    revalidatePath('/items')
}

import { ChallengerItem } from './discovery'

export async function updateItemScores(updates: { id: string, elo: number }[]) {
    const supabase = await createClient()

    for (const update of updates) {
        const { error } = await (supabase.from('items') as any)
            .update({ elo_score: update.elo })
            .eq('id', update.id)
        if (error) throw error
    }

    revalidatePath('/items')
    revalidatePath('/categories')
}

export async function addChallengerItem(challenger: ChallengerItem, categoryId: string, initialElo: number) {
    const userId = await getGuestUserId()
    const supabase = await createClient()

    const globalItem = await upsertGlobalItem({
        externalId: challenger.id,
        title: challenger.name,
        description: challenger.description,
        imageUrl: challenger.image,
    })

    const { data: newItem, error } = await (supabase.from('items') as any)
        .insert({
            global_item_id: globalItem.id,
            user_id: userId,
            category_id: categoryId,
            elo_score: initialElo,
        })
        .select()
        .single()

    if (error) throw error

    revalidatePath(`/categories/${categoryId}`)
    return newItem
}

export async function ignoreItem(itemId: string) {
    const userId = await getGuestUserId()
    if (!userId) return

    const supabase = await createClient()

    const { data: existing } = await (supabase.from('items') as any)
        .select('id')
        .eq('id', itemId)
        .eq('user_id', userId)
        .single()

    if (existing) {
        await (supabase.from('items') as any)
            .update({ status: 'IGNORED', updated_at: new Date().toISOString() })
            .eq('id', itemId)
    }

    revalidatePath('/items')
}

import { TournamentService } from '@/lib/services/TournamentService'
import { logActivity } from '@/lib/actions/activity'

export async function getTournamentPool(categoryId: string, size: number = 20) {
    const userId = await getGuestUserId()
    if (!userId) return []
    return await TournamentService.generateTournamentPool(userId, categoryId, size, true)
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function submitMatchResult(_winnerId: string, _loserId: string) {
    const session = await getSession()
    if (!session) return
    // Activity logging handled by submitMatchActivity
}

export async function submitMatchActivity(payload: {
    winnerId: string, winnerName: string,
    loserId: string, loserName: string
}) {
    const session = await getSession()
    if (!session) return

    await logActivity(session.user.id, 'RANKED_ITEM', {
        winnerName: payload.winnerName,
        loserName: payload.loserName
    })
}

/**
 * Auto-match items without global_item_id to external media services.
 * Uses the category to determine which provider to search (TMDB, Spotify, RAWG, etc.)
 * 
 * @param items - Array of items with id, name, and optional global_item_id
 * @param categoryId - Category ID to determine search provider
 * @returns Map of item IDs to their matched global_item data (image, description)
 */
export async function autoMatchItemsToGlobal(
    items: { id: string; name: string; global_item_id?: string | null }[],
    categoryId: string
): Promise<Map<string, { image: string | null; description: string | null; globalItemId: string }>> {
    const supabase = await createClient()
    const results = new Map<string, { image: string | null; description: string | null; globalItemId: string }>()

    // Get category info for search routing
    const category = await getCategory(categoryId)
    if (!category) return results

    // Filter items that need matching (either no global_item_id OR explicitly requested)
    // We trust the caller to pass only items that need processing
    const itemsToMatch = items
    if (itemsToMatch.length === 0) return results

    console.log(`[AutoMatch] Matching/Updating ${itemsToMatch.length} items for category "${category.name}"`)

    // Process items in batches to avoid rate limits
    for (const item of itemsToMatch) {
        try {
            // Strip year from name for better matching
            const cleanName = item.name.replace(/\s*\(\d{4}\)\s*$/, '').trim()

            // Search using MediaService (routes to correct provider based on category)
            const searchResult = await searchMediaAction(cleanName, category.name, null, categoryId)

            if (!searchResult.success || !searchResult.data || searchResult.data.length === 0) {
                console.log(`[AutoMatch] No results for "${cleanName}"`)
                continue
            }

            // Take first result
            const match = searchResult.data[0]
            console.log(`[AutoMatch] Matched "${cleanName}" -> "${match.title}" (${match.id})`)

            // Create/get global item
            const globalItem = await upsertGlobalItem({
                externalId: match.id,
                title: match.title,
                description: match.description,
                imageUrl: match.imageUrl,
                metadata: match.metadata
            })

            // Update item to link to global item
            await (supabase.from('items') as any)
                .update({ global_item_id: globalItem.id })
                .eq('id', item.id)

            results.set(item.id, {
                image: globalItem.image_url,
                description: globalItem.description,
                globalItemId: globalItem.id
            })

        } catch (error) {
            console.error(`[AutoMatch] Error matching "${item.name}":`, error)
        }
    }

    console.log(`[AutoMatch] Successfully matched ${results.size} of ${itemsToMatch.length} items`)
    return results
}
