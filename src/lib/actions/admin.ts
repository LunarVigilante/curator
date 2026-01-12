'use server'

import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { SystemConfigService } from '@/lib/services/SystemConfigService'
import { render } from '@react-email/render'
import { ResetPasswordEmail } from '@/emails/ResetPasswordEmail'
import { VerifyEmail } from '@/emails/VerifyEmail'
import { ReactElement } from 'react'
import { DEFAULT_CATEGORIES } from '@/lib/constants'

// --- Authorization Helper ---
async function assertAdmin() {
    const session = await getSession()

    if (!session || session.profile?.role !== 'ADMIN') {
        throw new Error("Unauthorized")
    }

    return session
}

// --- Invite System ---

export async function generateInviteCode() {
    const session = await assertAdmin()
    const supabase = await createClient()

    const code = Math.random().toString(36).substring(2, 10).toUpperCase()

    await (supabase.from('invites') as any).insert({
        code,
        created_by: session.user.id,
        is_used: false,
    } as any)

    revalidatePath('/admin')
    return { success: true, code }
}

export async function getInvites() {
    await assertAdmin()
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('invites')
        .select(`
            id,
            code,
            is_used,
            created_at,
            used_at,
            creator:profiles!invites_created_by_fkey(name)
        `)
        .order('created_at', { ascending: false })

    if (error) throw error

    return ((data as any[]) || []).map(invite => ({
        ...invite,
        creatorName: (invite.creator as any)?.name || null
    }))
}

// --- System Configuration ---

export async function getSystemConfig() {
    await assertAdmin()
    const settings = await SystemConfigService.getAllSettings()
    const configRecord: Record<string, string> = {}
    settings.forEach((s: any) => {
        configRecord[s.key] = s.value
    })
    return configRecord
}

export async function updateSystemConfig(data: {
    llmProvider?: string
    llmApiKey?: string
    llmModel?: string
    systemPrompt?: string
    tmdbApiKey?: string
    rawgApiKey?: string
    lastfmApiKey?: string
    resendApiKey?: string
    fromEmail?: string
    appUrl?: string
    googleBooksApiKey?: string
    spotifyClientId?: string
    spotifyClientSecret?: string
    comicVineApiKey?: string
    bggApiKey?: string
    tmdbApiUrl?: string
    rawgApiUrl?: string
    googleBooksApiUrl?: string
    spotifyApiUrl?: string
    anilistApiUrl?: string
    comicVineApiUrl?: string
    bggApiUrl?: string
    itunesApiUrl?: string
    metronUsername?: string
    metronPassword?: string
    featureAiCritic?: string
    featureSmartSort?: string
    featureRecommendations?: string
    featureChallenges?: string
    voyageApiKey?: string
    steamGridApiKey?: string

    omdbApiKey?: string
    twitchClientId?: string
    twitchClientSecret?: string
}) {
    const session = await assertAdmin()
    console.log('[Admin] updateSystemConfig called by user:', session.user.id)
    console.log('[Admin] Saving settings:', Object.keys(data).filter(k => data[k as keyof typeof data]))

    const upsertSetting = async (key: string, value: string, category: string, isSecret: boolean) => {
        if (!value) return
        if (value.includes('•') || value.includes('*')) return
        await SystemConfigService.updateSetting(key, value, category, isSecret)
    }

    // LLM Settings
    if (data.llmProvider) await upsertSetting('llm_provider', data.llmProvider, 'LLM', false)
    if (data.llmApiKey) await upsertSetting('llm_api_key', data.llmApiKey, 'LLM', true)
    if (data.llmModel) await upsertSetting('llm_model', data.llmModel, 'LLM', false)
    if (data.systemPrompt) await upsertSetting('system_prompt', data.systemPrompt, 'LLM', false)

    // Media API Keys
    if (data.tmdbApiKey) await upsertSetting('tmdb_api_key', data.tmdbApiKey, 'MEDIA', true)
    if (data.rawgApiKey) await upsertSetting('rawg_api_key', data.rawgApiKey, 'MEDIA', true)
    if (data.googleBooksApiKey) await upsertSetting('google_books_api_key', data.googleBooksApiKey, 'MEDIA', true)
    if (data.spotifyClientId) await upsertSetting('spotify_client_id', data.spotifyClientId, 'MEDIA', true)
    if (data.spotifyClientSecret) await upsertSetting('spotify_client_secret', data.spotifyClientSecret, 'MEDIA', true)
    if (data.comicVineApiKey) await upsertSetting('comicvine_api_key', data.comicVineApiKey, 'MEDIA', true)
    if (data.bggApiKey) await upsertSetting('bgg_api_key', data.bggApiKey, 'MEDIA', true)
    if (data.metronUsername) await upsertSetting('metron_username', data.metronUsername, 'MEDIA', false)
    if (data.metronPassword) await upsertSetting('metron_password', data.metronPassword, 'MEDIA', true)
    if (data.omdbApiKey) await upsertSetting('omdb_api_key', data.omdbApiKey, 'MEDIA', true)

    // Email Settings
    if (data.resendApiKey !== undefined) await upsertSetting('resend_api_key', data.resendApiKey, 'EMAIL', true)
    if (data.appUrl !== undefined) await upsertSetting('public_app_url', data.appUrl, 'GENERAL', false)
    if (data.fromEmail) await upsertSetting('resend_from_email', data.fromEmail, 'EMAIL', false)

    // Twitch / IGDB
    if (data.twitchClientId) await upsertSetting('twitch_client_id', data.twitchClientId, 'MEDIA', true)
    if (data.twitchClientSecret) await upsertSetting('twitch_client_secret', data.twitchClientSecret, 'MEDIA', true)


    // Voyage AI (Embeddings)
    if (data.voyageApiKey) await upsertSetting('voyage_api_key', data.voyageApiKey, 'EMBEDDINGS', true)

    // SteamGridDB
    if (data.steamGridApiKey) await upsertSetting('STEAMGRIDDB_API_KEY', data.steamGridApiKey, 'MEDIA', true)

    // Feature Flags
    if (data.featureAiCritic !== undefined) await upsertSetting('feature_ai_critic', data.featureAiCritic, 'FEATURE', false)
    if (data.featureSmartSort !== undefined) await upsertSetting('feature_smart_sort', data.featureSmartSort, 'FEATURE', false)
    if (data.featureRecommendations !== undefined) await upsertSetting('feature_recommendations', data.featureRecommendations, 'FEATURE', false)
    if (data.featureChallenges !== undefined) await upsertSetting('feature_challenges', data.featureChallenges, 'FEATURE', false)

    revalidatePath('/admin')
    return { success: true }
}

