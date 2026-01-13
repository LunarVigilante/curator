

/**
 * Shared item transformation logic.
 * Transforms raw Supabase item rows into the format expected by the UI.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RawItemRow = any

/**
 * Transform a raw Supabase item row into the format expected by the UI.
 * Handles merging of global item data and user-specific overrides.
 * Returns all original fields plus transformed convenience fields.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function transformItem(rawItem: RawItemRow, userId?: string): any {
    // Use user-specific tags first, fallback to global cached_tags
    const userTags = rawItem.tags?.map((t: any) => t.tag).filter(Boolean) || []
    const globalTags = rawItem.global_item?.cached_tags || []
    const tags = userTags.length > 0 ? userTags : globalTags

    // Filter ratings to current user if userId provided
    const ratings = userId
        ? (rawItem.ratings?.filter((r: any) => r.user_id === userId) || [])
        : (rawItem.ratings || [])

    return {
        ...rawItem,
        name: rawItem.global_item?.title || rawItem.name || 'Untitled',
        description: rawItem.global_item?.description || rawItem.description || null,
        image: rawItem.global_item?.image_url || rawItem.image || null,
        categoryType: rawItem.global_item?.category_type || null,
        tags,
        ratings,
    }
}

/**
 * Transform an array of raw items.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function transformItems(rawItems: RawItemRow[], userId?: string): any[] {
    return rawItems.map(item => transformItem(item, userId))
}
