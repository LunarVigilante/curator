import { z } from 'zod'

// =============================================================================
// TASTE REPORT 2.0 TYPES
// =============================================================================

export type CohortType = 'global' | 'experts' | 'category_experts' | 'friends'

export const AlignmentResultSchema = z.object({
    score: z.number().nullable(),
    cohortType: z.enum(['global', 'experts', 'category_experts', 'friends']),
    cohortLabel: z.string(),
    sampleSize: z.number(),
    overlappingItems: z.number(),
    message: z.string().optional(),
})

export type AlignmentResult = z.infer<typeof AlignmentResultSchema>

export const UnlockStatusSchema = z.object({
    unlocked: z.boolean(),
    unlockedAt: z.date().optional(),
    progress: z.number().optional(),
    required: z.number().optional(),
    displayLabel: z.string().optional(),
})

export type UnlockStatus = z.infer<typeof UnlockStatusSchema>

export const MetricDeltaSchema = z.object({
    current: z.number(),
    previous: z.number().nullable(),
    delta: z.number().nullable(),
    periodLabel: z.string(),
})

export type MetricDelta = z.infer<typeof MetricDeltaSchema>

export const RadarChartPayloadSchema = z.object({
    axes: z.array(z.string()),
    userScores: z.array(z.number()),
    cohortScores: z.array(z.number()),
    cohort: z.object({
        type: z.enum(['global', 'experts', 'category_experts', 'friends']),
        label: z.string(),
        sampleSize: z.number(),
    }),
    isValid: z.boolean(),
    minItemsRequired: z.number(),
    currentItemCount: z.number(),
    emptyStateMessage: z.string().optional(),
})

export type RadarChartPayload = z.infer<typeof RadarChartPayloadSchema>

// =============================================================================
// INSIGHT KEYS (for unlock gating)
// =============================================================================

export const INSIGHT_KEYS = {
    SNOB_SCORE: 'snob_score',
    DEEP_ANALYSIS: 'deep_analysis',
    TASTE_EVOLUTION: 'taste_evolution',
    RADAR_COMPARISON: 'radar_comparison',
    ALIGNMENT_GLOBAL: 'alignment_global',
    ALIGNMENT_EXPERTS: 'alignment_experts',
} as const

export type InsightKey = typeof INSIGHT_KEYS[keyof typeof INSIGHT_KEYS]

// =============================================================================
// CONDITION TYPES
// =============================================================================

export const CONDITION_TYPES = {
    MIN_ITEMS_RATED: 'min_items_rated',
    MIN_CATEGORIES: 'min_categories',
    STREAK_DAYS: 'streak_days',
    MIN_TIER_DIVERSITY: 'min_tier_diversity',
} as const

export type ConditionType = typeof CONDITION_TYPES[keyof typeof CONDITION_TYPES]

// =============================================================================
// SNAPSHOT TYPES
// =============================================================================

export const SNAPSHOT_TYPES = {
    WEEKLY: 'weekly',
    MONTHLY: 'monthly',
    MILESTONE: 'milestone',
} as const

export type SnapshotType = typeof SNAPSHOT_TYPES[keyof typeof SNAPSHOT_TYPES]
