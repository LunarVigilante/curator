import { z } from 'zod'

// ============================================================================
// METRIC TYPES
// ============================================================================

export const MetricTypes = {
    NICHE_SCORE: 'niche_score',
    DIVERSITY_SCORE: 'diversity_score',
    SNOB_SCORE: 'snob_score',
    ALIGNMENT_GLOBAL: 'alignment_global',
    ALIGNMENT_EXPERTS: 'alignment_experts',
    CONSISTENCY_SCORE: 'consistency_score',
} as const

export type MetricType = typeof MetricTypes[keyof typeof MetricTypes]

// ============================================================================
// INSIGHT TYPES
// ============================================================================

export const InsightKeys = {
    SNOB_SCORE: 'snob_score',
    DEEP_ANALYSIS: 'deep_analysis',
    TASTE_EVOLUTION: 'taste_evolution',
    COMPARATIVE_FRIENDS: 'comparative_friends',
    NICHE_BREAKDOWN: 'niche_breakdown',
} as const

export type InsightKey = typeof InsightKeys[keyof typeof InsightKeys]

// ============================================================================
// UNLOCK CONDITION TYPES
// ============================================================================

export const ConditionTypes = {
    MIN_ITEMS_RATED: 'min_items_rated',
    MIN_CATEGORIES: 'min_categories',
    ACCOUNT_AGE_DAYS: 'account_age_days',
    STREAK_DAYS: 'streak_days',
    MIN_FOLLOWING: 'min_following',
} as const

export type ConditionType = typeof ConditionTypes[keyof typeof ConditionTypes]

// ============================================================================
// ZOD SCHEMAS
// ============================================================================

export const TasteMetricSchema = z.object({
    type: z.string(),
    value: z.number().min(0).max(100),
    delta: z.number().optional(), // Change since last snapshot
    percentile: z.number().min(0).max(100).optional(), // vs cohort
})

export type TasteMetric = z.infer<typeof TasteMetricSchema>

export const TasteMetricsDataSchema = z.object({
    nicheScore: TasteMetricSchema.optional(),
    diversityScore: TasteMetricSchema.optional(),
    snobScore: TasteMetricSchema.optional(),
    alignmentGlobal: TasteMetricSchema.optional(),
    alignmentExperts: TasteMetricSchema.optional(),
    consistencyScore: TasteMetricSchema.optional(),
})

export type TasteMetricsData = z.infer<typeof TasteMetricsDataSchema>

export const SnapshotMetricsSchema = z.object({
    niche_score: z.number().optional(),
    diversity_score: z.number().optional(),
    snob_score: z.number().optional(),
    alignment_global: z.number().optional(),
    totalItems: z.number(),
    topGenres: z.array(z.string()).optional(),
})

export type SnapshotMetrics = z.infer<typeof SnapshotMetricsSchema>

// ============================================================================
// UNLOCK STATUS TYPES
// ============================================================================

export type UnlockStatus = {
    unlocked: boolean
    progress?: number
    required?: number
    displayLabel?: string
    percentComplete?: number
}

export type InsightUnlockMap = {
    [key in InsightKey]?: UnlockStatus
}

// ============================================================================
// EVOLUTION TYPES
// ============================================================================

export type TasteEvolution = {
    period: string
    dataPoints: number
    changes: {
        nicheScore: number | null
        diversityScore: number | null
        alignmentGlobal: number | null
    }
    trend: 'improving' | 'stable' | 'diversifying' | 'specializing'
}

// ============================================================================
// COHORT TYPES
// ============================================================================

export const CohortTypes = {
    GLOBAL: 'global',
    EXPERTS: 'experts', // Users with 100+ items rated
    CATEGORY_EXPERTS: 'category_experts', // Users with 50+ items in specific category
} as const

export type CohortType = typeof CohortTypes[keyof typeof CohortTypes]

// ============================================================================
// TIER DISTRIBUTION
// ============================================================================

export type TierDistribution = {
    S: number
    A: number
    B: number
    C: number
    D: number
    F: number
}

export const TIERS = ['S', 'A', 'B', 'C', 'D', 'F'] as const
export type Tier = typeof TIERS[number]

// ============================================================================
// DEFAULT UNLOCK CONDITIONS
// ============================================================================

export const DEFAULT_UNLOCK_CONDITIONS = [
    {
        insightKey: InsightKeys.SNOB_SCORE,
        conditionType: ConditionTypes.MIN_ITEMS_RATED,
        threshold: 10,
        categoryScoped: true,
        displayLabel: 'Rate 10 items in this category',
    },
    {
        insightKey: InsightKeys.DEEP_ANALYSIS,
        conditionType: ConditionTypes.MIN_ITEMS_RATED,
        threshold: 25,
        categoryScoped: false,
        displayLabel: 'Rate 25 items total',
    },
    {
        insightKey: InsightKeys.TASTE_EVOLUTION,
        conditionType: ConditionTypes.ACCOUNT_AGE_DAYS,
        threshold: 30,
        categoryScoped: false,
        displayLabel: 'Be a member for 30 days',
    },
    {
        insightKey: InsightKeys.COMPARATIVE_FRIENDS,
        conditionType: ConditionTypes.MIN_FOLLOWING,
        threshold: 3,
        categoryScoped: false,
        displayLabel: 'Follow at least 3 curators',
    },
    {
        insightKey: InsightKeys.NICHE_BREAKDOWN,
        conditionType: ConditionTypes.MIN_ITEMS_RATED,
        threshold: 15,
        categoryScoped: false,
        displayLabel: 'Rate 15 items total',
    },
]
