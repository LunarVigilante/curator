

import { db } from '@/lib/db'
import { items, ratings, categories, tasteMetrics, tasteSnapshots, cohortAverages, insightUnlocks, unlockConditions, globalItems } from '@/db/schema'
import { eq, and, sql, desc, count, avg, isNotNull } from 'drizzle-orm'

// =============================================================================
// TYPES
// =============================================================================

export type CohortType = 'global' | 'experts' | 'category_experts'

export interface AlignmentResult {
    score: number | null
    cohortType: CohortType
    cohortLabel: string
    sampleSize: number
    overlappingItems: number
    message?: string
}

export interface UnlockStatus {
    unlocked: boolean
    unlockedAt?: Date
    progress?: number
    required?: number
    displayLabel?: string
}

export interface MetricDelta {
    current: number
    previous: number | null
    delta: number | null
    periodLabel: string
}

export interface RadarChartPayload {
    axes: string[]
    userScores: number[]
    cohortScores: number[]
    cohort: {
        type: CohortType
        label: string
        sampleSize: number
    }
    isValid: boolean
    minItemsRequired: number
    currentItemCount: number
    emptyStateMessage?: string
}

// =============================================================================
// CONSTANTS
// =============================================================================

const MIN_OVERLAP_FOR_ALIGNMENT = 3
const MIN_ITEMS_FOR_RADAR = 5
const EXPERT_THRESHOLD = 50 // Users with 50+ ratings are "experts"

const TIER_TO_NUMERIC: Record<string, number> = {
    'S': 100,
    'A': 80,
    'B': 60,
    'C': 40,
    'D': 20,
}

const CATEGORY_AXES: Record<string, string[]> = {
    'Horror': ['Gore', 'Psychological', 'Atmosphere', 'Jump Scares', 'Plot Complexity'],
    'Anime': ['Action', 'Drama', 'Comedy', 'Romance', 'Animation Quality'],
    'Video Games': ['Gameplay', 'Story', 'Graphics', 'Replayability', 'Difficulty'],
    'Movies': ['Cinematography', 'Acting', 'Plot', 'Emotional Impact', 'Rewatchability'],
    'TV Shows': ['Characters', 'Plot', 'Production', 'Binge-worthiness', 'Originality'],
    'Books': ['Writing Style', 'Plot', 'Characters', 'Themes', 'Pacing'],
    'Music': ['Melody', 'Lyrics', 'Production', 'Emotion', 'Originality'],
    'default': ['Quality', 'Originality', 'Emotional Impact', 'Pacing', 'Rewatchability'],
}

const COHORT_LABELS: Record<CohortType, string> = {
    'global': 'Global Average',
    'experts': 'Expert Critics',
    'category_experts': 'Category Experts',
}

// =============================================================================
// ALIGNMENT SCORE CALCULATION
// =============================================================================

/**
 * Calculate alignment score between a user and a cohort (0-100%)
 * Higher score = user's taste aligns more closely with the cohort
 */
export async function calculateAlignmentScore(
    userId: string,
    cohortType: CohortType = 'global',
    categoryId?: string
): Promise<AlignmentResult> {
    // 1. Get user's ratings (globalItemId -> tier)
    const userRatings = await db
        .select({
            globalItemId: items.globalItemId,
            tier: ratings.tier,
        })
        .from(ratings)
        .innerJoin(items, eq(ratings.itemId, items.id))
        .where(
            categoryId
                ? and(eq(ratings.userId, userId), eq(items.categoryId, categoryId), isNotNull(items.globalItemId))
                : and(eq(ratings.userId, userId), isNotNull(items.globalItemId))
        )

    if (userRatings.length < MIN_OVERLAP_FOR_ALIGNMENT) {
        return {
            score: null,
            cohortType,
            cohortLabel: COHORT_LABELS[cohortType],
            sampleSize: 0,
            overlappingItems: userRatings.length,
            message: `Rate ${MIN_OVERLAP_FOR_ALIGNMENT - userRatings.length} more items to calculate alignment`,
        }
    }

    // 2. Get cohort averages for these items
    const globalItemIds = userRatings.map(r => r.globalItemId).filter(Boolean) as string[]

    // Build cohort query based on type
    let cohortQuery = db
        .select({
            globalItemId: items.globalItemId,
            avgScore: avg(sql`CASE 
                WHEN ${ratings.tier} = 'S' THEN 100 
                WHEN ${ratings.tier} = 'A' THEN 80 
                WHEN ${ratings.tier} = 'B' THEN 60 
                WHEN ${ratings.tier} = 'C' THEN 40 
                WHEN ${ratings.tier} = 'D' THEN 20 
                ELSE 50 
            END`).as('avgScore'),
            raterCount: count(ratings.id).as('raterCount'),
        })
        .from(ratings)
        .innerJoin(items, eq(ratings.itemId, items.id))
        .where(and(
            sql`${items.globalItemId} IN (${sql.join(globalItemIds.map(id => sql`${id}`), sql`, `)})`,
            sql`${ratings.userId} != ${userId}` // Exclude self
        ))
        .groupBy(items.globalItemId)

    const cohortAveragesResult = await cohortQuery

    // 3. Calculate alignment
    const cohortMap = new Map(cohortAveragesResult.map(c => [c.globalItemId, Number(c.avgScore)]))

    let totalDelta = 0
    let overlappingCount = 0

    for (const userRating of userRatings) {
        if (!userRating.globalItemId || !userRating.tier) continue
        const cohortAvg = cohortMap.get(userRating.globalItemId)
        if (cohortAvg !== undefined) {
            const userScore = TIER_TO_NUMERIC[userRating.tier] ?? 50
            totalDelta += Math.abs(userScore - cohortAvg)
            overlappingCount++
        }
    }

    if (overlappingCount < MIN_OVERLAP_FOR_ALIGNMENT) {
        return {
            score: null,
            cohortType,
            cohortLabel: COHORT_LABELS[cohortType],
            sampleSize: cohortAveragesResult.length,
            overlappingItems: overlappingCount,
            message: `Not enough overlapping items with other users`,
        }
    }

    const maxPossibleDelta = overlappingCount * 100
    const alignmentPercent = Math.round(100 - (totalDelta / maxPossibleDelta * 100))

    // 4. Cache result in tasteMetrics
    const metricKey = categoryId ? `alignment_${cohortType}_${categoryId}` : `alignment_${cohortType}`
    await db.insert(tasteMetrics)
        .values({
            userId,
            categoryId: categoryId || null,
            metricType: metricKey,
            value: alignmentPercent,
        })
        .onConflictDoUpdate({
            target: [tasteMetrics.userId, tasteMetrics.metricType],
            set: { value: alignmentPercent, computedAt: new Date() },
        })
        .catch(() => {
            // Ignore conflict errors (unique constraint)
        })

    return {
        score: alignmentPercent,
        cohortType,
        cohortLabel: COHORT_LABELS[cohortType],
        sampleSize: cohortAveragesResult.reduce((sum, c) => sum + Number(c.raterCount), 0),
        overlappingItems: overlappingCount,
    }
}

