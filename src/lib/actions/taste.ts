'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentUserId } from '@/lib/auth'
import {
    MetricTypes,
    InsightKeys,
    ConditionTypes,
    TIERS,
    type MetricType,
    type InsightKey,
    type TierDistribution,
    type UnlockStatus,
    type SnapshotMetrics,
    type TasteEvolution,
    DEFAULT_UNLOCK_CONDITIONS
} from '@/lib/types/taste'

// ============================================================================
// TIER DISTRIBUTION HELPERS
// ============================================================================

/**
 * Get tier distribution for a user
 */
async function getTierDistribution(
    userId: string,
    categoryId?: string
): Promise<TierDistribution> {
    const supabase = await createClient()

    let query = (supabase.from('items') as any)
        .select('tier')
        .eq('user_id', userId)
        .not('tier', 'is', null)

    if (categoryId) {
        query = query.eq('category_id', categoryId)
    }

    const { data: items } = await query

    const distribution: TierDistribution = { S: 0, A: 0, B: 0, C: 0, D: 0, F: 0 }
    const total = items?.length || 0

    if (total === 0) return distribution

    // Count tiers
    const counts: Record<string, number> = {}
    for (const item of items || []) {
        if (item.tier) {
            counts[item.tier] = (counts[item.tier] || 0) + 1
        }
    }

    for (const [tier, count] of Object.entries(counts)) {
        if (tier in distribution) {
            distribution[tier as keyof TierDistribution] = (count / total) * 100
        }
    }

    return distribution
}

/**
 * Normalize distribution to a vector for cosine similarity
 */
function distributionToVector(dist: TierDistribution): number[] {
    return TIERS.map(tier => dist[tier] || 0)
}

/**
 * Cosine similarity between two vectors
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0)
    const magA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0))
    const magB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0))
    if (magA === 0 || magB === 0) return 0
    return dotProduct / (magA * magB)
}

// ============================================================================
// METRIC COMPUTATION
// ============================================================================

/**
 * Compute Niche Score: How specialized is the user's taste?
 * Higher = more concentrated in top tiers, lower = evenly spread
 */
function computeNicheScore(distribution: TierDistribution): number {
    // Niche users rate very few things highly (concentrated S/A)
    // Score based on concentration in top tiers
    const topTierPercent = distribution.S + distribution.A
    const bottomTierPercent = distribution.D + distribution.F

    // If >60% in S/A AND <15% in D/F = very niche
    // Normalize to 0-100
    const concentration = Math.min(topTierPercent, 80) / 80 * 70
    const rarity = Math.max(0, 25 - bottomTierPercent) / 25 * 30

    return Math.round(concentration + rarity)
}

/**
 * Compute Diversity Score: How varied is the user's ratings?
 * Higher = uses full tier spectrum, lower = concentrated
 */
function computeDiversityScore(distribution: TierDistribution): number {
    // Shannon entropy normalized to 0-100
    const values = Object.values(distribution).filter(v => v > 0)
    if (values.length === 0) return 0

    const entropy = values.reduce((sum, p) => {
        const prob = p / 100
        return sum - (prob > 0 ? prob * Math.log2(prob) : 0)
    }, 0)

    // Max entropy for 6 tiers = log2(6) ≈ 2.585
    const maxEntropy = Math.log2(6)
    return Math.round((entropy / maxEntropy) * 100)
}

/**
 * Compute all metrics for a user
 */
export async function computeUserMetrics(
    userId: string,
    categoryId?: string
): Promise<Record<MetricType, number>> {
    const distribution = await getTierDistribution(userId, categoryId)

    const metrics: Record<MetricType, number> = {
        [MetricTypes.NICHE_SCORE]: computeNicheScore(distribution),
        [MetricTypes.DIVERSITY_SCORE]: computeDiversityScore(distribution),
        [MetricTypes.SNOB_SCORE]: 0, // Computed with comparison
        [MetricTypes.ALIGNMENT_GLOBAL]: 0, // Computed with cohort
        [MetricTypes.ALIGNMENT_EXPERTS]: 0, // Computed with cohort
        [MetricTypes.CONSISTENCY_SCORE]: 0, // TODO: implement
    }

    return metrics
}

/**
 * Compute alignment score between user and a cohort
 */