export async function sendTestEmailAction() {
    const session = await assertAdmin()
    const { EmailService } = await import('@/lib/services/EmailService')
    await EmailService.sendTestEmail(session.user.email!)
    return { success: true }
}

export async function testLLMConnectionAction(data: {
    provider: string
    apiKey: string
    model: string
}) {
    await assertAdmin()

    let apiKey = data.apiKey

    if (!apiKey || apiKey.includes('********')) {
        const realKey = await SystemConfigService.getDecryptedConfig('llm_api_key')
        if (!realKey) {
            return { success: false, error: "No API key found and none provided." }
        }
        apiKey = realKey
    }

    const { testLLMConnection } = await import('@/lib/llm')
    const result = await testLLMConnection(data.provider, apiKey, data.model || undefined, undefined)

    if (!result.success) {
        return { success: false, error: result.message }
    }

    return { success: true, message: result.message }
}

// --- User Management ---

export async function setPasswordAction(password: string) {
    const session = await getSession()
    if (!session) throw new Error("Unauthorized")

    const supabase = await createClient()

    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw new Error(error.message)

    revalidatePath('/settings')
    return { success: true }
}

// --- User List & Management ---

export type AdminUserData = {
    id: string
    name: string
    email: string
    image: string | null
    role: string
    isLockedOut: boolean
    createdAt: string
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
    const supabase = await createClient()

    const page = options?.page || 1
    const limit = options?.limit || 10
    const offset = (page - 1) * limit
    const search = options?.search?.trim()

    let query = supabase
        .from('profiles')
        .select('id, name, email, image, role, is_locked_out, created_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

    if (search) {
        query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`)
    }

    const { data: userList, count, error } = await query

    if (error) throw error

    return {
        users: ((userList as any[]) || []).map(u => ({
            id: u.id,
            name: u.name || '',
            email: u.email || '',
            image: u.image,
            role: u.role || 'USER',
            isLockedOut: u.is_locked_out || false,
            createdAt: u.created_at
        })),
        total: count || 0,
        page,
        totalPages: Math.ceil((count || 0) / limit),
    }
}

export async function toggleUserRole(userId: string): Promise<{ success: boolean; error?: string; newRole?: string }> {
    const session = await assertAdmin()
    const supabase = await createClient()

    if (session.user.id === userId) {
        return { success: false, error: "You cannot change your own role" }
    }

    try {
        const { data: user } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single()

        if (!user) {
            return { success: false, error: "User not found" }
        }

        const newRole = (user as any).role === 'ADMIN' ? 'USER' : 'ADMIN'

        await (supabase.from('profiles') as any)
            .update({ role: newRole })
            .eq('id', userId)

        revalidatePath('/admin')
        return { success: true, newRole }
    } catch (error: any) {
        console.error("Toggle role error:", error)
        return { success: false, error: error.message || "Failed to update role" }
    }
}

export async function toggleUserBan(userId: string): Promise<{ success: boolean; error?: string; isBanned?: boolean }> {
    const session = await assertAdmin()
    const supabase = await createClient()

    if (session.user.id === userId) {
        return { success: false, error: "You cannot ban yourself" }
    }

    try {
        const { data: user } = await supabase
            .from('profiles')
            .select('is_locked_out')
            .eq('id', userId)
            .single()

        if (!user) {
            return { success: false, error: "User not found" }
        }

        const newStatus = !(user as any).is_locked_out

        await (supabase.from('profiles') as any)
            .update({ is_locked_out: newStatus })
            .eq('id', userId)

        revalidatePath('/admin')
        return { success: true, isBanned: newStatus }
    } catch (error: any) {
        console.error("Toggle ban error:", error)
        return { success: false, error: error.message || "Failed to update user status" }
    }
}

export async function deleteUser(userId: string): Promise<{ success: boolean; error?: string }> {
    const session = await assertAdmin()
    const supabase = await createClient()

    if (session.user.id === userId) {
        return { success: false, error: "You cannot delete yourself" }
    }

    try {
        const { data: user } = await supabase
            .from('profiles')
            .select('id, role')
            .eq('id', userId)
            .single()

        if (!user) {
            return { success: false, error: "User not found" }
        }

        if ((user as any).role === 'ADMIN') {
            return { success: false, error: "Cannot delete admin users. Demote first." }
        }

        await (supabase.from('profiles') as any).delete().eq('id', userId)

        revalidatePath('/admin')
        return { success: true }
    } catch (error: any) {
        console.error("Delete user error:", error)
        return { success: false, error: error.message || "Failed to delete user" }
    }
}

export async function testServiceConnection(data: {
    service: 'tmdb' | 'twitch' | 'googlebooks' | 'spotify' | 'resend' | 'comicvine' | 'bgg' | 'metron' | 'omdb' | 'steamgrid'
    apiKey: string
    clientSecret?: string  // Optional: for Spotify / Metron Password
}) {
    await assertAdmin();
    console.log(`[ServiceTest] Testing ${data.service} connection...`);

    let apiKey = data.apiKey
    let clientSecret = ''

    if (!apiKey || apiKey.includes('********')) {
        const keyMap: any = {
            tmdb: 'tmdb_api_key',
            twitch: 'twitch_client_id',
            googlebooks: 'google_books_api_key',
            spotify: 'spotify_client_id',
            resend: 'resend_api_key',
            comicvine: 'comicvine_api_key',
            bgg: 'bgg_api_key',
            metron: 'metron_username',
            omdb: 'omdb_api_key',
            steamgrid: 'STEAMGRIDDB_API_KEY'
        }
        const realKey = await SystemConfigService.getDecryptedConfig(keyMap[data.service])
        if (!realKey) throw new Error(`No API key found for ${data.service} and none provided.`)
        apiKey = realKey
    }

    if (data.service === 'spotify' || data.service === 'twitch') {
        // Use provided clientSecret first, otherwise fetch from DB
        clientSecret = data.clientSecret || '';
        if (!clientSecret || clientSecret.includes('********')) {
            const secretKey = data.service === 'spotify' ? 'spotify_client_secret' : 'twitch_client_secret';
            clientSecret = await SystemConfigService.getDecryptedConfig(secretKey as any) || '';
        }
        if (!clientSecret) {
            console.error(`[ServiceTest] ${data.service} Client Secret is missing`);
            throw new Error(`${data.service} Client Secret is missing. Save your settings first, then test.`);
        }
    }

    try {
        switch (data.service) {
            case 'tmdb': {
                const res = await fetch(`https://api.themoviedb.org/3/movie/550?api_key=${apiKey}`)
                if (!res.ok) {
                    const error = await res.json()
                    throw new Error(error.status_message || 'TMDB Verification Failed')
                }
                return { success: true, message: "TMDB: Connection Verified" }
            }
            case 'twitch': {
                const url = `https://id.twitch.tv/oauth2/token?client_id=${apiKey}&client_secret=${clientSecret}&grant_type=client_credentials`;
                const res = await fetch(url, { method: 'POST' });

                if (!res.ok) {
                    const error = await res.json()
                    throw new Error(`Auth Failed: ${error.message || res.statusText}`)
                }
                const data = await res.json()
                if (!data.access_token) throw new Error('No access token received')

                // Optional: Verify token works with IGDB
                const igdbRes = await fetch('https://api.igdb.com/v4/games', {
                    method: 'POST',
                    headers: {
                        'Client-ID': apiKey,
                        'Authorization': `Bearer ${data.access_token}`,
                        'Content-Type': 'text/plain'
                    },
                    body: 'fields name; limit 1;'
                });

                if (!igdbRes.ok) throw new Error('IGDB API check failed');

                return { success: true, message: "Twitch/IGDB: Connection Verified" }
            }
            case 'resend': {
                const res = await fetch('https://api.resend.com/api-keys', {
                    headers: { 'Authorization': `Bearer ${apiKey}` }
                })
                if (!res.ok) {
                    const error = await res.json()
                    throw new Error(error.message || 'Resend Verification Failed')
                }
                return { success: true, message: "Resend: Connection Verified" }
            }
            case 'googlebooks': {
                const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=harry+potter&key=${apiKey}&maxResults=1`)
                if (!res.ok) {
                    const error = await res.json()
                    throw new Error(error.error?.message || 'Google Books Verification Failed')
                }
                return { success: true, message: "Google Books: Connection Verified" }
            }
            case 'spotify': {
                const authString = Buffer.from(`${apiKey}:${clientSecret}`).toString('base64')
                const res = await fetch('https://accounts.spotify.com/api/token', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Basic ${authString}`,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: new URLSearchParams({ grant_type: 'client_credentials' })
                })
                if (!res.ok) {
                    const error = await res.json()
                    throw new Error(error.error_description || 'Spotify Verification Failed')
                }
                return { success: true, message: "Spotify: Connection Verified" }
            }
            case 'comicvine': {
                const res = await fetch(`https://comicvine.gamespot.com/api/search/?api_key=${apiKey}&format=json&query=batman&resources=character&limit=1`)
                if (!res.ok) throw new Error('ComicVine: API Key Invalid')
                const jsonData = await res.json()
                if (jsonData.error === 'OK') return { success: true, message: "ComicVine: Connection Verified" }
                throw new Error(jsonData.error || 'ComicVine Verification Failed')
            }
            case 'bgg': {
                if (!apiKey) throw new Error('BGG: Please provide an API key')
                return { success: true, message: `BGG: API key configured` }
            }
            case 'metron': {
                // For Metron: apiKey = username, clientSecret = password
                const password = clientSecret || await SystemConfigService.getDecryptedConfig('metron_password');
                if (!password) throw new Error('Metron Password is required');

                const headers = {
                    'Authorization': 'Basic ' + Buffer.from(apiKey + ":" + password).toString('base64')
                };

                // Test search for "Batman"
                const res = await fetch(`https://metron.cloud/api/series/?name=batman`, { headers });

                if (!res.ok) {
                    if (res.status === 401 || res.status === 403) throw new Error('Metron: Invalid Credentials');
                    throw new Error(`Metron Error: ${res.statusText}`);
                }
                return { success: true, message: "Metron: Connection Verified" }
            }
            case 'omdb': {
                const res = await fetch(`https://www.omdbapi.com/?apikey=${apiKey}&t=Inception`)
                if (!res.ok) throw new Error('OMDB Request Failed')
                const jsonData = await res.json()
                if (jsonData.Response === 'False') throw new Error(jsonData.Error || 'OMDB API Key Invalid')
                return { success: true, message: "OMDB: Connection Verified" }
            }
            case 'steamgrid': {
                const res = await fetch('https://www.steamgriddb.com/api/v2/search/autocomplete/portal', {
                    headers: { 'Authorization': `Bearer ${apiKey}` }
                })
                if (!res.ok) {
                    if (res.status === 401 || res.status === 403) throw new Error('SteamGridDB: Invalid API Key');
                    throw new Error(`SteamGridDB Error: ${res.status} ${res.statusText}`);
                }
                const data = await res.json();
                if (!data.success) throw new Error('SteamGridDB: API returned failure');
                return { success: true, message: "SteamGridDB: Connection Verified" }
            }
            default:
                throw new Error('Unsupported service')
        }
    } catch (error: any) {
        console.error(`${data.service} Test Error:`, error)
        return { success: false, error: error.message || 'Verification Failed' }
    }
}