// =============================================================================
// TEMPORAL SNAPSHOTS
// =============================================================================

/**
 * Get the delta for a specific metric compared to a previous snapshot
 */
export async function getMetricDelta(
    userId: string,
    metricType: string,
    period: 'week' | 'month' = 'month'
): Promise<MetricDelta | null> {
    const snapshots = await db.query.tasteSnapshots.findMany({
        where: eq(tasteSnapshots.userId, userId),
        orderBy: desc(tasteSnapshots.capturedAt),
        limit: 5,
    })

    if (snapshots.length < 2) {
        return null
    }

    const current = snapshots[0]
    const previous = snapshots[1]

    try {
        const currentMetrics = JSON.parse(current.metricsJson)
        const previousMetrics = JSON.parse(previous.metricsJson)

        const currentValue = currentMetrics[metricType]
        const previousValue = previousMetrics[metricType]

        if (currentValue === undefined) return null

        return {
            current: currentValue,
            previous: previousValue ?? null,
            delta: previousValue !== undefined ? currentValue - previousValue : null,
            periodLabel: period === 'week' ? 'this week' : 'this month',
        }
    } catch {
        return null
    }
}

/**
 * Capture a new snapshot of the user's current taste metrics
 */
export async function captureSnapshot(
    userId: string,
    snapshotType: 'weekly' | 'monthly' | 'milestone' = 'weekly'
): Promise<void> {
    // Get all current metrics
    const metrics = await db.query.tasteMetrics.findMany({
        where: eq(tasteMetrics.userId, userId),
    })

    const metricsJson: Record<string, number> = {}
    for (const m of metrics) {
        metricsJson[m.metricType] = m.value
    }

    // Count items
    const itemCountResult = await db
        .select({ count: count() })
        .from(items)
        .where(eq(items.userId, userId))

    const itemCount = itemCountResult[0]?.count ?? 0

    // Get top genres (from categories)
    const userCategories = await db.query.categories.findMany({
        where: eq(categories.userId, userId),
        limit: 5,
    })
    const topGenres = userCategories.map(c => c.name)

    await db.insert(tasteSnapshots).values({
        userId,
        snapshotType,
        metricsJson: JSON.stringify(metricsJson),
        itemCount,
        topGenresJson: JSON.stringify(topGenres),
    })
}

// =============================================================================
// UNLOCK GATING
// =============================================================================

/**
 * Check if a user has unlocked a specific insight
 */
