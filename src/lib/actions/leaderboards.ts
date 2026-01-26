'use server'

import { createClient } from '@/lib/supabase/server'
import { calculateBordaRank, calculateTOPSIS, type TierDistribution, type TopsisItem, type CriterionWeight } from '@/lib/math/mcdm'

// =============================================================================
// TYPES
// =============================================================================

export interface LeaderboardItem {
    id: string
    globalItemId: string
    title: string
    imageUrl: string | null
    categoryType: string
    releaseYear: number | null

    // Scores
    eloScore: number | null
    bordaScore: number | null
    curatorScore: number | null

    // External scores
    voteAverage: number | null
    imdbRating: string | null
    rottenTomatoesRating: string | null
    metacriticRating: number | null

    // Ranking info
    rank: number
    userCount: number
}

export interface LeaderboardOptions {
    categoryType?: string
    limit?: number
    offset?: number
}

export type LeaderboardTab = 'community' | 'critics' | 'curator'

// =============================================================================
// COMMUNITY LEADERBOARD (ELO + Borda)
// =============================================================================

/**
 * Get community leaderboard based on user ELO scores and tier aggregation.
 * Uses Borda Count with Bayesian smoothing to rank items.
 */
export async function getCommunityLeaderboard(options: LeaderboardOptions = {}): Promise<LeaderboardItem[]> {
    const { categoryType, limit = 50, offset = 0 } = options
    const supabase = await createClient()

    // Get all items grouped by global_item_id with ELO and tier aggregation
    let query = supabase
        .from('items')
        .select(`
            global_item_id,
            elo_score,
            tier,
            global_item:global_items!inner(
                id,
                title,
                image_url,
                category_type,
                release_year,
                vote_average,
                imdb_rating,
                rotten_tomatoes_rating,
                metacritic_rating
            )
        `)
        .not('global_item_id', 'is', null)

    if (categoryType) {
        query = query.eq('global_item.category_type', categoryType)
    }

    const { data: items, error } = await (query as any)

    if (error || !items) {
        console.error('Leaderboard query error:', error)
        return []
    }

    // Aggregate by global_item_id
    const aggregated = new Map<string, {
        globalItem: any
        eloScores: number[]
        tierDistribution: TierDistribution
    }>()

    for (const item of items) {
        const globalId = item.global_item_id
        const existing = aggregated.get(globalId) || {
            globalItem: item.global_item,
            eloScores: [],
            tierDistribution: {} as TierDistribution
        }

        if (item.elo_score && item.elo_score !== 1200) {
            existing.eloScores.push(item.elo_score)
        }

        if (item.tier) {
            const tier = item.tier.toUpperCase() as keyof TierDistribution
            existing.tierDistribution[tier] = (existing.tierDistribution[tier] || 0) + 1
        }

        aggregated.set(globalId, existing)
    }

    // Calculate scores and build leaderboard
    const leaderboard: LeaderboardItem[] = []

    for (const [globalItemId, data] of aggregated) {
        const avgElo = data.eloScores.length > 0
            ? data.eloScores.reduce((a, b) => a + b, 0) / data.eloScores.length
            : null

        const bordaScore = calculateBordaRank(data.tierDistribution, {
            bayesianSmoothing: true,
            smoothingVotes: 5
        })

        const globalItem = data.globalItem

        leaderboard.push({
            id: globalItemId,
            globalItemId,
            title: globalItem.title,
            imageUrl: globalItem.image_url,
            categoryType: globalItem.category_type,
            releaseYear: globalItem.release_year,
            eloScore: avgElo ? Math.round(avgElo) : null,
            bordaScore: bordaScore > 0 ? Math.round(bordaScore * 100) / 100 : null,
            curatorScore: null,
            voteAverage: globalItem.vote_average,
            imdbRating: globalItem.imdb_rating,
            rottenTomatoesRating: globalItem.rotten_tomatoes_rating,
            metacriticRating: globalItem.metacritic_rating,
            rank: 0,
            userCount: data.eloScores.length + Object.values(data.tierDistribution).reduce((a: number, b) => a + (b || 0), 0)
        })
    }

    // Sort by Borda score (primary) or ELO (secondary)
    leaderboard.sort((a, b) => {
        if (a.bordaScore !== null && b.bordaScore !== null) {
            return b.bordaScore - a.bordaScore
        }
        if (a.eloScore !== null && b.eloScore !== null) {
            return b.eloScore - a.eloScore
        }
        return 0
    })

    // Assign ranks and paginate
    return leaderboard
        .map((item, index) => ({ ...item, rank: index + 1 }))
        .slice(offset, offset + limit)
}

