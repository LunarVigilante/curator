/**
 * Supabase Auth Helper
 * 
 * This module provides authentication helpers for Supabase Auth.
 * 
 * ## Auth Pattern Conventions
 * 
 * The project uses two authentication functions for different scenarios:
 * 
 * ### `getSession()` (this module)
 * Use when you need the **full user session with profile data**:
 * - Admin routes and administrative actions
 * - Social features (comments, reactions, follows)
 * - Profile-dependent logic (display name, bio, role checks)
 * - Activity logging that requires user identity
 * 
 * ### `getGuestUserId()` (from `@/lib/actions/auth`)
 * Use when you **only need the user ID** for ownership/filtering:
 * - Fetching user's own items, categories, ratings
 * - Ownership verification before mutations
 * - Features that support both authenticated and anonymous users
 * - Performance-critical paths (avoids extra profile fetch)
 * 
 * @example
 * // Full auth required
 * const session = await getSession()
 * if (!session) throw new Error('Authentication required')
 * const { user, profile } = session
 * 
 * @example
 * // Ownership check only
 * const userId = await getGuestUserId()
 * if (!userId) throw new Error('Unauthorized')
 * // ... filter by user_id
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
 * 
 * **Use this for actions requiring full authentication:**
 * - Admin routes and role-based access control
 * - Social features (comments, reactions, activity feeds)
 * - Profile-dependent actions (display name, settings, bio)
 * - Any action that needs `profile.role` or other profile fields
 * 
 * @returns The session object with user and profile, or null if not authenticated.
 * @see getGuestUserId in `@/lib/actions/auth` for lightweight ownership checks
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
