'use server'

import { createClient } from '@/lib/supabase/server'
import { getGuestUserId } from '@/lib/actions/auth'

// Re-export types from shared file
export type { TierCount, TagCount, TopRatedItem, StatsData } from '@/lib/types/stats'
import type { TierCount, TagCount, TopRatedItem, StatsData } from '@/lib/types/stats'

// Standard tier colors and order
const TIER_ORDER = ['S', 'A', 'B', 'C', 'D', 'F']

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

    // Build query for items with tiers
    let itemsQuery = (supabase.from('items') as any)
        .select('id, tier, category_id, elo_score, global_item:global_items(title, image_url)')
        .eq('user_id', userId)
        .not('tier', 'is', null)

    if (categoryId) {
        itemsQuery = itemsQuery.eq('category_id', categoryId)
    }

    const { data: tieredItems, error } = await itemsQuery

    if (error) throw error

    const items = tieredItems || []

    // 1. Tier Distribution
    const tierCounts: Record<string, number> = {}
    for (const item of items) {
        if (item.tier) {
            tierCounts[item.tier] = (tierCounts[item.tier] || 0) + 1
        }
    }

    const tierDistribution: TierCount[] = TIER_ORDER.map(tier => ({
        tier,
        count: tierCounts[tier] || 0
    })).filter(t => t.count > 0)

    // Include custom tiers
    for (const [tier, count] of Object.entries(tierCounts)) {
        if (!TIER_ORDER.includes(tier)) {
            tierDistribution.push({ tier, count })
        }
    }

    const totalRated = items.length

    // 2. Top Tags
    const itemIds = items.map((i: any) => i.id)
    let topTags: TagCount[] = []

    if (itemIds.length > 0) {
        const { data: tagData } = await (supabase.from('items_to_tags') as any)
            .select('tag:tags(id, name)')
            .in('item_id', itemIds)

        // Count tags
        const tagCounts: Record<string, { name: string; count: number }> = {}
        for (const item of tagData || []) {
            const tag = item.tag as any
            if (tag) {
                if (!tagCounts[tag.id]) {
                    tagCounts[tag.id] = { name: tag.name, count: 0 }
                }
                tagCounts[tag.id].count++
            }
        }

        topTags = Object.entries(tagCounts)
            .map(([tagId, data]) => ({
                tagId,
                tagName: data.name,
                count: data.count
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10)
    }

    // 3. Top Rated (S tier items)
    const topRated: TopRatedItem[] = items
        .filter((item: any) => item.tier === 'S')
        .sort((a: any, b: any) => (b.elo_score || 0) - (a.elo_score || 0))
        .slice(0, 4)
        .map((item: any) => ({
            id: item.id,
            name: (item.global_item as any)?.title || 'Untitled',
            image: (item.global_item as any)?.image_url,
            tier: item.tier,
            categoryId: item.category_id
        }))

    return {
        totalRated,
        tierDistribution,
        topTags,
        topRated
    }
}
