'use server'

import { db } from '@/lib/db'
import { users, partialSessions } from '@/db/schema'
import { eq, and, gt } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { hash, compare } from 'bcryptjs'
import { sendTwoFactorEmail } from '@/lib/emailAdapter'

// =============================================================================
// CONSTANTS
// =============================================================================

const OTP_EXPIRY_MINUTES = 10
const OTP_RESEND_COOLDOWN_SECONDS = 60
const MAX_OTP_ATTEMPTS = 5
const PARTIAL_SESSION_EXPIRY_MINUTES = 10

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Generate a 6-digit OTP code
 */
function generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString()
}

/**
 * Generate a secure random token
 */
function generateToken(): string {
    return crypto.randomUUID() + '-' + Date.now().toString(36)
}

// =============================================================================
// PARTIAL SESSION MANAGEMENT
// =============================================================================

/**
 * Create a partial session for 2FA verification
 * Called after password is verified but before 2FA is complete
 */
export async function createPartialSession(
    userId: string,
    requiredMethod: 'totp' | 'email',
    request?: { ip?: string; userAgent?: string }
): Promise<{ token: string; expiresAt: Date }> {
    const token = generateToken()
    const expiresAt = new Date(Date.now() + PARTIAL_SESSION_EXPIRY_MINUTES * 60 * 1000)

    await db.insert(partialSessions).values({
        userId,
        token,
        requiredMethod,
        ipAddress: request?.ip || null,
        userAgent: request?.userAgent || null,
        expiresAt,
    })

    return { token, expiresAt }
}

/**
 * Get and validate a partial session by token
 */
export async function getPartialSession(token: string) {
    return await db.query.partialSessions.findFirst({
        where: and(
            eq(partialSessions.token, token),
            gt(partialSessions.expiresAt, new Date())
        )
    })
}

/**
 * Delete a partial session (after successful 2FA or expiry)
 */
export async function deletePartialSession(id: string) {
    await db.delete(partialSessions).where(eq(partialSessions.id, id))
}

// =============================================================================
// EMAIL OTP FUNCTIONS
// =============================================================================

/**
 * Send Email OTP for a partial session
 */
export async function sendEmailOTP(partialSessionToken: string): Promise<{
    success: boolean
    error?: string
    cooldownRemaining?: number
}> {
    const session = await getPartialSession(partialSessionToken)

    if (!session) {
        return { success: false, error: 'Session not found or expired' }
    }

    // Check cooldown (if OTP was sent recently)
    if (session.emailOtpExpiry) {
        const lastSentTime = new Date(session.emailOtpExpiry.getTime() - OTP_EXPIRY_MINUTES * 60 * 1000)
        const cooldownEnd = new Date(lastSentTime.getTime() + OTP_RESEND_COOLDOWN_SECONDS * 1000)

        if (cooldownEnd > new Date()) {
            const remaining = Math.ceil((cooldownEnd.getTime() - Date.now()) / 1000)
            return {
                success: false,
                error: 'Please wait before requesting a new code',
                cooldownRemaining: remaining
            }
        }
    }

    // Generate and hash OTP
    const otp = generateOTP()
    const otpHash = await hash(otp, 10)
    const otpExpiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000)

    // Update partial session with OTP
    await db.update(partialSessions)
        .set({
            emailOtpHash: otpHash,
            emailOtpExpiry: otpExpiry,
            emailOtpAttempts: 0,
        })
        .where(eq(partialSessions.id, session.id))

    // Get user email
    const user = await db.query.users.findFirst({
        where: eq(users.id, session.userId)
    })

    if (!user) {
        return { success: false, error: 'User not found' }
    }

    // Send email
    try {
        await sendTwoFactorEmail({ email: user.email, code: otp })
        return { success: true }
    } catch (error) {
        console.error('Failed to send 2FA email:', error)
        return { success: false, error: 'Failed to send verification email' }
    }
}

/**
 * Verify Email OTP and return if valid
 */
export async function verifyEmailOTP(partialSessionToken: string, code: string): Promise<{
    success: boolean
    userId?: string
    error?: string
    attemptsRemaining?: number
}> {
    const session = await getPartialSession(partialSessionToken)

    if (!session) {
        return { success: false, error: 'Session not found or expired' }
    }

    if (!session.emailOtpHash || !session.emailOtpExpiry) {
        return { success: false, error: 'No OTP sent for this session. Please request a code first.' }
    }

    // Check OTP expiry
    if (session.emailOtpExpiry < new Date()) {
        return { success: false, error: 'OTP has expired. Please request a new code.' }
    }

    // Check attempt limit
    if ((session.emailOtpAttempts || 0) >= MAX_OTP_ATTEMPTS) {
        return { success: false, error: 'Too many failed attempts. Please request a new code.' }
    }

    // Verify the code
    const isValid = await compare(code, session.emailOtpHash)

    if (!isValid) {
        // Increment attempts
        await db.update(partialSessions)
            .set({ emailOtpAttempts: (session.emailOtpAttempts || 0) + 1 })
            .where(eq(partialSessions.id, session.id))

        const remaining = MAX_OTP_ATTEMPTS - ((session.emailOtpAttempts || 0) + 1)
        return {
            success: false,
            error: 'Invalid verification code',
            attemptsRemaining: remaining
        }
    }

    // Success - delete partial session and return userId
    await deletePartialSession(session.id)

    return {
        success: true,
        userId: session.userId
    }
}

// =============================================================================
// 2FA SETUP FUNCTIONS
// =============================================================================

/**
 * Enable email 2FA for current user
 */
export async function enableEmailTwoFactor(): Promise<{ success: boolean; error?: string }> {
    const authSession = await auth.api.getSession({ headers: await headers() })

    if (!authSession) {
        return { success: false, error: 'Unauthorized' }
    }

    try {
        await db.update(users)
            .set({ emailTwoFactorEnabled: true })
            .where(eq(users.id, authSession.user.id))

        return { success: true }
    } catch (error) {
        console.error('Failed to enable email 2FA:', error)
        return { success: false, error: 'Failed to enable 2FA' }
    }
}

/**
 * Disable email 2FA for current user
 */
export async function disableEmailTwoFactor(): Promise<{ success: boolean; error?: string }> {
    const authSession = await auth.api.getSession({ headers: await headers() })

    if (!authSession) {
        return { success: false, error: 'Unauthorized' }
    }

    try {
        await db.update(users)
            .set({ emailTwoFactorEnabled: false })
            .where(eq(users.id, authSession.user.id))

        return { success: true }
    } catch (error) {
        console.error('Failed to disable email 2FA:', error)
        return { success: false, error: 'Failed to disable 2FA' }
    }
}

/**
 * Check if user has 2FA enabled
 */
export async function getUserTwoFactorStatus(userId: string): Promise<{
    totpEnabled: boolean
    emailEnabled: boolean
    hasPasskeys: boolean
}> {
    const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: {
            twoFactorEnabled: true,
            emailTwoFactorEnabled: true,
        }
    })

    // Check for passkeys
    const { passkeys } = await import('@/db/schema')
    const userPasskeys = await db.select({ id: passkeys.id })
        .from(passkeys)
        .where(eq(passkeys.userId, userId))
        .limit(1)

    return {
        totpEnabled: user?.twoFactorEnabled || false,
        emailEnabled: user?.emailTwoFactorEnabled || false,
        hasPasskeys: userPasskeys.length > 0,
    }
}
