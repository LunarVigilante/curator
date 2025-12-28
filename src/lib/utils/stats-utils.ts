/**
 * Stats utilities for calculating tier percentages and colors.
 * Separated from server actions to allow client-side use.
 */

import type { TierCount } from '@/lib/types/stats'

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
