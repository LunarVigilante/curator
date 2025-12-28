'use server'

import { db } from '@/lib/db'
import { verifications, users } from '@/db/schema'
import { eq, and, gt } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

/**
 * Generate a 6-digit verification code
 */
export function generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString()
}

/**
 * Verify email using 6-digit code
 */
export async function verifyEmailByCode(
    prevState: { success?: boolean; error?: string } | undefined,
    formData: FormData
): Promise<{ success?: boolean; error?: string }> {
    const code = formData.get('code') as string

    if (!code || code.length !== 6) {
        return { error: 'Please enter a valid 6-digit code' }
    }

    // Get current user
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.email) {
        return { error: 'You must be logged in to verify your email' }
    }

    try {
        // Find verification record with matching code
        const verification = await db.query.verifications.findFirst({
            where: and(
                eq(verifications.identifier, session.user.email),
                eq(verifications.verificationCode, code),
                gt(verifications.expiresAt, new Date())
            )
        })

        if (!verification) {
            return { error: 'Invalid or expired verification code' }
        }

        // Mark email as verified
        await db.update(users)
            .set({ emailVerified: true })
            .where(eq(users.id, session.user.id))

        // Delete verification record
        await db.delete(verifications)
            .where(eq(verifications.id, verification.id))

        return { success: true }
    } catch (error: any) {
        console.error('Verification error:', error)
        return { error: 'Verification failed. Please try again.' }
    }
}

/**
 * Resend verification email with new code
 */
export async function resendVerificationEmail(): Promise<{ success?: boolean; error?: string }> {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.email) {
        return { error: 'You must be logged in to request verification' }
    }

    try {
        // Use better-auth to resend verification
        await auth.api.sendVerificationEmail({
            body: {
                email: session.user.email,
                callbackURL: '/verify-email'
            }
        })

        return { success: true }
    } catch (error: any) {
        console.error('Resend verification error:', error)
        return { error: 'Failed to send verification email. Please try again.' }
    }
}
