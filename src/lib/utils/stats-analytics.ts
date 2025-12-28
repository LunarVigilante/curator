import {
    calculateTierDistribution,
    calculateTopTags,
    identifyControversialItems,
    ControversialItem
} from '@/lib/stats'
import { Item } from '@/components/rating/TierListBoard'

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
