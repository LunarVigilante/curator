'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState, useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '@/lib/types/database'

interface UseUserReturn {
    user: User | null
    profile: Profile | null
    loading: boolean
    isAuthenticated: boolean
    isAdmin: boolean
    refresh: () => Promise<void>
}

/**
 * Client-side hook for accessing the current user and profile
 * Replaces the old useSession() from BetterAuth
 */
export function useUser(): UseUserReturn {
    const [user, setUser] = useState<User | null>(null)
    const [profile, setProfile] = useState<Profile | null>(null)
    const [loading, setLoading] = useState(true)
    const supabase = createClient()

    const loadUser = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            setUser(user)

            if (user) {
                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single()
                setProfile(profileData as Profile | null)
            } else {
                setProfile(null)
            }
        } catch (error) {
            console.error('Error loading user:', error)
            setUser(null)
            setProfile(null)
        } finally {
            setLoading(false)
        }
    }, [supabase])

    useEffect(() => {
        loadUser()

        // Listen for auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                    setUser(session?.user ?? null)
                    if (session?.user) {
                        const { data: profileData } = await supabase
                            .from('profiles')
                            .select('*')
                            .eq('id', session.user.id)
                            .single()
                        setProfile(profileData as Profile | null)
                    }
                } else if (event === 'SIGNED_OUT') {
                    setUser(null)
                    setProfile(null)
                }
                setLoading(false)
            }
        )

        return () => subscription.unsubscribe()
    }, [loadUser, supabase])

    return {
        user,
        profile,
        loading,
        isAuthenticated: !!user,
        isAdmin: profile?.role === 'ADMIN',
        refresh: loadUser,
    }
}
