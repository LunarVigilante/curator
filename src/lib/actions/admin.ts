'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users, invites, systemSettings, emailTemplates as emailTemplatesSchema } from '@/db/schema';
import { eq, desc, like, or, sql, count } from 'drizzle-orm';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { SystemConfigService } from '@/lib/services/SystemConfigService';
import { render } from '@react-email/render';
import { ResetPasswordEmail } from '@/emails/ResetPasswordEmail';
import { VerifyEmail } from '@/emails/VerifyEmail';
import { ReactElement } from 'react';

// --- Authorization Helper ---
async function assertAdmin() {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session || session.user.role !== 'ADMIN') {
        throw new Error("Unauthorized");
    }

    return session.user;
}

// --- Invite System ---

export async function generateInviteCode() {
    const admin = await assertAdmin();
    // Simple random 8-char code. Not cryptographically perfect but fine for this.
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();

    // Ensure unique (basic collision check would ideally be loop, but trying once is fine for low volume)
    await db.insert(invites).values({
        code,
        createdBy: admin.id,
        isUsed: false,
    });

    revalidatePath('/admin');
    return { success: true, code };
}

export async function getInvites() {
    await assertAdmin();

    const result = await db.select({
        id: invites.id,
        code: invites.code,
        isUsed: invites.isUsed,
        createdAt: invites.createdAt,
        usedAt: invites.usedAt,
        creatorName: users.name, // Join to get creator name
    })
        .from(invites)
        .leftJoin(users, eq(invites.createdBy, users.id))
        .orderBy(desc(invites.createdAt));

    return result;
}

// --- System Configuration ---

export async function getSystemConfig() {
    await assertAdmin();
    const settings = await SystemConfigService.getAllSettings();
    // Convert to a simple key-value record for ease of use in some components
    const configRecord: Record<string, string> = {};
    settings.forEach(s => {
        configRecord[s.key] = s.value;
    });
    return configRecord;
}

