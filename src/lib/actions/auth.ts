'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

/**
 * Sign in with email and password
 */
export async function signIn(formData: FormData) {
    const supabase = await createClient()

    const email = formData.get('email') as string
    const password = formData.get('password') as string

    const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
    })

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/', 'layout')
    redirect('/')
}

/**
 * Sign up with email and password (invite-only)
 */
export async function register(prevState: any, formData: FormData) {
    const supabase = await createClient()

    const name = formData.get('username') as string
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const inviteCode = formData.get('inviteCode') as string

    if (!email || !password || !name || !inviteCode) {
        return { message: 'All fields are required' }
    }

    try {
        // 1. Validate Invite - check use_count < max_uses
        const { data: invite, error: inviteError } = await (supabase.from('invites') as any)
            .select('*')
            .eq('code', inviteCode)
            .single()

        if (inviteError || !invite) {
            return { errors: { inviteCode: 'Invalid invite code' } }
        }

        // Check if invite still has uses remaining
        const useCount = invite.use_count || 0
        const maxUses = invite.max_uses || 1
        if (useCount >= maxUses) {
            return { errors: { inviteCode: 'This invite code has reached its usage limit' } }
        }

        // 2. Create User
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    name,
                },
            },
        })

        if (signUpError || !authData.user) {
            return { message: signUpError?.message || 'Failed to create user' }
        }

        // 3. Consume Invite - increment use_count and set is_used if exhausted
        const newUseCount = useCount + 1
        await (supabase.from('invites') as any)
            .update({
                use_count: newUseCount,
                is_used: newUseCount >= maxUses,
                used_by: authData.user.id,
                used_at: new Date().toISOString(),
            })
            .eq('id', invite.id)

    } catch (error: any) {
        console.error('Registration error:', error)
        return { message: error.message || 'Something went wrong during registration' }
    }

    redirect('/login?registered=true')
}

/**
 * Sign out the current user
 */
export async function signOut() {
    const supabase = await createClient()
    await supabase.auth.signOut()
    revalidatePath('/', 'layout')
    redirect('/login')
}

/**
 * Get the current user ID (for backwards compatibility)
 */
export async function getGuestUserId() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    return user?.id
}

/**
 * Marks the user's password change as complete (no-op for Supabase)
 * Kept for backwards compatibility
 */
export async function completeForcePasswordChange() {
    // Supabase handles password change completion automatically
    return { success: true }
}

/**
 * Update user password
 */
export async function updatePassword(formData: FormData) {
    const supabase = await createClient()

    const password = formData.get('password') as string

    const { error } = await supabase.auth.updateUser({
        password,
    })

    if (error) {
        return { error: error.message }
    }

    return { success: true }
}

/**
 * Request password reset email
 */
export async function resetPassword(formData: FormData) {
    const supabase = await createClient()

    const email = formData.get('email') as string

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/change-password`,
    })

    if (error) {
        return { error: error.message }
    }

    return { success: true, message: 'Check your email for a password reset link' }
}

/**
 * Update user profile
 */
export async function updateProfile(formData: FormData) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return { error: 'Not authenticated' }
    }

    const name = formData.get('name') as string
    const displayName = formData.get('displayName') as string
    const bio = formData.get('bio') as string

    const { error } = await (supabase.from('profiles') as any)
        .update({
            name,
            display_name: displayName,
            bio,
            updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/settings')
    return { success: true }
}

/**
 * Sign in with OAuth provider
 */
export async function signInWithProvider(provider: 'google' | 'github' | 'discord') {
    const supabase = await createClient()

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
            redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
        },
    })

    if (error) {
        return { error: error.message }
    }

    if (data.url) {
        redirect(data.url)
    }
}
