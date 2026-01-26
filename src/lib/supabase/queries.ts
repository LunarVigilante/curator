/**
 * Typed Query Factory for Supabase
 * 
 * This module provides type-safe query helpers for common database operations.
 * It reduces the need for `as any` casts on Supabase queries while maintaining
 * type inference for filters and return types.
 * 
 * ## Usage
 * ```ts
 * const supabase = await createClient()
 * const q = createTypedQuery(supabase)
 * 
 * // Simple queries - fully typed
 * const { data } = await q.items().select('*').eq('user_id', userId)
 * 
 * // For complex joins with nested selects, use `as any` on the query
 * // to maintain compatibility (TypeScript struggles with dynamic selects)
 * ```
 * 
 * @note For queries with complex `.select()` including nested relations,
 * continue using `as any` - the Supabase types don't fully support dynamic selects.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '../types/database'

export type TypedSupabaseClient = SupabaseClient<Database>

/**
 * Creates typed query helpers for commonly used tables.
 * This helps reduce `as any` casts for simple CRUD operations.
 */
export const createTypedQuery = (client: SupabaseClient) => {
    const typedClient = client as TypedSupabaseClient
    return {
        // Core data tables
        items: () => typedClient.from('items'),
        globalItems: () => typedClient.from('global_items'),
        categories: () => typedClient.from('categories'),

        // User-related tables
        profiles: () => typedClient.from('profiles'),
        invites: () => typedClient.from('invites'),
        activities: () => typedClient.from('activities'),

        // Tagging system
        tags: () => typedClient.from('tags'),
        itemsToTags: () => typedClient.from('items_to_tags'),

        // Rating and ranking
        ratings: () => typedClient.from('ratings'),
        customRanks: () => typedClient.from('custom_ranks'),

        // Administrative
        reports: () => typedClient.from('reports'),
    }
}
