/**
 * Stats utilities for calculating tier percentages and colors.
 * Separated from server actions to allow client-side use.
 */

import type { TierCount } from '@/lib/types/stats'
import {
    calculateTierDistribution,
    calculateTopTags,
    identifyControversialItems,
    ControversialItem
} from '@/lib/stats'
import { Item } from '@/components/rating/TierListBoard'

// Standard tier colors
const TIER_COLORS: Record<string, string> = {
    'S': '#FF7F7F',
    'A': '#FFBF7F',
    'B': '#FFDF7F',
    'C': '#7FFF7F',
    'D': '#7FBFFF',
    'F': '#BF7FFF'
}

/**
 * Get tier color for display
 */
export function getTierColor(tier: string): string {
    return TIER_COLORS[tier] || '#9CA3AF' // gray default
}

/**
 * Calculate percentage for tier distribution
 */
export function calculatePercentages(
    tierDistribution: TierCount[],
    total: number
): (TierCount & { percentage: number; color: string })[] {
    return tierDistribution.map(t => ({
        ...t,
        percentage: total > 0 ? Math.round((t.count / total) * 100) : 0,
        color: getTierColor(t.tier)
    }))
}

export type CollectionStats = {
    totalRated: number
    tierData: { name: string; value: number; color: string; percentage: number }[]
    topTags: [string, number][]
    topRated: Item[]
    controversial: ControversialItem[]
}

export function calculateCollectionStats(items: Item[]): CollectionStats {
    // Reuse existing logic
    const distribution = calculateTierDistribution(items)
    const tags = calculateTopTags(items)
    const controversial = identifyControversialItems(items)

    // Calculate total rated
    const totalRated = distribution.reduce((acc, curr) => acc + curr.count, 0)

    // Map distribution to requested shape (preserving color/percentage for UI)
    const tierData = distribution.map(d => ({
        name: d.tier,
        value: d.count,
        color: d.color,
        percentage: d.percentage
    }))

    // Map tags to tuple [string, number][]
    const topTags: [string, number][] = tags.map(t => [t.name, t.count])

    // Hall of Fame Logic (moved from Component)
    const topRated = items
        .filter(i => i.numericalRating === 100 || i.tier === 'S')
        .slice(0, 4)

    return {
        totalRated,
        tierData,
        topTags,
        topRated,
        controversial
    }
}
