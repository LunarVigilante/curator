import { createClient } from '@/lib/supabase/server';

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
    const supabase = await createClient();

    // 1. Get user's ratings (globalItemId -> tier)
    let query = supabase
        .from('ratings')
        .select(`
            tier,
            items!inner(global_item_id, category_id)
        `)
        .eq('user_id', userId)
        .not('items.global_item_id', 'is', null);

    if (categoryId) {
        query = query.eq('items.category_id', categoryId);
    }

    const { data: userRatings } = await query;

    if (!userRatings || userRatings.length < MIN_OVERLAP_FOR_ALIGNMENT) {
        return {
            score: null,
            cohortType,
            cohortLabel: COHORT_LABELS[cohortType],
            sampleSize: 0,
            overlappingItems: userRatings?.length || 0,
            message: `Rate ${MIN_OVERLAP_FOR_ALIGNMENT - (userRatings?.length || 0)} more items to calculate alignment`,
        }
    }

    // Extract global item IDs
    const globalItemIds = (userRatings as any[])
        .map(r => (r.items as any)?.global_item_id)
        .filter(Boolean) as string[];

    if (globalItemIds.length === 0) {
        return {
            score: null,
            cohortType,
            cohortLabel: COHORT_LABELS[cohortType],
            sampleSize: 0,
            overlappingItems: 0,
            message: 'No overlapping items with other users',
        }
    }

    // 2. Get cohort averages - fetch all ratings for these items from other users
    const { data: cohortRatings } = await supabase
        .from('ratings')
        .select(`
            tier,
            items!inner(global_item_id)
        `)
        .neq('user_id', userId)
        .in('items.global_item_id', globalItemIds);

    // Build cohort averages map
    const cohortMap = new Map<string, { total: number; count: number }>();
    for (const rating of (cohortRatings as any[]) || []) {
        const globalId = (rating.items as any)?.global_item_id;
        const tier = rating.tier;
        if (!globalId || !tier) continue;

        const numericScore = TIER_TO_NUMERIC[tier] ?? 50;
        const existing = cohortMap.get(globalId) || { total: 0, count: 0 };
        existing.total += numericScore;
        existing.count++;
        cohortMap.set(globalId, existing);
    }

    // Calculate averages
    const cohortAverages = new Map<string, number>();
    for (const [id, { total, count }] of cohortMap) {
        cohortAverages.set(id, total / count);
    }

    // 3. Calculate alignment
    let totalDelta = 0;
    let overlappingCount = 0;

    for (const userRating of (userRatings as any[]) || []) {
        const globalId = (userRating.items as any)?.global_item_id;
        const tier = userRating.tier;
        if (!globalId || !tier) continue;

        const cohortAvg = cohortAverages.get(globalId);
        if (cohortAvg !== undefined) {
            const userScore = TIER_TO_NUMERIC[tier] ?? 50;
            totalDelta += Math.abs(userScore - cohortAvg);
            overlappingCount++;
        }
    }

    if (overlappingCount < MIN_OVERLAP_FOR_ALIGNMENT) {
        return {
            score: null,
            cohortType,
            cohortLabel: COHORT_LABELS[cohortType],
            sampleSize: cohortRatings?.length || 0,
            overlappingItems: overlappingCount,
            message: 'Not enough overlapping items with other users',
        }
    }

    const maxPossibleDelta = overlappingCount * 100;
    const alignmentPercent = Math.round(100 - (totalDelta / maxPossibleDelta * 100));

    // 4. Cache result in taste_metrics
    const metricKey = categoryId ? `alignment_${cohortType}_${categoryId}` : `alignment_${cohortType}`;
    await (supabase
        .from('taste_metrics') as any)
        .upsert({
            user_id: userId,
            category_id: categoryId || null,
            metric_type: metricKey,
            value: alignmentPercent,
            computed_at: new Date().toISOString(),
        }, { onConflict: 'user_id,metric_type' })
        .then(() => { })
        .catch(() => { });

    return {
        score: alignmentPercent,
        cohortType,
        cohortLabel: COHORT_LABELS[cohortType],
        sampleSize: cohortRatings?.length || 0,
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
    const supabase = await createClient();

    const { data: snapshots } = await (supabase
        .from('taste_snapshots') as any)
        .select('*')
        .eq('user_id', userId)
        .order('captured_at', { ascending: false })
        .limit(5);

    if (!snapshots || snapshots.length < 2) {
        return null
    }

    const current = snapshots[0]
    const previous = snapshots[1]

    try {
        const currentMetrics = JSON.parse(current.metrics_json)
        const previousMetrics = JSON.parse(previous.metrics_json)

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
    const supabase = await createClient();

    // Get all current metrics
    const { data: metrics } = await (supabase
        .from('taste_metrics') as any)
        .select('*')
        .eq('user_id', userId);

    const metricsJson: Record<string, number> = {}
    for (const m of metrics || []) {
        metricsJson[m.metric_type] = m.value
    }

    // Count items
    const { count: itemCount } = await supabase
        .from('items')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

    // Get top genres (from categories)
    const { data: userCategories } = await (supabase
        .from('categories') as any)
        .select('name')
        .eq('user_id', userId)
        .limit(5);

    const topGenres = (userCategories || []).map((c: any) => c.name)

    await (supabase.from('taste_snapshots') as any).insert({
        user_id: userId,
        snapshot_type: snapshotType,
        metrics_json: JSON.stringify(metricsJson),
        item_count: itemCount || 0,
        top_genres_json: JSON.stringify(topGenres),
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
    const supabase = await createClient();

    // 1. Check if already unlocked
    const { data: existing } = await supabase
        .from('insight_unlocks')
        .select('*')
        .eq('user_id', userId)
        .eq('insight_key', insightKey)
        .single();

    const existingRec = existing as any;

    if (existingRec) {
        return { unlocked: true, unlockedAt: new Date(existingRec.unlocked_at) }
    }

    // 2. Get condition requirements
    const { data: condition } = await supabase
        .from('unlock_conditions')
        .select('*')
        .eq('insight_key', insightKey)
        .single();

    const cond = condition as any;

    if (!cond) {
        // No condition defined = always unlocked
        return { unlocked: true }
    }

    // 3. Evaluate condition
    let progress = 0

    switch (cond.condition_type) {
        case 'min_items_rated': {
            const { count } = await supabase
                .from('ratings')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId);
            progress = count || 0;
            break;
        }
        case 'min_categories': {
            const { count } = await supabase
                .from('categories')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId);
            progress = count || 0;
            break;
        }
        default:
            progress = 0
    }

    // 4. If met, record unlock
    if (progress >= cond.threshold) {
        await (supabase.from('insight_unlocks') as any).insert({
            user_id: userId,
            insight_key: insightKey,
            unlock_context: JSON.stringify({ triggered_by: cond.condition_type }),
        })
        return { unlocked: true, unlockedAt: new Date() }
    }

    return {
        unlocked: false,
        progress,
        required: cond.threshold,
        displayLabel: cond.display_label,
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
    const supabase = await createClient();

    // 1. Get user's items in this category
    let query = supabase
        .from('items')
        .select('id, tier, global_item_id')
        .eq('user_id', userId);

    if (categoryId) {
        query = query.eq('category_id', categoryId);
    }

    const { data: userItems } = await (query as any);

    // 2. Determine category type for axes
    let categoryType = 'default'
    if (categoryId) {
        const { data: cat } = await (supabase
            .from('categories') as any)
            .select('name')
            .eq('id', categoryId)
            .single();

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
    if (!userItems || userItems.length < MIN_ITEMS_FOR_RADAR) {
        return {
            axes,
            userScores: [],
            cohortScores: [],
            cohort: { type: cohortType, label: COHORT_LABELS[cohortType], sampleSize: 0 },
            isValid: false,
            minItemsRequired: MIN_ITEMS_FOR_RADAR,
            currentItemCount: userItems?.length || 0,
            emptyStateMessage: `Rate ${MIN_ITEMS_FOR_RADAR - (userItems?.length || 0)} more items to unlock your taste profile`,
        }
    }

    // 4. Generate synthetic scores based on tier distribution
    const tierCounts: Record<string, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 }
    for (const item of (userItems as any[]) || []) {
        if (item.tier && tierCounts[item.tier] !== undefined) {
            tierCounts[item.tier]++
        }
    }

    // Generate user scores
    const userScores = axes.map((_, i) => {
        const baseScore = (tierCounts['S'] * 100 + tierCounts['A'] * 80 + tierCounts['B'] * 60 + tierCounts['C'] * 40 + tierCounts['D'] * 20) / userItems.length
        const variance = (i * 17) % 30 - 15
        return Math.max(10, Math.min(100, Math.round(baseScore + variance)))
    })

    // 5. Get cohort averages (placeholder)
    const cohortScores = axes.map(() => 50)

    return {
        axes,
        userScores,
        cohortScores,
        cohort: {
            type: cohortType,
            label: COHORT_LABELS[cohortType],
            sampleSize: 100,
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