// --- Email Templates ---

export async function getEmailTemplates() {
    await assertAdmin()
    const supabase = await createClient()

    const { data: templates } = await supabase
        .from('email_templates')
        .select('*')
        .order('name', { ascending: true })

    // Auto-seed if missing (simplified)
    if (!(templates as any[])?.find((t: any) => t.name === 'password-reset')) {
        try {
            const html = await render(ResetPasswordEmail({
                resetLink: '{{resetLink}}',
                userEmail: '{{userEmail}}'
            }) as ReactElement)

            await (supabase.from('email_templates') as any).insert({
                name: 'password-reset',
                subject: 'Reset your password',
                body_html: html,
                variables: JSON.stringify(['resetLink', 'userEmail'])
            } as any)
        } catch (e) {
            console.error("Failed to seed password-reset template:", e)
        }
    }

    if (!(templates as any[])?.find((t: any) => t.name === 'verify-email')) {
        try {
            const html = await render(VerifyEmail({
                verifyLink: '{{verifyLink}}',
                userEmail: '{{userEmail}}'
            }) as ReactElement)

            await (supabase.from('email_templates') as any).insert({
                name: 'verify-email',
                subject: 'Verify your email address',
                body_html: html,
                variables: JSON.stringify(['verifyLink', 'userEmail'])
            } as any)
        } catch (e) {
            console.error("Failed to seed verify-email template:", e)
        }
    }

    const { data: finalTemplates } = await supabase
        .from('email_templates')
        .select('*')
        .order('name', { ascending: true })

    return (finalTemplates as any[]) || []
}

