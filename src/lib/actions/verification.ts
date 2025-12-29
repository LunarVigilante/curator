'use server'

import { createClient } from '@/lib/supabase/server'
import { getSession, getCurrentUserId } from '@/lib/auth'

/**
 * Generate a 6-digit verification code
 */
export async function generateVerificationCode(): Promise<string> {
    return Math.floor(100000 + Math.random() * 900000).toString()
}

/**
 * Verify email using 6-digit code
 * Note: With Supabase Auth, email verification is handled via magic links.
 * This function is kept for compatibility but may need adjustment.
 */
export async function verifyEmailByCode(
    prevState: { success?: boolean; error?: string } | undefined,
    formData: FormData
): Promise<{ success?: boolean; error?: string }> {
    const code = formData.get('code') as string

    if (!code || code.length !== 6) {
        return { error: 'Please enter a valid 6-digit code' }
    }

    const session = await getSession()
    if (!session?.user?.email) {
        return { error: 'You must be logged in to verify your email' }
    }

    const supabase = await createClient()

    try {
        // Find verification record with matching code
        const { data: verification, error } = await supabase
            .from('verifications')
            .select('*')
            .eq('identifier', session.user.email)
            .eq('verification_code', code)
            .gt('expires_at', new Date().toISOString())
            .single()

        if (error || !verification) {
            return { error: 'Invalid or expired verification code' }
        }

        // Mark email as verified
        await supabase
            .from('profiles')
            .update({ email_verified: true })
            .eq('id', session.user.id)

        // Delete verification record
        await supabase
            .from('verifications')
            .delete()
            .eq('id', verification.id)

        return { success: true }
    } catch (error: any) {
        console.error('Verification error:', error)
        return { error: 'Verification failed. Please try again.' }
    }
}

/**
 * Resend verification email with new code
 * Note: With Supabase Auth, this uses resend confirmation email.
 */
export async function resendVerificationEmail(): Promise<{ success?: boolean; error?: string }> {
    const session = await getSession()
    if (!session?.user?.email) {
        return { error: 'You must be logged in to request verification' }
    }

    const supabase = await createClient()

    try {
        const { error } = await supabase.auth.resend({
            type: 'signup',
            email: session.user.email,
        })

        if (error) {
            return { error: error.message }
        }

        return { success: true }
    } catch (error: any) {
        console.error('Resend verification error:', error)
        return { error: 'Failed to send verification email. Please try again.' }
    }
}