export async function computeAlignmentScore(
    userId: string,
    cohortType: 'global' | 'experts',
    categoryId?: string
): Promise<number> {
    const supabase = await createClient()
    const userDist = await getTierDistribution(userId, categoryId)
    const userVector = distributionToVector(userDist)

    // Get pre-computed cohort average
    let query = (supabase.from('cohort_averages') as any)
        .select('*')
        .eq('cohort_type', cohortType)
        .eq('metric_type', 'tier_distribution')

    if (categoryId) {
        query = query.eq('category_id', categoryId)
    } else {
        query = query.is('category_id', null)
    }

    const { data: cohortAvg } = await query.single()

    if (!cohortAvg) {
        // No cohort data yet, return neutral
        return 50
    }

    // Cohort avg stored as JSON in avgValue column or we need separate storage
    // For now, use a default global distribution
    const globalAvgDist: TierDistribution = { S: 10, A: 20, B: 35, C: 20, D: 10, F: 5 }
    const cohortVector = distributionToVector(globalAvgDist)

    const similarity = cosineSimilarity(userVector, cohortVector)
    // Normalize from [-1, 1] to [0, 100]
    return Math.round((similarity + 1) * 50)
}

// ============================================================================
// METRIC CACHING
// ============================================================================

/**
 * Get cached metrics or compute fresh ones
 */
export async function getTasteMetrics(
    userId?: string,
    categoryId?: string,
    maxAge: number = 3600000 // 1 hour in ms
): Promise<Record<string, number> | null> {
    const currentUserId = userId || await getCurrentUserId()
    if (!currentUserId) return null

    const supabase = await createClient()

    // Check cache
    let query = (supabase.from('taste_metrics') as any)
        .select('*')
        .eq('user_id', currentUserId)

    if (categoryId) {
        query = query.eq('category_id', categoryId)
    } else {
        query = query.is('category_id', null)
    }

    const { data: cached } = await query

    const now = Date.now()
    const validCache = (cached || []).filter((m: any) =>
        now - new Date(m.computed_at).getTime() < maxAge
    )

    if (validCache.length >= 2) {
        // Return cached metrics
        const result: Record<string, number> = {}
        for (const metric of validCache) {
            result[metric.metric_type] = metric.value
        }
        return result
    }

    // Compute fresh metrics
    const metrics = await computeUserMetrics(currentUserId, categoryId)

    // Cache them - use upsert with on conflict
    for (const [type, value] of Object.entries(metrics)) {
        await (supabase.from('taste_metrics') as any)
            .upsert({
                user_id: currentUserId,
                category_id: categoryId || null,
                metric_type: type,
                value,
                computed_at: new Date().toISOString()
            }, { onConflict: 'user_id, category_id, metric_type' })
    }

    return metrics
}

// ============================================================================
// UNLOCK SYSTEM
// ============================================================================

/**
 * Check if an insight is unlocked for a user
 */
export async function checkInsightUnlock(
    insightKey: InsightKey,
    categoryId?: string
): Promise<UnlockStatus> {
    const userId = await getCurrentUserId()
    if (!userId) return { unlocked: false, displayLabel: 'Sign in required' }

    const supabase = await createClient()

    // Check if already unlocked
    const { data: existing } = await (supabase.from('insight_unlocks') as any)
        .select('id')
        .eq('user_id', userId)
        .eq('insight_key', insightKey)
        .single()

    if (existing) return { unlocked: true }

    // Get conditions for this insight
    const { data: conditions } = await (supabase.from('unlock_conditions') as any)
        .select('*')
        .eq('insight_key', insightKey)

    // If no conditions defined, check defaults
    const effectiveConditions = (conditions?.length || 0) > 0
        ? conditions!
        : DEFAULT_UNLOCK_CONDITIONS.filter(c => c.insightKey === insightKey)

    for (const condition of effectiveConditions) {
        const progress = await evaluateCondition(userId, condition, categoryId)

        if (progress < condition.threshold) {
            const percentComplete = Math.round((progress / condition.threshold) * 100)
            return {
                unlocked: false,
                progress,
                required: condition.threshold,
                displayLabel: condition.displayLabel || condition.display_label,
                percentComplete
            }
        }
    }

    // All conditions met - grant unlock
    await (supabase.from('insight_unlocks') as any).insert({
        user_id: userId,
        insight_key: insightKey,
        unlock_context: JSON.stringify({ categoryId, triggeredAt: new Date().toISOString() })
    })

    return { unlocked: true }
}

/**
 * Evaluate a single unlock condition
 */