export async function updateEmailTemplate(id: string, data: { subject: string; bodyHtml: string }) {
    await assertAdmin()
    const supabase = await createClient()

    await (supabase.from('email_templates') as any)
        .update({
            subject: data.subject,
            body_html: data.bodyHtml,
            last_updated: new Date().toISOString()
        } as any)
        .eq('id', id)

    revalidatePath('/admin')
    return { success: true }
}

// =============================================================================
// Collection Cleanup
// =============================================================================

export async function clearUserCollections(userId?: string): Promise<{ success: boolean; error?: string; deleted?: number }> {
    await assertAdmin()
    const supabase = await createClient()

    const defaultCategoryNames = DEFAULT_CATEGORIES.map(c => c.name)

    try {
        // Get categories to delete
        let query = supabase.from('categories').select('id, name')

        if (userId) {
            query = query.eq('user_id', userId)
        }


        const { data: allCategories } = await query

        const toDelete = ((allCategories as any[]) || []).filter(c => !defaultCategoryNames.includes(c.name))
        const toDeleteIds = toDelete.map(c => c.id)

        if (toDeleteIds.length > 0) {
            await supabase.from('categories').delete().in('id', toDeleteIds)
        }

        revalidatePath('/')
        revalidatePath('/admin')

        return {
            success: true,
            deleted: toDeleteIds.length
        }
    } catch (error: any) {
        console.error('Clear collections error:', error)
        return { success: false, error: error.message || 'Failed to clear collections' }
    }
}
// --- Content Matching Wizard ---

