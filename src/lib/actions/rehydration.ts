'use server'

/**
 * Rehydration Stats and Actions for Admin Data Browser
 * 
 * Provides:
 * - Stats on stale items by priority tier
 * - Trigger mechanism for rehydration runs
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { handleSupabaseError } from '@/lib/utils/errorHandler'

export interface RehydrationStats {
    totalTvShows: number
    staleWeekly: number      // Returning Series > 7 days
    staleMonthly: number     // In Production > 30 days
    staleQuarterly: number   // Ended > 90 days
    neverRehydrated: number  // No last_rehydrated_at
    lastRehydrationRun: string | null
}

/**
 * Get rehydration statistics for TV shows
 */
export async function getRehydrationStats(): Promise<RehydrationStats> {
    const supabase = createServiceRoleClient()

    // Current timestamps for staleness calculation
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const quarterAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()

    // Total TV shows
    const { count: totalTvShows } = await supabase
        .from('global_items')
        .select('id', { count: 'exact', head: true })
        .in('category_type', ['TV_SHOW', 'TV'])

    // Stale weekly (Returning Series > 7 days old)
    const { count: staleWeekly } = await supabase
        .from('global_items')
        .select('id', { count: 'exact', head: true })
        .in('category_type', ['TV_SHOW', 'TV'])
        .eq('rehydration_priority', 'weekly')
        .or(`last_rehydrated_at.is.null,last_rehydrated_at.lt.${weekAgo}`)

    // Stale monthly (In Production > 30 days old)
    const { count: staleMonthly } = await supabase
        .from('global_items')
        .select('id', { count: 'exact', head: true })
        .in('category_type', ['TV_SHOW', 'TV'])
        .eq('rehydration_priority', 'monthly')
        .or(`last_rehydrated_at.is.null,last_rehydrated_at.lt.${monthAgo}`)

    // Stale quarterly (Ended > 90 days old)
    const { count: staleQuarterly } = await supabase
        .from('global_items')
        .select('id', { count: 'exact', head: true })
        .in('category_type', ['TV_SHOW', 'TV'])
        .eq('rehydration_priority', 'quarterly')
        .or(`last_rehydrated_at.is.null,last_rehydrated_at.lt.${quarterAgo}`)

    // Never rehydrated (no priority set yet)
    const { count: neverRehydrated } = await supabase
        .from('global_items')
        .select('id', { count: 'exact', head: true })
        .in('category_type', ['TV_SHOW', 'TV'])
        .is('last_rehydrated_at', null)

    // Most recent rehydration timestamp
    const { data: lastRun } = await supabase
        .from('global_items')
        .select('last_rehydrated_at')
        .in('category_type', ['TV_SHOW', 'TV'])
        .not('last_rehydrated_at', 'is', null)
        .order('last_rehydrated_at', { ascending: false })
        .limit(1)
        .single()

    return {
        totalTvShows: totalTvShows || 0,
        staleWeekly: staleWeekly || 0,
        staleMonthly: staleMonthly || 0,
        staleQuarterly: staleQuarterly || 0,
        neverRehydrated: neverRehydrated || 0,
        lastRehydrationRun: lastRun?.last_rehydrated_at || null
    }
}

/**
 * Trigger rehydration for a specific priority tier
 * Returns the count of items that will be processed
 * 
 * Note: Actual rehydration runs as a background job.
 * This just marks items for processing and returns the count.
 */
export async function triggerRehydration(
    priority: 'weekly' | 'monthly' | 'quarterly' | 'all'
): Promise<{ success: boolean; count: number; error?: string }> {
    const supabase = createServiceRoleClient()

    try {
        const now = new Date()
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
        const quarterAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()

        // Build query based on priority
        let query = supabase
            .from('global_items')
            .select('id', { count: 'exact' })
            .in('category_type', ['TV_SHOW', 'TV'])

        if (priority === 'weekly') {
            query = query
                .eq('rehydration_priority', 'weekly')
                .or(`last_rehydrated_at.is.null,last_rehydrated_at.lt.${weekAgo}`)
        } else if (priority === 'monthly') {
            query = query
                .eq('rehydration_priority', 'monthly')
                .or(`last_rehydrated_at.is.null,last_rehydrated_at.lt.${monthAgo}`)
        } else if (priority === 'quarterly') {
            query = query
                .eq('rehydration_priority', 'quarterly')
                .or(`last_rehydrated_at.is.null,last_rehydrated_at.lt.${quarterAgo}`)
        }
        // For 'all', no additional filters

        const { count, error } = await query

        if (error) {
            handleSupabaseError(error, 'triggerRehydration')
            return { success: false, count: 0, error: error.message }
        }

        // Note: In a production setup, this would queue a background job.
        // For now, just return the count. User runs CLI manually.
        return {
            success: true,
            count: count || 0
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        return { success: false, count: 0, error: message }
    }
}