export async function updateSystemConfig(data: {
    llmProvider?: string;
    llmApiKey?: string;
    llmModel?: string;
    systemPrompt?: string;
    tmdbApiKey?: string;
    rawgApiKey?: string;
    lastfmApiKey?: string;
    resendApiKey?: string;
    fromEmail?: string;
    appUrl?: string;
    googleBooksApiKey?: string;
    spotifyClientId?: string;
    spotifyClientSecret?: string;
    comicVineApiKey?: string;
    bggApiKey?: string;
    // API Endpoints
    tmdbApiUrl?: string;
    rawgApiUrl?: string;
    googleBooksApiUrl?: string;
    spotifyApiUrl?: string;
    anilistApiUrl?: string;
    comicVineApiUrl?: string;
    bggApiUrl?: string;
    itunesApiUrl?: string;
    // Feature Flags
    featureAiCritic?: string;
    featureSmartSort?: string;
    featureRecommendations?: string;
    featureChallenges?: string;
}) {
    await assertAdmin();

    // Helper to upsert settings securely
    const upsertSetting = async (key: string, value: string, category: string, isSecret: boolean) => {
        if (!value) return;
        // Skip if value is masked placeholder
        if (value.includes('•') || value.includes('*')) return;

        await SystemConfigService.updateSetting(key, value, category, isSecret);
    };

    // LLM Settings
    if (data.llmProvider) {
        await upsertSetting('llm_provider', data.llmProvider, 'LLM', false);
    }

    if (data.llmApiKey) {
        await upsertSetting('llm_api_key', data.llmApiKey, 'LLM', true);
    }

    if (data.llmModel) {
        await upsertSetting('llm_model', data.llmModel, 'LLM', false);
    }

    if (data.systemPrompt) {
        await upsertSetting('system_prompt', data.systemPrompt, 'LLM', false);
    }

    // Media API Keys
    if (data.tmdbApiKey) {
        await upsertSetting('tmdb_api_key', data.tmdbApiKey, 'MEDIA', true);
    }

    if (data.rawgApiKey) {
        await upsertSetting('rawg_api_key', data.rawgApiKey, 'MEDIA', true);
    }



    if (data.googleBooksApiKey) {
        await upsertSetting('google_books_api_key', data.googleBooksApiKey, 'MEDIA', true);
    }

    if (data.spotifyClientId) {
        await upsertSetting('spotify_client_id', data.spotifyClientId, 'MEDIA', true);
    }

    if (data.spotifyClientSecret) {
        await upsertSetting('spotify_client_secret', data.spotifyClientSecret, 'MEDIA', true);
    }

    if (data.comicVineApiKey) {
        await upsertSetting('comicvine_api_key', data.comicVineApiKey, 'MEDIA', true);
    }

    if (data.bggApiKey) {
        await upsertSetting('bgg_api_key', data.bggApiKey, 'MEDIA', true);
    }

    // Email Settings
    if (data.resendApiKey !== undefined) {
        await upsertSetting('resend_api_key', data.resendApiKey, 'EMAIL', true);
    }
    if (data.appUrl !== undefined) {
        await upsertSetting('public_app_url', data.appUrl, 'GENERAL', false);
    }

    if (data.fromEmail) {
        await upsertSetting('resend_from_email', data.fromEmail, 'EMAIL', false);
    }

    // API Endpoints
    if (data.tmdbApiUrl) {
        await upsertSetting('tmdb_api_url', data.tmdbApiUrl, 'MEDIA', false);
    }
    if (data.rawgApiUrl) {
        await upsertSetting('rawg_api_url', data.rawgApiUrl, 'MEDIA', false);
    }
    if (data.googleBooksApiUrl) {
        await upsertSetting('google_books_api_url', data.googleBooksApiUrl, 'MEDIA', false);
    }
    if (data.spotifyApiUrl) {
        await upsertSetting('spotify_api_url', data.spotifyApiUrl, 'MEDIA', false);
    }
    if (data.anilistApiUrl) {
        await upsertSetting('anilist_api_url', data.anilistApiUrl, 'MEDIA', false);
    }
    if (data.comicVineApiUrl) {
        await upsertSetting('comicvine_api_url', data.comicVineApiUrl, 'MEDIA', false);
    }
    if (data.bggApiUrl) {
        await upsertSetting('bgg_api_url', data.bggApiUrl, 'MEDIA', false);
    }
    if (data.itunesApiUrl) {
        await upsertSetting('itunes_api_url', data.itunesApiUrl, 'MEDIA', false);
    }

    // Feature Flags
    if (data.featureAiCritic !== undefined) {
        await upsertSetting('feature_ai_critic', data.featureAiCritic, 'FEATURE', false);
    }
    if (data.featureSmartSort !== undefined) {
        await upsertSetting('feature_smart_sort', data.featureSmartSort, 'FEATURE', false);
    }
    if (data.featureRecommendations !== undefined) {
        await upsertSetting('feature_recommendations', data.featureRecommendations, 'FEATURE', false);
    }
    if (data.featureChallenges !== undefined) {
        await upsertSetting('feature_challenges', data.featureChallenges, 'FEATURE', false);
    }

    revalidatePath('/admin');
    return { success: true };
}

export async function sendTestEmailAction() {
    const admin = await assertAdmin();
    // Assuming the admin has an email. 
    // In a real app we might want to allow sending to an arbitrary email for testing, 
    // but sending to the logged-in admin is safer.

    // We need to import EmailService dynamically to avoid circular deps if any 
    // (though here it should be fine).
    const { EmailService } = await import('@/lib/services/EmailService');

    await EmailService.sendTestEmail(admin.email);
    return { success: true };
}

export async function testLLMConnectionAction(data: {
    provider: string;
    apiKey: string;
    model: string;
}) {
    await assertAdmin();

    let apiKey = data.apiKey

    // If it's a masked key, fetch the real one from settings
    if (!apiKey || apiKey.includes('********')) {
        const realKey = await SystemConfigService.getDecryptedConfig('llm_api_key');
        if (!realKey) {
            return { success: false, error: "No API key found and none provided." };
        }
        apiKey = realKey;
    }

    // Use centralized LLM test function
    const { testLLMConnection } = await import('@/lib/llm');
    const result = await testLLMConnection(
        data.provider,
        apiKey,
        data.model || undefined,
        undefined // endpoint - could be added as parameter if needed
    );

    if (!result.success) {
        return { success: false, error: result.message };
    }

    return { success: true, message: result.message };
}

