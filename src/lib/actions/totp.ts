'use server'

import { db } from '@/lib/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { authenticator } from 'otplib'
import * as QRCode from 'qrcode'
import { encrypt, decrypt } from '@/lib/encryption'
import { hash, compare } from 'bcryptjs'

// =============================================================================
// CONFIGURATION
// =============================================================================

const APP_NAME = 'Curator'
const BACKUP_CODE_COUNT = 10

// =============================================================================
// TOTP SETUP
// =============================================================================

/**
 * Generate TOTP secret and QR code for setup
 */
export async function generateTOTPSetup(): Promise<{
    success: boolean
    secret?: string
    qrCode?: string
    error?: string
}> {
    const session = await auth.api.getSession({ headers: await headers() })

    if (!session) {
        return { success: false, error: 'Unauthorized' }
    }

    try {
        // Generate a new secret
        const secret = authenticator.generateSecret()

        // Create the otpauth URL
        const otpauthUrl = authenticator.keyuri(
            session.user.email,
            APP_NAME,
            secret
        )

        // Generate QR code as data URL
        const qrCode = await QRCode.toDataURL(otpauthUrl)

        // Return secret (user needs to verify before we save it)
        return {
            success: true,
            secret,
            qrCode
        }
    } catch (error) {
        console.error('Failed to generate TOTP setup:', error)
        return { success: false, error: 'Failed to generate setup' }
    }
}

/**
 * Verify TOTP code and enable 2FA
 */
export async function verifyAndEnableTOTP(
    secret: string,
    code: string
): Promise<{
    success: boolean
    backupCodes?: string[]
    error?: string
}> {
    const session = await auth.api.getSession({ headers: await headers() })

    if (!session) {
        return { success: false, error: 'Unauthorized' }
    }

    try {
        // Verify the code
        const isValid = authenticator.verify({ token: code, secret })

        if (!isValid) {
            return { success: false, error: 'Invalid verification code' }
        }

        // Generate backup codes
        const backupCodes = generateBackupCodes()
        const hashedBackupCodes = await Promise.all(
            backupCodes.map(code => hash(code, 10))
        )

        // Encrypt and save the secret
        const encryptedSecret = encrypt(secret)

        await db.update(users)
            .set({
                twoFactorSecret: encryptedSecret,
                twoFactorEnabled: true,
                twoFactorBackupCodes: JSON.stringify(hashedBackupCodes),
            })
            .where(eq(users.id, session.user.id))

        return {
            success: true,
            backupCodes // Return plain codes for user to save
        }
    } catch (error) {
        console.error('Failed to enable TOTP:', error)
        return { success: false, error: 'Failed to enable 2FA' }
    }
}

/**
 * Disable TOTP 2FA
 */
export async function disableTOTP(code: string): Promise<{
    success: boolean
    error?: string
}> {
    const session = await auth.api.getSession({ headers: await headers() })

    if (!session) {
        return { success: false, error: 'Unauthorized' }
    }

    // Get user's secret
    const user = await db.query.users.findFirst({
        where: eq(users.id, session.user.id),
        columns: { twoFactorSecret: true, twoFactorEnabled: true }
    })

    if (!user?.twoFactorEnabled || !user.twoFactorSecret) {
        return { success: false, error: '2FA is not enabled' }
    }

    try {
        // Decrypt and verify
        const secret = decrypt(user.twoFactorSecret)
        const isValid = authenticator.verify({ token: code, secret })

        if (!isValid) {
            return { success: false, error: 'Invalid verification code' }
        }

        // Disable 2FA
        await db.update(users)
            .set({
                twoFactorSecret: null,
                twoFactorEnabled: false,
                twoFactorBackupCodes: null,
            })
            .where(eq(users.id, session.user.id))

        return { success: true }
    } catch (error) {
        console.error('Failed to disable TOTP:', error)
        return { success: false, error: 'Failed to disable 2FA' }
    }
}

