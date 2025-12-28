/**
 * Shared types for stats analytics.
 * Separated to avoid circular dependencies between server actions and client utilities.
 */

export type TierCount = {
    tier: string
    count: number
}

export type TagCount = {
    tagId: string
    tagName: string
    count: number
}

export type TopRatedItem = {
    id: string
    name: string
    image: string | null
    tier: string | null
    categoryId: string | null
}

export type StatsData = {
    totalRated: number
    tierDistribution: TierCount[]
    topTags: TagCount[]
    topRated: TopRatedItem[]
}