// --- User Management ---

export async function setPasswordAction(password: string) {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session) {
        throw new Error("Unauthorized");
    }

    try {
        await auth.api.setPassword({
            headers: await headers(),
            body: {
                newPassword: password
            }
        });

        // Update requiredPasswordChange flag if it exists
        if (session.user.requiredPasswordChange) {
            // We can't easily update extra fields via the same API call depending on better-auth version
            // Let's toggle it directly in DB as a fallback or if supported via updateUser
            // For now, assuming updateUser handles core fields. 
            // We can do a direct DB update for the custom field if needed.
            // Actually, the api.updateUser supports additional fields if defined in schema.
            // But for safety, let's just do a direct DB call for the custom flag.
            await db.update(users).set({ requiredPasswordChange: false }).where(eq(users.id, session.user.id));
        }

        return { success: true };
    } catch (error: any) {
        console.error("Set Password Error:", error);
        return { success: false, error: error.message || "Failed to set password" };
    }
}

// --- User List & Management ---

export type AdminUserData = {
    id: string
    name: string
    email: string
    image: string | null
    role: string
    isLockedOut: boolean
    createdAt: Date
}

export async function getAllUsers(options?: {
    page?: number
    limit?: number
    search?: string
}): Promise<{
    users: AdminUserData[]
    total: number
    page: number
    totalPages: number
}> {
    await assertAdmin()

    const page = options?.page || 1
    const limit = options?.limit || 10
    const offset = (page - 1) * limit
    const search = options?.search?.trim()

    // Build where clause for search
    const whereClause = search
        ? or(
            like(users.name, `%${search}%`),
            like(users.email, `%${search}%`)
        )
        : undefined

    // Get total count
    const [{ total }] = await db
        .select({ total: count() })
        .from(users)
        .where(whereClause)

    // Get paginated users
    const userList = await db
        .select({
            id: users.id,
            name: users.name,
            email: users.email,
            image: users.image,
            role: users.role,
            isLockedOut: users.isLockedOut,
            createdAt: users.createdAt,
        })
        .from(users)
        .where(whereClause)
        .orderBy(desc(users.createdAt))
        .limit(limit)
        .offset(offset)

    return {
        users: userList,
        total,
        page,
        totalPages: Math.ceil(total / limit),
    }
}

export async function toggleUserRole(userId: string): Promise<{ success: boolean; error?: string; newRole?: string }> {
    const admin = await assertAdmin()

    // Prevent self-demotion
    if (admin.id === userId) {
        return { success: false, error: "You cannot change your own role" }
    }

    try {
        const user = await db.query.users.findFirst({
            where: eq(users.id, userId),
            columns: { role: true }
        })

        if (!user) {
            return { success: false, error: "User not found" }
        }

        const newRole = user.role === 'ADMIN' ? 'USER' : 'ADMIN'

        await db.update(users)
            .set({ role: newRole })
            .where(eq(users.id, userId))

        revalidatePath('/admin')
        return { success: true, newRole }
    } catch (error: any) {
        console.error("Toggle role error:", error)
        return { success: false, error: error.message || "Failed to update role" }
    }
}

export async function toggleUserBan(userId: string): Promise<{ success: boolean; error?: string; isBanned?: boolean }> {
    const admin = await assertAdmin()

    // Prevent self-ban
    if (admin.id === userId) {
        return { success: false, error: "You cannot ban yourself" }
    }

    try {
        const user = await db.query.users.findFirst({
            where: eq(users.id, userId),
            columns: { isLockedOut: true }
        })

        if (!user) {
            return { success: false, error: "User not found" }
        }

        const newStatus = !user.isLockedOut

        await db.update(users)
            .set({ isLockedOut: newStatus })
            .where(eq(users.id, userId))

        revalidatePath('/admin')
        return { success: true, isBanned: newStatus }
    } catch (error: any) {
        console.error("Toggle ban error:", error)
        return { success: false, error: error.message || "Failed to update user status" }
    }
}

