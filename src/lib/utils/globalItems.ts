/**
 * Global Item Management Utilities
 * Extracted from items.ts for better maintainability
 * 
 * This module uses proper Database-derived types for full type safety.
 */

import { createClient } from '@/lib/supabase/server'
import { createTypedQuery } from '@/lib/supabase/queries'
import type { GlobalItem, TablesInsert, TablesUpdate } from '@/lib/types/database'

// Input type for creating/updating global items (camelCase for API layer)
export interface GlobalItemData {
    externalId?: string | null
    title: string
    description?: string | null
    imageUrl?: string | null
    metadata?: string | null
    categoryType?: string | null
}

// Re-export the proper Database type for consumers
export type { GlobalItem }

/**
 * Extract tags from metadata for caching
 */
export function extractCachedTags(metadata: string | null): { tags: string[], parsedMeta: Record<string, unknown> | null } {
    if (!metadata) {
        return { tags: [], parsedMeta: null }
    }

    try {
        const parsedMeta = JSON.parse(metadata)
        const tags: string[] = []

        if (Array.isArray(parsedMeta.genres)) tags.push(...parsedMeta.genres)
        if (Array.isArray(parsedMeta.tags)) tags.push(...parsedMeta.tags.slice(0, 10))
        if (Array.isArray(parsedMeta.categories)) tags.push(...parsedMeta.categories)

        return { tags: [...new Set(tags)], parsedMeta }
    } catch {
        console.error('[extractCachedTags] Metadata parse error')
        return { tags: [], parsedMeta: null }
    }
}

/**
 * Find existing global item by external ID
 */
export async function findGlobalItemByExternalId(externalId: string): Promise<GlobalItem | null> {
    const supabase = await createClient()
    const q = createTypedQuery(supabase)

    const { data } = await q.globalItems()
        .select('*')
        .eq('external_id', externalId)
        .single()

    return data
}

/**
 * Find existing global item by title and image
 */
export async function findGlobalItemByTitleAndImage(title: string, imageUrl: string | null): Promise<GlobalItem | null> {
    const supabase = await createClient()
    const q = createTypedQuery(supabase)

    const { data } = await q.globalItems()
        .select('*')
        .eq('title', title)
        .eq('image_url', imageUrl || '')
        .single()

    return data
}

/**
 * Compute updates needed for an existing global item
 */
export function computeGlobalItemUpdates(
    existing: GlobalItem,
    newData: GlobalItemData,
    cachedTags: string[],
    parsedMeta: Record<string, unknown> | null
): TablesUpdate<'global_items'> | null {
    const updates: TablesUpdate<'global_items'> = {}
    let hasUpdates = false

    // Update external_id if missing
    if (!existing.external_id && newData.externalId) {
        updates.external_id = newData.externalId
        hasUpdates = true
    }

    // Update description if missing and present in new data
    if (!existing.description && newData.description) {
        updates.description = newData.description
        hasUpdates = true
    }

    // Update cached_tags if missing or empty
    const existingTags = existing.cached_tags
    const hasCachedTags = Array.isArray(existingTags) && existingTags.length > 0
    if (!hasCachedTags && cachedTags.length > 0) {
        updates.cached_tags = cachedTags
        hasUpdates = true
    }

    // Update metadata if missing
    if (!existing.metadata && parsedMeta) {
        updates.metadata = parsedMeta as TablesUpdate<'global_items'>['metadata']
        hasUpdates = true
    }

    // Update Image URL if missing
    if (!existing.image_url && newData.imageUrl) {
        updates.image_url = newData.imageUrl
        hasUpdates = true
    }

    // Update category_type if provided and different
    if (newData.categoryType && existing.category_type !== newData.categoryType) {
        updates.category_type = newData.categoryType
        hasUpdates = true
    }

    return hasUpdates ? updates : null
}

/**
 * Update an existing global item with new data
 */
export async function updateGlobalItem(id: string, updates: TablesUpdate<'global_items'>): Promise<GlobalItem> {
    const supabase = await createClient()
    const q = createTypedQuery(supabase)

    const { data, error } = await q.globalItems()
        .update(updates)
        .eq('id', id)
        .select()
        .single()

    if (error) throw error
    return data!
}

/**
 * Create a new global item
 */
export async function createGlobalItem(
    data: GlobalItemData,
    cachedTags: string[],
    parsedMeta: Record<string, unknown> | null
): Promise<GlobalItem> {
    const supabase = await createClient()
    const q = createTypedQuery(supabase)

    const insertData: TablesInsert<'global_items'> = {
        external_id: data.externalId,
        title: data.title,
        description: data.description,
        image_url: data.imageUrl,
        metadata: parsedMeta as TablesInsert<'global_items'>['metadata'],
        cached_tags: cachedTags.length > 0 ? cachedTags : null,
        category_type: data.categoryType
    }

    const { data: newItem, error } = await q.globalItems()
        .insert(insertData)
        .select()
        .single()

    if (error) throw error
    return newItem!
}

/**
 * Upsert a global item - find existing or create new
 * This is the main entry point that orchestrates the smaller functions
 */
export async function upsertGlobalItem(data: GlobalItemData): Promise<GlobalItem> {
    // Extract cached tags from metadata
    const { tags: cachedTags, parsedMeta } = extractCachedTags(data.metadata ?? null)

    // Try to find existing by external ID
    if (data.externalId) {
        const existing = await findGlobalItemByExternalId(data.externalId)
        if (existing) {
            const updates = computeGlobalItemUpdates(existing, data, cachedTags, parsedMeta)
            if (updates) {
                return await updateGlobalItem(existing.id, updates)
            }
            return existing
        }
    }

    // Try to find existing by title + image
    const existingByTitle = await findGlobalItemByTitleAndImage(data.title, data.imageUrl ?? null)
    if (existingByTitle) {
        const updates = computeGlobalItemUpdates(existingByTitle, data, cachedTags, parsedMeta)
        if (updates) {
            return await updateGlobalItem(existingByTitle.id, updates)
        }
        return existingByTitle
    }

    // Create new
    return await createGlobalItem(data, cachedTags, parsedMeta)
}