export async function getBrokenGlobalItems(limit: number = 50) {
    await assertAdmin()
    const supabase = await createClient()

    // Fetch items with missing image OR missing description
    const { data, error } = await supabase
        .from('global_items')
        .select(`
            id, title, description, image_url, release_year, external_id,
            items (count)
        `)
        .or('image_url.is.null,image_url.eq.,description.is.null,description.eq.')
        .order('created_at', { ascending: false })
        .limit(limit)

    if (error) throw error

    return ((data as any[]) || []).map((item: any) => ({
        ...item,
        usersAffected: item.items?.[0]?.count || 0
    }))
}

export async function updateGlobalItem(id: string, updates: {
    title?: string,
    description?: string,
    image_url?: string,
    external_id?: string,
    release_year?: number,
    metadata?: any
}) {
    await assertAdmin()
    const supabase = await createClient()

    const { error } = await (supabase
        .from('global_items') as any)
        .update(updates)
        .eq('id', id)

    if (error) throw error

    // Revalidate paths that might show this item
    revalidatePath('/admin/wizard')
    revalidatePath('/')
    return { success: true }
}

export async function adminSearchMedia(query: string, type: string) {
    await assertAdmin()
    const { MediaService } = await import('@/lib/services/media/mediaService')
    const service = new MediaService()
    const settings = await SystemConfigService.getRawConfigMap()

    return await service.search(query, type, settings)
}