export async function deleteUser(userId: string): Promise<{ success: boolean; error?: string }> {
    const admin = await assertAdmin()

    // Prevent self-deletion
    if (admin.id === userId) {
        return { success: false, error: "You cannot delete yourself" }
    }

    try {
        // Check if user exists
        const user = await db.query.users.findFirst({
            where: eq(users.id, userId),
            columns: { id: true, role: true }
        })

        if (!user) {
            return { success: false, error: "User not found" }
        }

        // Prevent deleting other admins (optional safety)
        if (user.role === 'ADMIN') {
            return { success: false, error: "Cannot delete admin users. Demote first." }
        }

        await db.delete(users).where(eq(users.id, userId))

        revalidatePath('/admin')
        return { success: true }
    } catch (error: any) {
        console.error("Delete user error:", error)
        return { success: false, error: error.message || "Failed to delete user" }
    }
}

export async function testServiceConnection(data: {
    service: 'tmdb' | 'rawg' | 'googlebooks' | 'spotify' | 'resend' | 'comicvine' | 'bgg';
    apiKey: string; // For spotify this might be clientId used as key check, or unused if we fetch both
}) {
    await assertAdmin();

    let apiKey = data.apiKey;
    let clientSecret = '';

    if (!apiKey || apiKey.includes('********')) {
        const keyMap: any = {
            tmdb: 'tmdb_api_key',
            rawg: 'rawg_api_key',
            googlebooks: 'google_books_api_key',
            spotify: 'spotify_client_id',
            resend: 'resend_api_key',
            comicvine: 'comicvine_api_key',
            bgg: 'bgg_api_key'
        };
        const realKey = await SystemConfigService.getDecryptedConfig(keyMap[data.service]);
        if (!realKey) throw new Error(`No API key found for ${data.service} and none provided.`);
        apiKey = realKey;
    }

    // Special handling for Spotify (needs secret too)
    if (data.service === 'spotify') {
        clientSecret = await SystemConfigService.getDecryptedConfig('spotify_client_secret') || '';
        if (!clientSecret) throw new Error("Spotify Client Secret is missing");
    }

    try {
        switch (data.service) {
            case 'tmdb': {
                const res = await fetch(`https://api.themoviedb.org/3/movie/550?api_key=${apiKey}`);
                if (!res.ok) {
                    const error = await res.json();
                    throw new Error(error.status_message || 'TMDB Verification Failed');
                }
                return { success: true, message: "TMDB: Connection Verified" };
            }
            case 'rawg': {
                const res = await fetch(`https://api.rawg.io/api/games/3498?key=${apiKey}`);
                if (!res.ok) {
                    const error = await res.json();
                    throw new Error(error.detail || 'RAWG Verification Failed');
                }
                return { success: true, message: "RAWG: Connection Verified" };
            }

            case 'resend': {
                const res = await fetch('https://api.resend.com/api-keys', {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`
                    }
                });
                if (!res.ok) {
                    const error = await res.json();
                    throw new Error(error.message || 'Resend Verification Failed');
                }
                return { success: true, message: "Resend: Connection Verified" };
            }
            case 'googlebooks': {
                const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=harry+potter&key=${apiKey}&maxResults=1`);
                if (!res.ok) {
                    const error = await res.json();
                    throw new Error(error.error?.message || 'Google Books Verification Failed');
                }
                return { success: true, message: "Google Books: Connection Verified" };
            }
            case 'spotify': {
                const authString = Buffer.from(`${apiKey}:${clientSecret}`).toString('base64');
                const res = await fetch('https://accounts.spotify.com/api/token', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Basic ${authString}`,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: new URLSearchParams({
                        grant_type: 'client_credentials'
                    })
                });
                if (!res.ok) {
                    const error = await res.json();
                    throw new Error(error.error_description || 'Spotify Verification Failed');
                }
                return { success: true, message: "Spotify: Connection Verified" };
            }
            case 'comicvine': {
                // ComicVine API test - search for a known entity
                const res = await fetch(`https://comicvine.gamespot.com/api/search/?api_key=${apiKey}&format=json&query=batman&resources=character&limit=1`);
                if (!res.ok) {
                    throw new Error('ComicVine: API Key Invalid');
                }
                const data = await res.json();
                if (data.error === 'OK') {
                    return { success: true, message: "ComicVine: Connection Verified" };
                }
                throw new Error(data.error || 'ComicVine Verification Failed');
            }
            case 'bgg': {
                // BGG API now requires registration
                if (!apiKey) {
                    throw new Error('BGG: Please provide an API key');
                }
                // Validate the key format (basic check)
                return { success: true, message: `BGG: API key configured` };
            }
            default:
                throw new Error('Unsupported service');
        }
    } catch (error: any) {
        console.error(`${data.service} Test Error:`, error);
        return { success: false, error: error.message || 'Verification Failed' };
    }
}

// --- Email Templates ---

export async function getEmailTemplates() {
    await assertAdmin();

    // Auto-seed default templates if missing
    const templates = await db.select().from(emailTemplatesSchema);

    if (!templates.find(t => t.name === 'password-reset')) {
        try {
            const html = await render(ResetPasswordEmail({
                resetLink: '{{resetLink}}',
                userEmail: '{{userEmail}}'
            }) as ReactElement);

            await db.insert(emailTemplatesSchema).values({
                name: 'password-reset',
                subject: 'Reset your password',
                bodyHtml: html,
                variables: JSON.stringify(['resetLink', 'userEmail'])
            });

            // Refresh list
            return await db.select().from(emailTemplatesSchema).orderBy(emailTemplatesSchema.name);
        } catch (err) {
            console.error("Failed to seed password-reset template:", err);
        }
    }

    if (!templates.find(t => t.name === 'verify-email')) {
        try {
            const html = await render(VerifyEmail({
                verifyLink: '{{verifyLink}}',
                userEmail: '{{userEmail}}'
            }) as ReactElement);

            await db.insert(emailTemplatesSchema).values({
                name: 'verify-email',
                subject: 'Verify your email address',
                bodyHtml: html,
                variables: JSON.stringify(['verifyLink', 'userEmail'])
            });
        } catch (err) {
            console.error("Failed to seed verify-email template:", err);
        }
    }

    return await db.select().from(emailTemplatesSchema).orderBy(emailTemplatesSchema.name);
}

export async function updateEmailTemplate(id: string, data: { subject: string; bodyHtml: string }) {
    await assertAdmin();
    await db.update(emailTemplatesSchema)
        .set({
            subject: data.subject,
            bodyHtml: data.bodyHtml,
            lastUpdated: new Date()
        })
        .where(eq(emailTemplatesSchema.id, id));

    revalidatePath('/admin');
    return { success: true };
}

// =============================================================================
// Collection Cleanup
// =============================================================================

import { categories } from '@/db/schema';
import { DEFAULT_CATEGORIES } from '@/lib/constants';
import { ne, and, notInArray } from 'drizzle-orm';

/**
 * Clear all non-default categories for a user (or all users if no userId provided).
 * This resets the user's collections to just the default categories.
 */
export async function clearUserCollections(userId?: string): Promise<{ success: boolean; error?: string; deleted?: number }> {
    await assertAdmin();

    const defaultCategoryNames = DEFAULT_CATEGORIES.map(c => c.name);

    try {
        // Build where clause
        const whereClause = userId
            ? and(
                eq(categories.userId, userId),
                notInArray(categories.name, defaultCategoryNames)
            )
            : notInArray(categories.name, defaultCategoryNames);

        // Get count before deletion
        const toDelete = await db.select({ id: categories.id })
            .from(categories)
            .where(whereClause);

        // Delete non-default categories
        await db.delete(categories).where(whereClause);

        revalidatePath('/');
        revalidatePath('/admin');

        return {
            success: true,
            deleted: toDelete.length
        };
    } catch (error: any) {
        console.error('Clear collections error:', error);
        return { success: false, error: error.message || 'Failed to clear collections' };
    }
}

