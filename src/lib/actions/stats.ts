'use server'

import { db } from '@/lib/db'
import { items, tags, itemsToTags, globalItems } from '@/db/schema'
import { eq, count, sql, isNotNull, desc, and, inArray } from 'drizzle-orm'
import { getGuestUserId } from '@/lib/actions/auth'

// Re-export types from shared file
export type { TierCount, TagCount, TopRatedItem, StatsData } from '@/lib/types/stats'
import type { TierCount, TagCount, TopRatedItem, StatsData } from '@/lib/types/stats'

// Standard tier colors and order
const TIER_ORDER = ['S', 'A', 'B', 'C', 'D', 'F']
const TIER_COLORS: Record<string, string> = {
    'S': '#FF7F7F',
    'A': '#FFBF7F',
    'B': '#FFDF7F',
    'C': '#7FFF7F',
    'D': '#7FBFFF',
    'F': '#BF7FFF'
}

/**
 * Get aggregated stats from the database using SQL queries.
 * This is more efficient than fetching all items and calculating on the client.
 */
export async function getStatsAnalytics(categoryId?: string): Promise<StatsData> {
    const userId = await getGuestUserId()

    // Return empty stats if no user
    if (!userId) {
        return {
            totalRated: 0,
            tierDistribution: [],
            topTags: [],
            topRated: []
        }
    }

    // Build base WHERE condition
    const baseConditions = [
        eq(items.userId, userId),
        isNotNull(items.tier)
    ]

    if (categoryId) {
        baseConditions.push(eq(items.categoryId, categoryId))
    }

    // 1. Tier Distribution - COUNT(*) GROUP BY tier
    const tierResults = await db
        .select({
            tier: items.tier,
            count: count()
        })
        .from(items)
        .where(and(...baseConditions))
        .groupBy(items.tier)

    // Map to include colors and ensure order
    const tierDistribution: TierCount[] = TIER_ORDER.map(tier => {
        const found = tierResults.find(r => r.tier === tier)
        return {
            tier,
            count: found?.count ?? 0
        }
    }).filter(t => t.count > 0)

    // Include any custom tiers not in standard order
    const customTiers = tierResults.filter(r => r.tier && !TIER_ORDER.includes(r.tier))
    for (const custom of customTiers) {
        if (custom.tier) {
            tierDistribution.push({
                tier: custom.tier,
                count: custom.count
            })
        }
    }

    // Calculate total rated
    const totalRated = tierResults.reduce((acc, curr) => acc + curr.count, 0)

    // 2. Top Tags - COUNT(*) GROUP BY tagId (with JOIN)
    // First get item IDs that match our criteria
    const itemIdsResult = await db
        .select({ id: items.id })
        .from(items)
        .where(and(...baseConditions))

    const itemIds = itemIdsResult.map(i => i.id)

    let topTags: TagCount[] = []

    if (itemIds.length > 0) {
        const tagResults = await db
            .select({
                tagId: tags.id,
                tagName: tags.name,
                count: count()
            })
            .from(itemsToTags)
            .innerJoin(tags, eq(itemsToTags.tagId, tags.id))
            .where(inArray(itemsToTags.itemId, itemIds))
            .groupBy(tags.id, tags.name)
            .orderBy(desc(count()))
            .limit(10)

        topTags = tagResults.map(r => ({
            tagId: r.tagId,
            tagName: r.tagName,
            count: r.count
        }))
    }

    // 3. Top Rated (Hall of Fame) - Items with tier 'S' or top ELO
    const topRatedResults = await db
        .select({
            id: items.id,
            name: sql<string>`COALESCE(${globalItems.title}, ${items.name})`,
            image: sql<string | null>`COALESCE(${globalItems.imageUrl}, ${items.image})`,
            tier: items.tier,
            categoryId: items.categoryId
        })
        .from(items)
        .leftJoin(globalItems, eq(items.globalItemId, globalItems.id))
        .where(and(
            eq(items.userId, userId),
            eq(items.tier, 'S'),
            categoryId ? eq(items.categoryId, categoryId) : sql`1=1`
        ))
        .orderBy(desc(items.eloScore))
        .limit(4)

    const topRated: TopRatedItem[] = topRatedResults.map(r => ({
        id: r.id,
        name: r.name || 'Untitled',
        image: r.image,
        tier: r.tier,
        categoryId: r.categoryId
    }))

    return {
        totalRated,
        tierDistribution,
        topTags,
        topRated
    }
}

