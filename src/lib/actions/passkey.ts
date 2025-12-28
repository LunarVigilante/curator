'use server'

import { db } from '@/lib/db'
import { users, passkeys } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse,
} from '@simplewebauthn/server'

// =============================================================================
// CONFIGURATION
// =============================================================================

// WebAuthn Relying Party configuration
const RP_NAME = 'Curator'
const RP_ID = process.env.WEBAUTHN_RP_ID || 'localhost'
const ORIGIN = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

// Challenge storage (in production, use Redis or similar)
const challengeStore = new Map<string, { challenge: string; expiresAt: number }>()

function storeChallenge(userId: string, challenge: string) {
    challengeStore.set(userId, {
        challenge,
        expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutes
    })
}

function getChallenge(userId: string): string | null {
    const stored = challengeStore.get(userId)
    if (!stored || stored.expiresAt < Date.now()) {
        challengeStore.delete(userId)
        return null
    }
    return stored.challenge
}

// =============================================================================
// PASSKEY REGISTRATION
// =============================================================================

/**
 * Generate registration options for adding a new passkey
 */
export async function generatePasskeyRegistrationOptions(): Promise<{
    success: boolean
    options?: any
    error?: string
}> {
    const session = await auth.api.getSession({ headers: await headers() })

    if (!session) {
        return { success: false, error: 'Unauthorized' }
    }

    try {
        // Get existing passkeys for this user
        const existingPasskeys = await db.select({
            credId: passkeys.credentialId,
        }).from(passkeys).where(eq(passkeys.userId, session.user.id))

        const options = await generateRegistrationOptions({
            rpName: RP_NAME,
            rpID: RP_ID,
            userID: session.user.id as any, // Cast to avoid type issues between versions
            userName: session.user.email,
            userDisplayName: session.user.name || session.user.email,
            attestationType: 'none',
            // Convert base64url strings to Uint8Array for exclusion
            excludeCredentials: existingPasskeys.map(pk => ({
                id: new Uint8Array(Buffer.from(pk.credId, 'base64url')),
                type: 'public-key' as const,
            })),
            authenticatorSelection: {
                residentKey: 'preferred',
                userVerification: 'preferred',
            },
        })

        // Store challenge for verification
        storeChallenge(session.user.id, options.challenge)

        return { success: true, options }
    } catch (error) {
        console.error('Failed to generate passkey options:', error)
        return { success: false, error: 'Failed to generate registration options' }
    }
}

/**
 * Verify and save a new passkey registration
 */
export async function verifyPasskeyRegistration(
    response: any,
    name?: string
): Promise<{ success: boolean; error?: string }> {
    const session = await auth.api.getSession({ headers: await headers() })

    if (!session) {
        return { success: false, error: 'Unauthorized' }
    }

    const expectedChallenge = getChallenge(session.user.id)
    if (!expectedChallenge) {
        return { success: false, error: 'Challenge expired. Please try again.' }
    }

    try {
        const verification = await verifyRegistrationResponse({
            response,
            expectedChallenge,
            expectedOrigin: ORIGIN,
            expectedRPID: RP_ID,
        })

        if (!verification.verified || !verification.registrationInfo) {
            return { success: false, error: 'Verification failed' }
        }

        const { credentialID, credentialPublicKey, counter, credentialDeviceType } = verification.registrationInfo

        // Convert Uint8Arrays to base64url strings for storage
        const credIdBase64 = Buffer.from(credentialID).toString('base64url')
        const pubKeyBase64 = Buffer.from(credentialPublicKey).toString('base64url')

        // Save passkey to database
        await db.insert(passkeys).values({
            userId: session.user.id,
            credentialId: credIdBase64,
            publicKey: pubKeyBase64,
            counter: counter,
            deviceType: credentialDeviceType,
            transports: JSON.stringify(response.response?.transports || []),
            name: name || `Passkey ${new Date().toLocaleDateString()}`,
        })

        // Clear challenge
        challengeStore.delete(session.user.id)

        return { success: true }
    } catch (error) {
        console.error('Passkey registration verification failed:', error)
        return { success: false, error: 'Registration verification failed' }
    }
}

// =============================================================================
// PASSKEY AUTHENTICATION
// =============================================================================

/**
 * Generate authentication options for passkey login
 */
