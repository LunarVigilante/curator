'use server'

import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'

// =============================================================================
// TYPES
// =============================================================================

export interface ChecklistItem {
    id: string
    title: string
    description: string
    completed: boolean
    progress?: number
    required?: number
    href?: string
}

export interface ChecklistStatus {
    items: ChecklistItem[]
    completedCount: number
    totalCount: number
    percentComplete: number
    allComplete: boolean
}

// =============================================================================
// CHECKLIST ITEMS CONFIGURATION
// =============================================================================

const CHECKLIST_CONFIG = [
    {
        id: 'create_collection',
        title: 'Create your first collection',
        description: 'Start organizing by creating a category',
        href: '/categories/new',
    },
    {
        id: 'add_items',
        title: 'Add 5 items',
        description: 'Add items to your collection',
        required: 5,
        href: '/items/new',
    },
    {
        id: 'face_off',
        title: 'Complete a Face-Off',
        description: 'Rank items in a head-to-head tournament',
        href: '/tournament',
    },
    {
        id: 'rate_items',
        title: 'Rate 10 items',
        description: 'Unlock your Snob Score',
        required: 10,
    },
    {
        id: 'taste_profile',
        title: 'View your Taste Profile',
        description: 'Discover your unique taste patterns',
        // href is set dynamically based on user ID
    },
] as const

// =============================================================================
// SERVER ACTION
// =============================================================================

export async function getChecklistStatus(): Promise<ChecklistStatus> {
    const session = await getSession()

    if (!session?.user?.id) {
        // Return empty checklist for unauthenticated users
        const items = CHECKLIST_CONFIG.map(config => ({
            ...config,
            completed: false,
            progress: 0,
        }))
        return {
            items,
            completedCount: 0,
            totalCount: items.length,
            percentComplete: 0,
            allComplete: false,
        }
    }

    const supabase = await createClient()
    const userId = session.user.id

    // Fetch counts in parallel
    const [categoriesResult, itemsResult, faceOffsResult, ratingsResult, profileViewResult] = await Promise.all([
        // Count categories
        supabase
            .from('categories')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId),

        // Count items
        supabase
            .from('items')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId),

        // Count face-off matches (items with non-default ELO)
        (supabase.from('items') as any)
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .neq('elo_score', 1200),

        // Count ratings - directly on items with tier set
        supabase
            .from('items')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .not('tier', 'is', null),

        // Check if user has viewed stats (activity log)
        (supabase.from('activities') as any)
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('type', 'profile_view')
            .limit(1),
    ])

    const categoryCount = categoriesResult.count || 0
    const itemCount = itemsResult.count || 0
    const faceOffCount = faceOffsResult.count || 0
    const ratingCount = ratingsResult.count || 0
    const hasViewedProfile = (profileViewResult.count || 0) > 0

    // Build checklist items with completion status
    const items: ChecklistItem[] = [
        {
            id: 'create_collection',
            title: 'Create your first collection',
            description: 'Start organizing by creating a category',
            completed: categoryCount >= 1,
            href: '/categories/new',
        },
        {
            id: 'add_items',
            title: 'Add 5 items',
            description: 'Add items to your collection',
            completed: itemCount >= 5,
            progress: Math.min(itemCount, 5),
            required: 5,
            href: '/items/new',
        },
        {
            id: 'face_off',
            title: 'Complete a Face-Off',
            description: 'Rank items in a head-to-head tournament',
            completed: faceOffCount >= 1,
            href: '/tournament',
        },
        {
            id: 'rate_items',
            title: 'Rate 10 items',
            description: 'Unlock your Snob Score',
            completed: ratingCount >= 10,
            progress: Math.min(ratingCount, 10),
            required: 10,
        },
        {
            id: 'taste_profile',
            title: 'View your Taste Profile',
            description: 'Discover your unique taste patterns',
            completed: hasViewedProfile,
            href: `/profile/${userId}`,
        },
    ]

    const completedCount = items.filter(i => i.completed).length

    return {
        items,
        completedCount,
        totalCount: items.length,
        percentComplete: Math.round((completedCount / items.length) * 100),
        allComplete: completedCount === items.length,
    }
}

/**
 * Mark an activity as completed (e.g., viewing taste profile)
 */
export async function markChecklistActivity(activityType: string): Promise<void> {
    const session = await getSession()
    if (!session?.user?.id) return

    const supabase = await createClient()

    await (supabase.from('activities') as any).insert({
        user_id: session.user.id,
        type: activityType,
        data: { timestamp: new Date().toISOString() },
    })
}

/**
 * Get user categories with item counts for checklist navigation
 */
export async function getUserCategoriesForChecklist(): Promise<{
    id: string
    name: string
    image: string | null
    itemCount: number
}[]> {
    const session = await getSession()
    if (!session?.user?.id) return []

    const supabase = await createClient()

    const { data, error } = await (supabase.from('categories') as any)
        .select('id, name, image, items(id)')
        .eq('user_id', session.user.id)
        .order('sort_order', { ascending: true })

    if (error) {
        console.error('Failed to fetch categories for checklist:', error)
        return []
    }

    return (data || []).map((cat: { id: string; name: string; image: string | null; items?: { id: string }[] }) => ({
        id: cat.id,
        name: cat.name,
        image: cat.image,
        itemCount: cat.items?.length || 0
    }))
}

