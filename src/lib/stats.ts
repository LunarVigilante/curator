
type StatsItem = {
    id: string
    name: string
    ratings: { tier: string | null, value: number }[]
    tags: { name: string }[]
    eloScore: number
    image: string | null
}

export type TierDistribution = {
    tier: string
    count: number
    percentage: number
    color: string
}

export type TopTag = {
    name: string
    count: number
}

export type ControversialItem = {
    id: string
    name: string
    tier: string
    elo: number
    diff: number // Measure of controversy (or discrepancy)
    image: string | null
}

const TIER_VALUES: Record<string, number> = {
    'S': 6, 'A': 5, 'B': 4, 'C': 3, 'D': 2, 'F': 1, 'Unranked': 0
}

const TIER_COLORS: Record<string, string> = {
    'S': '#f87171', // red-400
    'A': '#fb923c', // orange-400
    'B': '#facc15', // yellow-400
    'C': '#4ade80', // green-400
    'D': '#60a5fa', // blue-400
    'F': '#3b82f6', // blue-500
    'Unranked': '#71717a' // zinc-500
}

export function calculateTierDistribution(items: any[]): TierDistribution[] {
    const counts: Record<string, number> = {}
    let totalRated = 0

    // Initialize all tiers to 0 to ensure order
    Object.keys(TIER_VALUES).forEach(t => {
        if (t !== 'Unranked') counts[t] = 0
    })

    items.forEach(item => {
        // Robust tier extraction: check direct property, ratings array, or rank property
        let rawTier = item.tier || item.rank || item.ratings?.[0]?.tier

        if (!rawTier) {
            rawTier = 'Unranked'
        }

        const tier = rawTier.toUpperCase()

        if (TIER_VALUES.hasOwnProperty(tier) && tier !== 'Unranked') {
            counts[tier] = (counts[tier] || 0) + 1
            totalRated++
        }
    })

    if (totalRated === 0) return []

    return Object.entries(counts)
        .filter(([tier]) => counts[tier] > 0) // Only show tiers with items? Or show all? User said "No rated items yet" despite having items. 
        // If I filter > 0, and I have items, it should work.
        // The bug was likely `item.ratings[0]?.tier` accessing failing for items with direct `tier` prop.
        .map(([tier, count]) => ({
            tier,
            count,
            percentage: Math.round((count / totalRated) * 100),
            color: TIER_COLORS[tier] || '#fff'
        }))
        .sort((a, b) => TIER_VALUES[b.tier] - TIER_VALUES[a.tier])
}

export function calculateTopTags(items: StatsItem[]): TopTag[] {
    const counts: Record<string, number> = {}

    items.forEach(item => {
        item.tags.forEach(tag => {
            counts[tag.name] = (counts[tag.name] || 0) + 1
        })
    })

    return Object.entries(counts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
}

export function identifyControversialItems(items: StatsItem[]): ControversialItem[] {
    // Controversy Logic: 
    // We want to find items where the Tier (Human Rank) disagrees with the Elo (Head-to-Head performance).
    // Or simply items that have a surprisingly high/low Elo for their tier.

    // 1. Normalize Elo (approximate). 1200 is average. Range ~800 to ~1600 typically.
    // 2. Normalize Tier. F=1 to S=6.

    // Heuristic:
    // High Elo (>1300) but Low Tier (C/D/F) -> "Underrated Gem" or "Hard to Love"
    // Low Elo (<1100) but High Tier (S/A) -> "Overrated?" or "Nostalgia Pick"

    const candidates: ControversialItem[] = []

    items.forEach(item => {
        const tier = item.ratings[0]?.tier
        if (!tier || tier === 'Unranked') return

        const tierVal = TIER_VALUES[tier]
        const elo = item.eloScore || 1200 // Default to 1200 if missing

        // Define expectations
        // S (6) ~> 1400+
        // A (5) ~> 1300+
        // B (4) ~> 1200+
        // C (3) ~> 1100+
        // D/F (1-2) ~> <1100

        let expectedElo = 1200 + (tierVal - 3.5) * 100
        // S(6) -> 1200 + 2.5*100 = 1450
        // F(1) -> 1200 - 2.5*100 = 950

        const diff = elo - expectedElo

        // If discrepancy is large (> 150 points?)
        if (Math.abs(diff) > 150) {
            candidates.push({
                id: item.id,
                name: item.name,
                tier,
                elo,
                diff,
                image: item.image
            })
        }
    })

    // Sort by magnitude of discrepancy
    return candidates.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)).slice(0, 5)
}