export async function generatePasskeyAuthOptions(email?: string): Promise<{
    success: boolean
    options?: any
    error?: string
}> {
    try {
        let userPasskeys: { credentialId: string; transports: string | null }[] = []

        // If email provided, get user's passkeys
        if (email) {
            const user = await db.query.users.findFirst({
                where: eq(users.email, email)
            })

            if (user) {
                userPasskeys = await db.select({
                    credentialId: passkeys.credentialId,
                    transports: passkeys.transports,
                }).from(passkeys).where(eq(passkeys.userId, user.id))
            }
        }

        const options = await generateAuthenticationOptions({
            rpID: RP_ID,
            // Convert base64url strings to Uint8Array
            allowCredentials: userPasskeys.map(pk => ({
                id: new Uint8Array(Buffer.from(pk.credentialId, 'base64url')),
                type: 'public-key' as const,
                transports: pk.transports ? JSON.parse(pk.transports) : undefined,
            })),
            userVerification: 'preferred',
        })

        // Store challenge
        const challengeKey = email || 'anonymous-' + crypto.randomUUID()
        storeChallenge(challengeKey, options.challenge)

        return { success: true, options }
    } catch (error) {
        console.error('Failed to generate auth options:', error)
        return { success: false, error: 'Failed to generate authentication options' }
    }
}

/**
 * Verify passkey authentication
 */
export async function verifyPasskeyAuth(
    response: any,
    email?: string
): Promise<{
    success: boolean
    userId?: string
    error?: string
}> {
    try {
        // Find the passkey by credential ID
        const credentialId = response.id

        const passkey = await db.query.passkeys.findFirst({
            where: eq(passkeys.credentialId, credentialId)
        })

        if (!passkey) {
            return { success: false, error: 'Passkey not found' }
        }

        // Get the stored challenge
        const challengeKey = email || 'anonymous-' + response.id.slice(0, 16)
        const expectedChallenge = getChallenge(challengeKey) || getChallenge(passkey.userId)

        if (!expectedChallenge) {
            return { success: false, error: 'Challenge expired. Please try again.' }
        }

        // Convert stored base64url back to Uint8Array
        const credPubKey = new Uint8Array(Buffer.from(passkey.publicKey, 'base64url'))

        // Convert stored base64url credential ID to Uint8Array
        const credIdBytes = new Uint8Array(Buffer.from(passkey.credentialId, 'base64url'))

        const verification = await verifyAuthenticationResponse({
            response,
            expectedChallenge,
            expectedOrigin: ORIGIN,
            expectedRPID: RP_ID,
            authenticator: {
                credentialID: credIdBytes,
                credentialPublicKey: credPubKey,
                counter: passkey.counter,
            },
        })

        if (!verification.verified) {
            return { success: false, error: 'Authentication failed' }
        }

        // Update counter to prevent replay attacks
        await db.update(passkeys)
            .set({
                counter: verification.authenticationInfo.newCounter,
                lastUsedAt: new Date()
            })
            .where(eq(passkeys.id, passkey.id))

        return { success: true, userId: passkey.userId }
    } catch (error) {
        console.error('Passkey auth verification failed:', error)
        return { success: false, error: 'Authentication verification failed' }
    }
}

// =============================================================================
// PASSKEY MANAGEMENT
// =============================================================================

/**
 * Get all passkeys for current user
 */
export async function getUserPasskeys(): Promise<{
    id: string
    name: string | null
    deviceType: string | null
    createdAt: Date
    lastUsedAt: Date | null
}[]> {
    const session = await auth.api.getSession({ headers: await headers() })

    if (!session) {
        return []
    }

    const userPasskeys = await db.select({
        id: passkeys.id,
        name: passkeys.name,
        deviceType: passkeys.deviceType,
        createdAt: passkeys.createdAt,
        lastUsedAt: passkeys.lastUsedAt,
    }).from(passkeys).where(eq(passkeys.userId, session.user.id))

    return userPasskeys
}

/**
 * Delete a passkey
 */
export async function deletePasskey(passkeyId: string): Promise<{
    success: boolean
    error?: string
}> {
    const session = await auth.api.getSession({ headers: await headers() })

    if (!session) {
        return { success: false, error: 'Unauthorized' }
    }

    try {
        // Verify ownership
        const passkey = await db.query.passkeys.findFirst({
            where: eq(passkeys.id, passkeyId)
        })

        if (!passkey || passkey.userId !== session.user.id) {
            return { success: false, error: 'Passkey not found' }
        }

        await db.delete(passkeys).where(eq(passkeys.id, passkeyId))

        return { success: true }
    } catch (error) {
        console.error('Failed to delete passkey:', error)
        return { success: false, error: 'Failed to delete passkey' }
    }
}

/**
 * Rename a passkey
 */
export async function renamePasskey(passkeyId: string, name: string): Promise<{
    success: boolean
    error?: string
}> {
    const session = await auth.api.getSession({ headers: await headers() })

    if (!session) {
        return { success: false, error: 'Unauthorized' }
    }

    try {
        // Verify ownership
        const passkey = await db.query.passkeys.findFirst({
            where: eq(passkeys.id, passkeyId)
        })

        if (!passkey || passkey.userId !== session.user.id) {
            return { success: false, error: 'Passkey not found' }
        }

        await db.update(passkeys)
            .set({ name })
            .where(eq(passkeys.id, passkeyId))

        return { success: true }
    } catch (error) {
        console.error('Failed to rename passkey:', error)
        return { success: false, error: 'Failed to rename passkey' }
    }
}
