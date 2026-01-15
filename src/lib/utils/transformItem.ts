import type { Tables } from '@/lib/types/database'

/**
 * Shared item transformation logic.
 * Transforms raw Supabase item rows into the format expected by the UI.
 */

// Type for tag objects expected by UI components
export interface Tag {
    id: string
    name: string
}

// Type for rating rows
export type Rating = Tables<'ratings'>

// Type for raw item row from Supabase with joins
export interface RawItemRow extends Tables<'items'> {
    global_item?: Tables<'global_items'> | null
    tags?: Array<{ tag: Tag | null }> | null
    ratings?: Rating[] | null
    category?: Tables<'categories'> & { custom_ranks?: unknown[] } | null
}

// Type for transformed item returned to UI
export interface TransformedItem extends Omit<RawItemRow, 'tags' | 'ratings'> {
    name: string
    description: string | null
    image: string | null
    categoryType: string | null
    tags: Tag[]
    ratings: Rating[]
    // CamelCase convenience fields for UI component compatibility
    categoryId: string | null
    eloScore: number
    createdAt?: Date
    updatedAt?: Date
    metadata: string | null
}

/**
 * Normalize cached_tags to consistent Tag[] format.
 * cached_tags can be stored as:
 * - Array of {id, name} objects
 * - Array of strings (legacy/some harvesters)
 * - null
 */
function normalizeCachedTags(cachedTags: unknown): Tag[] {
    if (!cachedTags || !Array.isArray(cachedTags)) {
        return []
    }

    return cachedTags
        .map((tag, index) => {
            // Already an object with id and name
            if (tag && typeof tag === 'object' && 'id' in tag && 'name' in tag) {
                return { id: String(tag.id), name: String(tag.name) }
            }
            // String tag - create synthetic object
            if (typeof tag === 'string') {
                return { id: `cached-${index}`, name: tag }
            }
            // Object with just name
            if (tag && typeof tag === 'object' && 'name' in tag) {
                return { id: `cached-${index}`, name: String(tag.name) }
            }
            return null
        })
        .filter((tag): tag is Tag => tag !== null)
}

/**
 * Transform a raw Supabase item row into the format expected by the UI.
 * Handles merging of global item data and user-specific overrides.
 * Returns all original fields plus transformed convenience fields.
 */
export function transformItem(rawItem: RawItemRow, userId?: string): TransformedItem {
    // Extract user-specific tags (from items_to_tags join)
    const userTags: Tag[] = rawItem.tags
        ?.map(t => t.tag)
        .filter((tag): tag is Tag => tag !== null && tag !== undefined) || []

    // Normalize global cached_tags to consistent Tag[] format
    const globalTags = normalizeCachedTags(rawItem.global_item?.cached_tags)

    // Use user-specific tags first, fallback to global cached_tags
    const tags = userTags.length > 0 ? userTags : globalTags

    // Filter ratings to current user if userId provided
    const ratings: Rating[] = userId
        ? (rawItem.ratings?.filter(r => r.user_id === userId) || [])
        : (rawItem.ratings || [])

    // Build metadata string from global_item if available
    const metadata = rawItem.global_item?.metadata
        ? (typeof rawItem.global_item.metadata === 'string'
            ? rawItem.global_item.metadata
            : JSON.stringify(rawItem.global_item.metadata))
        : (rawItem.metadata ? String(rawItem.metadata) : null)

    return {
        ...rawItem,
        name: rawItem.global_item?.title || rawItem.name || 'Untitled',
        description: rawItem.global_item?.description || rawItem.description || null,
        image: rawItem.global_item?.image_url || rawItem.image || null,
        categoryType: rawItem.global_item?.category_type || null,
        tags,
        ratings,
        // CamelCase convenience fields
        categoryId: rawItem.category_id,
        eloScore: rawItem.elo_score ?? 1200,
        createdAt: rawItem.created_at ? new Date(rawItem.created_at) : undefined,
        updatedAt: rawItem.updated_at ? new Date(rawItem.updated_at) : undefined,
        metadata,
    }
}

/**
 * Transform an array of raw items.
 */
export function transformItems(rawItems: RawItemRow[], userId?: string): TransformedItem[] {
    return rawItems.map(item => transformItem(item, userId))
}
