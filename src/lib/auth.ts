/**
 * Supabase Auth Helper
 * 
 * This module provides authentication helpers for Supabase Auth.
 * It replaces the previous BetterAuth implementation.
 */

import { createClient } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '@/lib/types/database'

export interface AuthSession {
    user: User
    profile: Profile | null
}

/**
 * Get the current authenticated user and their profile.
 * Use this for actions requiring full authentication (admin, social features, sensitive data).
 * 
 * @returns The session object with user and profile, or null if not authenticated.
 */
export async function getSession(): Promise<AuthSession | null> {
    const supabase = await createClient()

    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
        return null
    }

    // Fetch the user's profile
    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

    return {
        user,
        profile: profile as Profile | null
    }
}

/**
 * Get the current user ID (shorthand)
 */
export async function getCurrentUserId(): Promise<string | null> {
    const session = await getSession()
    return session?.user?.id ?? null
}

/**
 * Check if current user is an admin
 */
export async function isAdmin(): Promise<boolean> {
    const session = await getSession()
    return session?.profile?.role === 'ADMIN'
}

/**
 * Require authentication - throws if not authenticated
 */
export async function requireAuth(): Promise<AuthSession> {
    const session = await getSession()
    if (!session) {
        throw new Error('Authentication required')
    }
    return session
}

/**
 * Require admin role - throws if not admin
 */
export async function requireAdmin(): Promise<AuthSession> {
    const session = await requireAuth()
    if (session.profile?.role !== 'ADMIN') {
        throw new Error('Admin access required')
    }
    return session
}
