'use server'

import { createClient } from '@/lib/supabase/server'
import { getGuestUserId } from '@/lib/actions/auth'

// Re-export types from shared file
export type { TierCount, TagCount, TopRatedItem, StatsData } from '@/lib/types/stats'
import type { StatsData } from '@/lib/types/stats'

/**
 * Get analytics stats for a user's rated items.
 * Uses a PostgreSQL RPC function for efficient database-side aggregation
 * instead of fetching all items and computing in JavaScript.
 */
export async function getStatsAnalytics(categoryId?: string): Promise<StatsData> {
    const userId = await getGuestUserId()
    const supabase = await createClient()

    if (!userId) {
        return {
            totalRated: 0,
            tierDistribution: [],
            topTags: [],
            topRated: []
        }
    }

    // Call the RPC function for efficient database-side computation
     
    const { data, error } = await (supabase as any).rpc('get_user_stats_analytics', {
        p_user_id: userId,
        p_category_id: categoryId || null
    })

    if (error) {
        console.error('Error fetching stats analytics:', error)
        throw error
    }

    // The RPC returns a JSON object matching our StatsData type
    return data as StatsData
}