export async function checkUnlockStatus(
    userId: string,
    insightKey: string
): Promise<UnlockStatus> {
    // 1. Check if already unlocked
    const existing = await db.query.insightUnlocks.findFirst({
        where: and(
            eq(insightUnlocks.userId, userId),
            eq(insightUnlocks.insightKey, insightKey)
        ),
    })

    if (existing) {
        return { unlocked: true, unlockedAt: existing.unlockedAt }
    }

    // 2. Get condition requirements
    const condition = await db.query.unlockConditions.findFirst({
        where: eq(unlockConditions.insightKey, insightKey),
    })

    if (!condition) {
        // No condition defined = always unlocked
        return { unlocked: true }
    }

    // 3. Evaluate condition
    let progress = 0

    switch (condition.conditionType) {
        case 'min_items_rated': {
            const result = await db
                .select({ count: count() })
                .from(ratings)
                .where(eq(ratings.userId, userId))
            progress = result[0]?.count ?? 0
            break
        }
        case 'min_categories': {
            const result = await db
                .select({ count: count() })
                .from(categories)
                .where(eq(categories.userId, userId))
            progress = result[0]?.count ?? 0
            break
        }
        default:
            progress = 0
    }

    // 4. If met, record unlock
    if (progress >= condition.threshold) {
        await db.insert(insightUnlocks).values({
            userId,
            insightKey,
            unlockContext: JSON.stringify({ triggered_by: condition.conditionType }),
        })
        return { unlocked: true, unlockedAt: new Date() }
    }

    return {
        unlocked: false,
        progress,
        required: condition.threshold,
        displayLabel: condition.displayLabel,
    }
}

// =============================================================================
// RADAR CHART DATA
// =============================================================================

/**
 * Build radar chart payload for a user vs cohort comparison
 */
export async function buildRadarChartPayload(
    userId: string,
    categoryId?: string,
    cohortType: CohortType = 'global'
): Promise<RadarChartPayload> {
    // 1. Get user's items in this category
    const userItems = await db
        .select({
            id: items.id,
            tier: items.tier,
            globalItemId: items.globalItemId,
        })
        .from(items)
        .where(
            categoryId
                ? and(eq(items.userId, userId), eq(items.categoryId, categoryId))
                : eq(items.userId, userId)
        )

    // 2. Determine category type for axes
    let categoryType = 'default'
    if (categoryId) {
        const cat = await db.query.categories.findFirst({
            where: eq(categories.id, categoryId),
        })
        if (cat?.name) {
            // Try to match category name to known types
            for (const key of Object.keys(CATEGORY_AXES)) {
                if (cat.name.toLowerCase().includes(key.toLowerCase())) {
                    categoryType = key
                    break
                }
            }
        }
    }

    const axes = CATEGORY_AXES[categoryType] || CATEGORY_AXES['default']

    // 3. Check if enough items
    if (userItems.length < MIN_ITEMS_FOR_RADAR) {
        return {
            axes,
            userScores: [],
            cohortScores: [],
            cohort: { type: cohortType, label: COHORT_LABELS[cohortType], sampleSize: 0 },
            isValid: false,
            minItemsRequired: MIN_ITEMS_FOR_RADAR,
            currentItemCount: userItems.length,
            emptyStateMessage: `Rate ${MIN_ITEMS_FOR_RADAR - userItems.length} more items to unlock your taste profile`,
        }
    }

    // 4. Generate synthetic scores based on tier distribution
    // For now, we generate scores based on the user's tier patterns
    const tierCounts: Record<string, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 }
    for (const item of userItems) {
        if (item.tier && tierCounts[item.tier] !== undefined) {
            tierCounts[item.tier]++
        }
    }

    // Generate user scores (placeholder - would be derived from tags in full implementation)
    const userScores = axes.map((_, i) => {
        // Create varied scores based on tier distribution with some randomization
        const baseScore = (tierCounts['S'] * 100 + tierCounts['A'] * 80 + tierCounts['B'] * 60 + tierCounts['C'] * 40 + tierCounts['D'] * 20) / userItems.length
        const variance = (i * 17) % 30 - 15 // Deterministic variance per axis
        return Math.max(10, Math.min(100, Math.round(baseScore + variance)))
    })

    // 5. Get cohort averages (placeholder - would query cohortAverages table)
    const cohortScores = axes.map(() => 50) // Default to 50 for global average

    return {
        axes,
        userScores,
        cohortScores,
        cohort: {
            type: cohortType,
            label: COHORT_LABELS[cohortType],
            sampleSize: 100, // Placeholder
        },
        isValid: true,
        minItemsRequired: MIN_ITEMS_FOR_RADAR,
        currentItemCount: userItems.length,
    }
}

// =============================================================================
// UTILITY: Seed Default Unlock Conditions
// =============================================================================

export const DEFAULT_UNLOCK_CONDITIONS = [
    { insightKey: 'snob_score', conditionType: 'min_items_rated', threshold: 10, displayLabel: 'Rate 10 items to unlock', categoryScoped: false },
    { insightKey: 'deep_analysis', conditionType: 'min_items_rated', threshold: 5, displayLabel: 'Rate 5 items to unlock', categoryScoped: false },
    { insightKey: 'taste_evolution', conditionType: 'min_items_rated', threshold: 20, displayLabel: 'Rate 20 items to unlock', categoryScoped: false },
    { insightKey: 'radar_comparison', conditionType: 'min_items_rated', threshold: 8, displayLabel: 'Rate 8 items to unlock', categoryScoped: false },
    { insightKey: 'alignment_global', conditionType: 'min_items_rated', threshold: 5, displayLabel: 'Rate 5 items to unlock', categoryScoped: false },
    { insightKey: 'alignment_experts', conditionType: 'min_items_rated', threshold: 15, displayLabel: 'Rate 15 items to unlock', categoryScoped: false },
]