// =============================================================================
// CRITICS LEADERBOARD (External Scores)
// =============================================================================

/**
 * Get critic leaderboard based on external scores (IMDB, RT, Metacritic).
 */
export async function getCriticLeaderboard(options: LeaderboardOptions = {}): Promise<LeaderboardItem[]> {
    const { categoryType, limit = 50, offset = 0 } = options
    const supabase = await createClient()

    let query = supabase
        .from('global_items')
        .select(`
            id,
            title,
            image_url,
            category_type,
            release_year,
            vote_average,
            popularity,
            imdb_rating,
            rotten_tomatoes_rating,
            metacritic_rating
        `)
        .not('vote_average', 'is', null)
        .order('vote_average', { ascending: false })
        .range(offset, offset + limit - 1)

    if (categoryType) {
        query = query.eq('category_type', categoryType)
    }

    const { data: items, error } = await query

    if (error || !items) {
        console.error('Critic leaderboard error:', error)
        return []
    }

    return items.map((item, index) => ({
        id: item.id,
        globalItemId: item.id,
        title: item.title,
        imageUrl: item.image_url,
        categoryType: item.category_type,
        releaseYear: item.release_year,
        eloScore: null,
        bordaScore: null,
        curatorScore: null,
        voteAverage: item.vote_average,
        imdbRating: item.imdb_rating,
        rottenTomatoesRating: item.rotten_tomatoes_rating,
        metacriticRating: item.metacritic_rating,
        rank: offset + index + 1,
        userCount: 0
    }))
}

// =============================================================================
// CURATOR SCORE LEADERBOARD (TOPSIS Hybrid)
// =============================================================================

/**
 * Get Curator Score leaderboard using TOPSIS to blend all scoring sources.
 */
export async function getCuratorLeaderboard(options: LeaderboardOptions = {}): Promise<LeaderboardItem[]> {
    const { categoryType, limit = 50, offset = 0 } = options

    // First get community data (we need user scores)
    const communityData = await getCommunityLeaderboard({ categoryType, limit: 500 })

    if (communityData.length === 0) {
        // Fall back to critic leaderboard
        return getCriticLeaderboard(options)
    }

    // Define TOPSIS criteria for Curator Score
    const curatorCriteria: CriterionWeight[] = [
        { key: 'borda_score', weight: 0.30, beneficial: true },
        { key: 'elo_score', weight: 0.25, beneficial: true },
        { key: 'vote_average', weight: 0.25, beneficial: true },
        { key: 'user_count', weight: 0.20, beneficial: true },
    ]

    // Build TOPSIS items
    const topsisItems: TopsisItem[] = communityData
        .filter(item => item.bordaScore !== null || item.voteAverage !== null)
        .map(item => ({
            id: item.globalItemId,
            scores: {
                borda_score: item.bordaScore || 0,
                elo_score: item.eloScore ? (item.eloScore - 1000) / 500 : 0, // Normalize ELO to 0-2 range
                vote_average: item.voteAverage || 0,
                user_count: Math.min(item.userCount / 100, 1), // Normalize user count
            }
        }))

    if (topsisItems.length === 0) {
        return getCriticLeaderboard(options)
    }

    // Calculate TOPSIS scores
    const topsisResults = calculateTOPSIS(topsisItems, curatorCriteria)

    // Map back to LeaderboardItems
    const itemMap = new Map(communityData.map(item => [item.globalItemId, item]))

    const leaderboard = topsisResults.map((result, index) => {
        const originalItem = itemMap.get(result.id)!
        return {
            ...originalItem,
            curatorScore: Math.round(result.topsisScore * 100),
            rank: index + 1
        }
    })

    return leaderboard.slice(offset, offset + limit)
}

// =============================================================================
// UNIFIED LEADERBOARD GETTER
// =============================================================================

/**
 * Get leaderboard by tab type.
 */
export async function getLeaderboard(
    tab: LeaderboardTab,
    options: LeaderboardOptions = {}
): Promise<LeaderboardItem[]> {
    switch (tab) {
        case 'community':
            return getCommunityLeaderboard(options)
        case 'critics':
            return getCriticLeaderboard(options)
        case 'curator':
            return getCuratorLeaderboard(options)
        default:
            return getCommunityLeaderboard(options)
    }
}

/**
 * Get available category types for filtering.
 */
export async function getLeaderboardCategories(): Promise<string[]> {
    const supabase = await createClient()

    const { data } = await supabase
        .from('global_items')
        .select('category_type')
        .not('category_type', 'is', null)

    if (!data) return []

    const uniqueCategories = [...new Set(data.map(d => d.category_type))]
    return uniqueCategories.sort()
}