// =============================================================================
// TOTP VERIFICATION (for login)
// =============================================================================

/**
 * Verify TOTP code during login
 */
export async function verifyTOTPCode(userId: string, code: string): Promise<{
    success: boolean
    error?: string
}> {
    const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: {
            twoFactorSecret: true,
            twoFactorEnabled: true,
            twoFactorBackupCodes: true
        }
    })

    if (!user?.twoFactorEnabled || !user.twoFactorSecret) {
        return { success: false, error: '2FA is not enabled for this user' }
    }

    try {
        // Try TOTP code first
        const secret = decrypt(user.twoFactorSecret)
        const isValid = authenticator.verify({ token: code, secret })

        if (isValid) {
            return { success: true }
        }

        // If not valid, try backup codes
        if (user.twoFactorBackupCodes) {
            const backupCodes = JSON.parse(user.twoFactorBackupCodes) as string[]

            for (let i = 0; i < backupCodes.length; i++) {
                const isBackupValid = await compare(code, backupCodes[i])
                if (isBackupValid) {
                    // Remove used backup code
                    backupCodes.splice(i, 1)
                    await db.update(users)
                        .set({ twoFactorBackupCodes: JSON.stringify(backupCodes) })
                        .where(eq(users.id, userId))

                    return { success: true }
                }
            }
        }

        return { success: false, error: 'Invalid verification code' }
    } catch (error) {
        console.error('TOTP verification failed:', error)
        return { success: false, error: 'Verification failed' }
    }
}

// =============================================================================
// BACKUP CODES
// =============================================================================

/**
 * Generate new backup codes
 */
function generateBackupCodes(): string[] {
    const codes: string[] = []
    for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
        // Generate 8-character alphanumeric codes
        const code = Array.from({ length: 8 }, () =>
            'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]
        ).join('')
        codes.push(code)
    }
    return codes
}

/**
 * Regenerate backup codes (requires TOTP verification)
 */
export async function regenerateBackupCodes(code: string): Promise<{
    success: boolean
    backupCodes?: string[]
    error?: string
}> {
    const session = await auth.api.getSession({ headers: await headers() })

    if (!session) {
        return { success: false, error: 'Unauthorized' }
    }

    const user = await db.query.users.findFirst({
        where: eq(users.id, session.user.id),
        columns: { twoFactorSecret: true, twoFactorEnabled: true }
    })

    if (!user?.twoFactorEnabled || !user.twoFactorSecret) {
        return { success: false, error: '2FA is not enabled' }
    }

    try {
        // Verify the code first
        const secret = decrypt(user.twoFactorSecret)
        const isValid = authenticator.verify({ token: code, secret })

        if (!isValid) {
            return { success: false, error: 'Invalid verification code' }
        }

        // Generate new backup codes
        const backupCodes = generateBackupCodes()
        const hashedBackupCodes = await Promise.all(
            backupCodes.map(code => hash(code, 10))
        )

        await db.update(users)
            .set({ twoFactorBackupCodes: JSON.stringify(hashedBackupCodes) })
            .where(eq(users.id, session.user.id))

        return { success: true, backupCodes }
    } catch (error) {
        console.error('Failed to regenerate backup codes:', error)
        return { success: false, error: 'Failed to regenerate backup codes' }
    }
}

/**
 * Get count of remaining backup codes
 */
export async function getBackupCodeCount(): Promise<number> {
    const session = await auth.api.getSession({ headers: await headers() })

    if (!session) {
        return 0
    }

    const user = await db.query.users.findFirst({
        where: eq(users.id, session.user.id),
        columns: { twoFactorBackupCodes: true }
    })

    if (!user?.twoFactorBackupCodes) {
        return 0
    }

    try {
        const codes = JSON.parse(user.twoFactorBackupCodes) as string[]
        return codes.length
    } catch {
        return 0
    }
}
