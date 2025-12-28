'use server'

import { db } from '@/lib/db'
import {
    items,
    tasteMetrics,
    tasteSnapshots,
    cohortAverages,
    insightUnlocks,
    unlockConditions,
    follows,
    users
} from '@/db/schema'
import { eq, and, desc, sql, isNotNull, count } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
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
// AUTH HELPER
// ============================================================================

async function getCurrentUserId(): Promise<string | null> {
    const session = await auth.api.getSession({ headers: await headers() })
    return session?.user?.id || null
}

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
    const whereClause = categoryId
        ? and(eq(items.userId, userId), eq(items.categoryId, categoryId), isNotNull(items.tier))
        : and(eq(items.userId, userId), isNotNull(items.tier))

    const results = await db
        .select({
            tier: items.tier,
            count: sql<number>`COUNT(*)`
        })
        .from(items)
        .where(whereClause)
        .groupBy(items.tier)

    const distribution: TierDistribution = { S: 0, A: 0, B: 0, C: 0, D: 0, F: 0 }
    const total = results.reduce((sum, r) => sum + r.count, 0)

    if (total === 0) return distribution

    for (const result of results) {
        const tier = result.tier as keyof TierDistribution
        if (tier in distribution) {
            distribution[tier] = (result.count / total) * 100
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
    const userDist = await getTierDistribution(userId, categoryId)
    const userVector = distributionToVector(userDist)

    // Get pre-computed cohort average
    const cohortAvg = await db.query.cohortAverages.findFirst({
        where: and(
            eq(cohortAverages.cohortType, cohortType),
            eq(cohortAverages.metricType, 'tier_distribution'),
            categoryId
                ? eq(cohortAverages.categoryId, categoryId)
                : sql`${cohortAverages.categoryId} IS NULL`
        )
    })

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

    // Check cache
    const cached = await db.query.tasteMetrics.findMany({
        where: and(
            eq(tasteMetrics.userId, currentUserId),
            categoryId
                ? eq(tasteMetrics.categoryId, categoryId)
                : sql`${tasteMetrics.categoryId} IS NULL`
        )
    })

    const now = Date.now()
    const validCache = cached.filter(m =>
        now - m.computedAt.getTime() < maxAge
    )

    if (validCache.length >= 2) {
        // Return cached metrics
        const result: Record<string, number> = {}
        for (const metric of validCache) {
            result[metric.metricType] = metric.value
        }
        return result
    }

    // Compute fresh metrics
    const metrics = await computeUserMetrics(currentUserId, categoryId)

    // Cache them
    for (const [type, value] of Object.entries(metrics)) {
        await db.insert(tasteMetrics)
            .values({
                userId: currentUserId,
                categoryId: categoryId || null,
                metricType: type,
                value,
                computedAt: new Date()
            })
            .onConflictDoUpdate({
                target: [tasteMetrics.id],
                set: { value, computedAt: new Date() }
            })
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

    // Check if already unlocked
    const existing = await db.query.insightUnlocks.findFirst({
        where: and(
            eq(insightUnlocks.userId, userId),
            eq(insightUnlocks.insightKey, insightKey)
        )
    })

    if (existing) return { unlocked: true }

    // Get conditions for this insight
    const conditions = await db.query.unlockConditions.findMany({
        where: eq(unlockConditions.insightKey, insightKey)
    })

    // If no conditions defined, check defaults
    const effectiveConditions = conditions.length > 0
        ? conditions
        : DEFAULT_UNLOCK_CONDITIONS.filter(c => c.insightKey === insightKey)

    for (const condition of effectiveConditions) {
        const progress = await evaluateCondition(userId, condition, categoryId)

        if (progress < condition.threshold) {
            const percentComplete = Math.round((progress / condition.threshold) * 100)
            return {
                unlocked: false,
                progress,
                required: condition.threshold,
                displayLabel: condition.displayLabel,
                percentComplete
            }
        }
    }

    // All conditions met - grant unlock
    await db.insert(insightUnlocks).values({
        userId,
        insightKey,
        unlockContext: JSON.stringify({ categoryId, triggeredAt: new Date().toISOString() })
    })

    return { unlocked: true }
}

/**
 * Evaluate a single unlock condition
 */
async function evaluateCondition(
    userId: string,
    condition: { conditionType: string; threshold: number; categoryScoped?: boolean },
    categoryId?: string
): Promise<number> {
    switch (condition.conditionType) {
        case ConditionTypes.MIN_ITEMS_RATED: {
            const whereClause = condition.categoryScoped && categoryId
                ? and(eq(items.userId, userId), isNotNull(items.tier), eq(items.categoryId, categoryId))
                : and(eq(items.userId, userId), isNotNull(items.tier))

            const result = await db.select({ count: count() }).from(items).where(whereClause)
            return result[0]?.count || 0
        }

        case ConditionTypes.ACCOUNT_AGE_DAYS: {
            const user = await db.query.users.findFirst({
                where: eq(users.id, userId),
                columns: { createdAt: true }
            })
            if (!user) return 0
            const daysSinceCreation = Math.floor(
                (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)
            )
            return daysSinceCreation
        }

        case ConditionTypes.MIN_FOLLOWING: {
            const result = await db.select({ count: count() })
                .from(follows)
                .where(eq(follows.followerId, userId))
            return result[0]?.count || 0
        }

        case ConditionTypes.MIN_CATEGORIES: {
            const result = await db
                .selectDistinct({ categoryId: items.categoryId })
                .from(items)
                .where(and(eq(items.userId, userId), isNotNull(items.tier)))
            return result.length
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
    const metrics = await computeUserMetrics(userId, categoryId)
    const distribution = await getTierDistribution(userId, categoryId)

    // Get item count
    const itemCount = await db.select({ count: count() })
        .from(items)
        .where(and(
            eq(items.userId, userId),
            isNotNull(items.tier),
            categoryId ? eq(items.categoryId, categoryId) : undefined
        ))

    const snapshotMetrics: SnapshotMetrics = {
        niche_score: metrics[MetricTypes.NICHE_SCORE],
        diversity_score: metrics[MetricTypes.DIVERSITY_SCORE],
        alignment_global: metrics[MetricTypes.ALIGNMENT_GLOBAL],
        totalItems: itemCount[0]?.count || 0,
        topGenres: [], // TODO: compute from tags
    }

    await db.insert(tasteSnapshots).values({
        userId,
        categoryId: categoryId || null,
        snapshotType,
        metricsJson: JSON.stringify(snapshotMetrics),
        itemCount: snapshotMetrics.totalItems,
        topGenresJson: JSON.stringify(snapshotMetrics.topGenres),
        capturedAt: new Date()
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

    const snapshots = await db.query.tasteSnapshots.findMany({
        where: eq(tasteSnapshots.userId, userId),
        orderBy: desc(tasteSnapshots.capturedAt),
        limit: months * 5 // ~5 data points per month
    })

    if (snapshots.length < 2) return null

    const latest = JSON.parse(snapshots[0].metricsJson) as SnapshotMetrics
    const oldest = JSON.parse(snapshots[snapshots.length - 1].metricsJson) as SnapshotMetrics

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
    for (const condition of DEFAULT_UNLOCK_CONDITIONS) {
        await db.insert(unlockConditions)
            .values({
                insightKey: condition.insightKey,
                conditionType: condition.conditionType,
                threshold: condition.threshold,
                categoryScoped: condition.categoryScoped,
                displayLabel: condition.displayLabel
            })
            .onConflictDoNothing()
    }
}