async function evaluateCondition(
    userId: string,
    condition: { conditionType?: string; condition_type?: string; threshold: number; categoryScoped?: boolean; category_scoped?: boolean },
    categoryId?: string
): Promise<number> {
    const supabase = await createClient()
    const conditionType = condition.conditionType || condition.condition_type
    const categoryScoped = condition.categoryScoped ?? condition.category_scoped

    switch (conditionType) {
        case ConditionTypes.MIN_ITEMS_RATED: {
            let query = (supabase.from('items') as any)
                .select('id', { count: 'exact', head: true })
                .eq('user_id', userId)
                .not('tier', 'is', null)

            if (categoryScoped && categoryId) {
                query = query.eq('category_id', categoryId)
            }

            const { count } = await query
            return count || 0
        }

        case ConditionTypes.ACCOUNT_AGE_DAYS: {
            const { data: user } = await (supabase.from('profiles') as any)
                .select('created_at')
                .eq('id', userId)
                .single()

            if (!user) return 0
            const daysSinceCreation = Math.floor(
                (Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24)
            )
            return daysSinceCreation
        }

        case ConditionTypes.MIN_FOLLOWING: {
            const { count } = await (supabase.from('follows') as any)
                .select('id', { count: 'exact', head: true })
                .eq('follower_id', userId)

            return count || 0
        }

        case ConditionTypes.MIN_CATEGORIES: {
            const { data: items } = await (supabase.from('items') as any)
                .select('category_id')
                .eq('user_id', userId)
                .not('tier', 'is', null)

            const uniqueCategories = new Set(items?.map((i: any) => i.category_id).filter(Boolean))
            return uniqueCategories.size
        }

        default:
            return 0
    }
}

/**
 * Get all unlock statuses for a user
 */
export async function getAllUnlockStatuses(
    categoryId?: string
): Promise<Record<InsightKey, UnlockStatus>> {
    const statuses: Record<InsightKey, UnlockStatus> = {} as any

    for (const key of Object.values(InsightKeys)) {
        statuses[key] = await checkInsightUnlock(key, categoryId)
    }

    return statuses
}

// ============================================================================
// TEMPORAL EVOLUTION
// ============================================================================

/**
 * Capture a snapshot of user's current metrics
 */
export async function captureSnapshot(
    userId: string,
    snapshotType: 'weekly' | 'monthly' | 'milestone',
    categoryId?: string
): Promise<void> {
    const supabase = await createClient()
    const metrics = await computeUserMetrics(userId, categoryId)


    // Get item count
    let countQuery = (supabase.from('items') as any)
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .not('tier', 'is', null)

    if (categoryId) {
        countQuery = countQuery.eq('category_id', categoryId)
    }

    const { count } = await countQuery

    const snapshotMetrics: SnapshotMetrics = {
        niche_score: metrics[MetricTypes.NICHE_SCORE],
        diversity_score: metrics[MetricTypes.DIVERSITY_SCORE],
        alignment_global: metrics[MetricTypes.ALIGNMENT_GLOBAL],
        totalItems: count || 0,
        topGenres: [], // TODO: compute from tags
    }

    await (supabase.from('taste_snapshots') as any).insert({
        user_id: userId,
        category_id: categoryId || null,
        snapshot_type: snapshotType,
        metrics_json: JSON.stringify(snapshotMetrics),
        item_count: snapshotMetrics.totalItems,
        top_genres_json: JSON.stringify(snapshotMetrics.topGenres),
        captured_at: new Date().toISOString()
    })
}

/**
 * Get taste evolution over time
 */
export async function getTasteEvolution(
    months: number = 3
): Promise<TasteEvolution | null> {
    const userId = await getCurrentUserId()
    if (!userId) return null

    const supabase = await createClient()

    const { data: snapshots } = await (supabase.from('taste_snapshots') as any)
        .select('*')
        .eq('user_id', userId)
        .order('captured_at', { ascending: false })
        .limit(months * 5) // ~5 data points per month

    if (!snapshots || snapshots.length < 2) return null

    const latest = JSON.parse(snapshots[0].metrics_json) as SnapshotMetrics
    const oldest = JSON.parse(snapshots[snapshots.length - 1].metrics_json) as SnapshotMetrics

    const nicheChange = (latest.niche_score ?? 0) - (oldest.niche_score ?? 0)
    const diversityChange = (latest.diversity_score ?? 0) - (oldest.diversity_score ?? 0)
    const alignmentChange = (latest.alignment_global ?? 0) - (oldest.alignment_global ?? 0)

    // Determine trend
    let trend: TasteEvolution['trend'] = 'stable'
    if (nicheChange > 10) trend = 'specializing'
    else if (diversityChange > 10) trend = 'diversifying'
    else if (alignmentChange > 10) trend = 'improving'

    return {
        period: `${months} months`,
        dataPoints: snapshots.length,
        changes: {
            nicheScore: nicheChange,
            diversityScore: diversityChange,
            alignmentGlobal: alignmentChange
        },
        trend
    }
}

// ============================================================================
// SEED UNLOCK CONDITIONS
// ============================================================================

/**
 * Seed default unlock conditions (run once on setup)
 */
export async function seedUnlockConditions(): Promise<void> {
    const supabase = await createClient()

    for (const condition of DEFAULT_UNLOCK_CONDITIONS) {
        await (supabase.from('unlock_conditions') as any)
            .upsert({
                insight_key: condition.insightKey,
                condition_type: condition.conditionType,
                threshold: condition.threshold,
                category_scoped: condition.categoryScoped,
                display_label: condition.displayLabel
            }, { onConflict: 'insight_key, condition_type' })
    }
}
