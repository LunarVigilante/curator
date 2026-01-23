'use server'

import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { getSession } from '@/lib/auth'

/**
 * Check if user has completed the onboarding tour
 */
export async function hasCompletedTour(): Promise<boolean> {
    const session = await getSession()
    if (!session?.user?.id) return true // Don't show tour for non-authenticated users

    const supabase = createServiceRoleClient()

    // Check if tour_completed is stored in activities
    const { data } = await supabase
        .from('activities')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('type', 'onboarding_tour_completed')
        .limit(1)

    return Boolean(data && data.length > 0)
}

/**
 * Mark the onboarding tour as completed
 */
export async function markTourCompleted(): Promise<boolean> {
    const session = await getSession()
    if (!session?.user?.id) {
        console.log('[OnboardingTour] No session, skipping DB write')
        return false
    }

    const supabase = createServiceRoleClient()

    // Check if already completed (prevent duplicates)
    const { data: existing } = await supabase
        .from('activities')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('type', 'onboarding_tour_completed')
        .limit(1)

    if (existing && existing.length > 0) {
        console.log('[OnboardingTour] Already marked complete in DB')
        return true
    }

    // Insert the completion record
    const { error } = await supabase.from('activities').insert({
        user_id: session.user.id,
        type: 'onboarding_tour_completed',
        data: {
            timestamp: new Date().toISOString(),
            version: '1.0'
        },
    })

    if (error) {
        console.error('[OnboardingTour] Failed to save to DB:', error.message)
        return false
    }

    console.log('[OnboardingTour] Successfully saved to DB')
    return true
}

/**
 * Reset the tour (for testing or if user wants to see it again)
 */
export async function resetTour(): Promise<void> {
    const session = await getSession()
    if (!session?.user?.id) return

    const supabase = createServiceRoleClient()

    await supabase
        .from('activities')
        .delete()
        .eq('user_id', session.user.id)
        .eq('type', 'onboarding_tour_completed')

    console.log('[OnboardingTour] Tour reset in DB')
}
