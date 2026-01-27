/**
 * Sudo Mode Service
 * 
 * Implements re-authentication requirements for sensitive operations.
 * Users must verify their password before performing critical actions like:
 * - Profile changes
 * - Email changes
 * - Password changes
 * 
 * This protects against session hijacking and ensures the legitimate user
 * is performing the action.
 */

import { createClient } from '@/lib/supabase/server'

export interface SudoVerificationResult {
    success: boolean
    error?: string
}

/**
 * Verify the user's current password for sudo mode operations.
 * This should be called before any sensitive action.
 * 
 * @param password - The user's current password to verify
 * @returns Verification result indicating success or failure
 */
export async function verifySudoMode(password: string): Promise<SudoVerificationResult> {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
        return { success: false, error: 'Not authenticated' }
    }

    if (!user.email) {
        return { success: false, error: 'User email not found' }
    }

    // Attempt to sign in with the provided password
    // This validates the password without creating a new session
    const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password,
    })

    if (signInError) {
        // Check for specific error messages
        if (signInError.message.includes('Invalid login credentials')) {
            return { success: false, error: 'Incorrect password' }
        }
        return { success: false, error: signInError.message }
    }

    return { success: true }
}

/**
 * Change password with verification of current password (sudo mode)
 * 
 * @param currentPassword - The user's current password
 * @param newPassword - The new password to set
 * @returns Result indicating success or failure
 */
export async function changePasswordWithVerification(
    currentPassword: string,
    newPassword: string
): Promise<SudoVerificationResult> {
    // First verify the current password
    const verification = await verifySudoMode(currentPassword)

    if (!verification.success) {
        return verification
    }

    // Now update to the new password
    const supabase = await createClient()
    const { error } = await supabase.auth.updateUser({
        password: newPassword,
    })

    if (error) {
        return { success: false, error: error.message }
    }

    return { success: true }
}

/**
 * Update sensitive profile fields with password verification (sudo mode)
 * 
 * @param password - The user's current password for verification
 * @param updates - The profile fields to update
 * @returns Result indicating success or failure
 */
export async function updateProfileWithVerification(
    password: string,
    updates: {
        email?: string
        name?: string
        display_name?: string
        bio?: string
    }
): Promise<SudoVerificationResult> {
    // Verify password first
    const verification = await verifySudoMode(password)

    if (!verification.success) {
        return verification
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { success: false, error: 'Not authenticated' }
    }

    // If email is being changed, update via auth
    if (updates.email && updates.email !== user.email) {
        const { error: emailError } = await supabase.auth.updateUser({
            email: updates.email,
        })

        if (emailError) {
            return { success: false, error: emailError.message }
        }
    }

    // Update profile fields
    const profileUpdates: Record<string, any> = {}
    if (updates.name !== undefined) profileUpdates.name = updates.name
    if (updates.display_name !== undefined) profileUpdates.display_name = updates.display_name
    if (updates.bio !== undefined) profileUpdates.bio = updates.bio

    if (Object.keys(profileUpdates).length > 0) {
        profileUpdates.updated_at = new Date().toISOString()

        const { error: profileError } = await supabase
            .from('profiles')
            .update(profileUpdates)
            .eq('id', user.id)

        if (profileError) {
            return { success: false, error: profileError.message }
        }
    }

    return { success: true }
}
