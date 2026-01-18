'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getCurrentUserId } from '@/lib/auth'

// ============================================================================
// Profile Types
// ============================================================================

export type PublicProfile = {
    id: string
    name: string
    displayName: string | null
    bio: string | null
    image: string | null
    coverImage: string | null
    isPublic: boolean
    profileViews: number
    createdAt: string
    topPicks: {
        id: string
        name: string
        image: string | null
        tier: string | null
        categoryName: string | null
    }[]
    stats: {
        totalItems: number
        totalCollections: number
        followerCount: number
    }
}

// ============================================================================
// Profile Actions
// ============================================================================

export async function getMyProfile() {
    const userId = await getCurrentUserId()
    if (!userId) return null

    const supabase = await createClient()

    const { data: user, error } = await (supabase.from('profiles') as any)
        .select('id, name, display_name, bio, image, cover_image, is_public, email')
        .eq('id', userId)
        .single()

    if (error || !user) return null

    return {
        id: user.id,
        name: user.name,
        displayName: user.display_name,
        bio: user.bio,
        image: user.image,
        coverImage: user.cover_image,
        isPublic: user.is_public,
        email: user.email
    }
}

export async function updateProfile(data: {
    displayName?: string
    bio?: string
    isPublic?: boolean
    image?: string
    coverImage?: string
}): Promise<{ success: boolean; error?: string }> {
    const userId = await getCurrentUserId()
    if (!userId) {
        return { success: false, error: 'Not authenticated' }
    }

    const supabase = await createClient()

    try {
        const { error } = await (supabase.from('profiles') as any)
            .update({
                display_name: data.displayName,
                bio: data.bio,
                is_public: data.isPublic,
                image: data.image,
                cover_image: data.coverImage,
                updated_at: new Date().toISOString()
            })
            .eq('id', userId)

        if (error) throw error

        revalidatePath('/profile')
        revalidatePath(`/profile/${userId}`)
        return { success: true }
    } catch (error) {
        console.error('Failed to update profile:', error)
        return { success: false, error: 'Failed to update profile' }
    }
}

export async function updateUsername(name: string): Promise<{ success: boolean; error?: string }> {
    if (!name || name.trim().length < 2) {
        return { success: false, error: 'Name must be at least 2 characters' }
    }

    const userId = await getCurrentUserId()
    if (!userId) {
        return { success: false, error: 'Not authenticated' }
    }

    const supabase = await createClient()

    try {
        const { error } = await (supabase.from('profiles') as any)
            .update({ name: name.trim(), updated_at: new Date().toISOString() })
            .eq('id', userId)

        if (error) throw error

        revalidatePath('/settings')
        revalidatePath('/profile')
        return { success: true }
    } catch (error) {
        console.error('Failed to update username:', error)
        return { success: false, error: 'Failed to update name' }
    }
}

export async function requestEmailChange(newEmail: string): Promise<{ success: boolean; error?: string }> {
    if (!newEmail || !newEmail.includes('@')) {
        return { success: false, error: 'Please enter a valid email address' }
    }

    const supabase = await createClient()

    // Supabase Auth handles email change directly
    const { error } = await supabase.auth.updateUser({ email: newEmail })

    if (error) {
        return { success: false, error: error.message }
    }

    return { success: true }
}

export async function confirmEmailChange(_code: string): Promise<{ success: boolean; error?: string }> {
    // Supabase handles email confirmation via magic links, not codes
    return { success: false, error: 'Email confirmation is handled via the link sent to your email' }
}

export async function cancelEmailChange(): Promise<{ success: boolean; error?: string }> {
    // Not applicable with Supabase Auth
    return { success: true }
}

export async function getPublicProfile(userId: string): Promise<PublicProfile | null> {
    const supabase = await createClient()

    const { data: user, error } = await (supabase.from('profiles') as any)
        .select('id, name, display_name, bio, image, cover_image, is_public, profile_views, created_at')
        .eq('id', userId)
        .single()

    if (error || !user) return null

    const currentUserId = await getCurrentUserId()
    if (!user.is_public && currentUserId !== userId) {
        return null
    }

    // Get top picks with item details
    const { data: topPicksData } = await (supabase.from('user_top_picks') as any)
        .select(`
            item:items(
                id,
                name,
                image,
                tier,
                global_item:global_items(title, image_url),
                category:categories(name)
            )
        `)
        .eq('user_id', userId)
        .order('sort_order', { ascending: true })
        .limit(3)

    // Get stats
    const { count: itemCount } = await (supabase.from('items') as any)
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)

    const { count: collectionCount } = await (supabase.from('categories') as any)
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)

    // Increment view count if not viewing own profile
    if (currentUserId !== userId) {
        await (supabase.from('profiles') as any)
            .update({ profile_views: (user.profile_views || 0) + 1 })
            .eq('id', userId)
    }

    const topPicks = (topPicksData || []).map((pick: any) => ({
        id: pick.item?.id || '',
        name: pick.item?.global_item?.title || pick.item?.name || 'Untitled',
        image: pick.item?.global_item?.image_url || pick.item?.image,
        tier: pick.item?.tier,
        categoryName: pick.item?.category?.name || null,
    }))

    return {
        id: user.id,
        name: user.name || '',
        displayName: user.display_name,
        bio: user.bio,
        image: user.image,
        coverImage: user.cover_image,
        isPublic: user.is_public,
        profileViews: user.profile_views || 0,
        createdAt: user.created_at,
        topPicks,
        stats: {
            totalItems: itemCount || 0,
            totalCollections: collectionCount || 0,
            followerCount: 0,
        }
    }
}

export async function getUserPublicCollections(userId: string) {
    const supabase = await createClient()

    const { data: collections, error } = await (supabase.from('categories') as any)
        .select('id, name, image, description, items(id)')
        .eq('user_id', userId)
        .eq('is_public', true)
        .order('created_at', { ascending: false })

    if (error) throw error

    return (collections || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        image: c.image,
        description: c.description,
        itemCount: c.items?.length || 0
    }))
}

// ============================================================================
// Top Picks Actions
// ============================================================================

export async function getMyTopPicks() {
    const userId = await getCurrentUserId()
    if (!userId) return []

    const supabase = await createClient()

    const { data, error } = await (supabase.from('user_top_picks') as any)
        .select(`
            id,
            sort_order,
            item:items(
                id,
                name,
                image,
                tier,
                global_item:global_items(title, image_url)
            )
        `)
        .eq('user_id', userId)
        .order('sort_order', { ascending: true })

    if (error) throw error

    return (data || []).map((pick: any) => ({
        id: pick.id,
        itemId: pick.item?.id,
        name: pick.item?.global_item?.title || pick.item?.name || 'Untitled',
        image: pick.item?.global_item?.image_url || pick.item?.image,
        tier: pick.item?.tier,
        sortOrder: pick.sort_order,
    }))
}

export async function getMyItemsForTopPicks() {
    const userId = await getCurrentUserId()
    if (!userId) return []

    const supabase = await createClient()

    // Get current top pick item IDs
    const { data: currentPicks } = await (supabase.from('user_top_picks') as any)
        .select('item_id')
        .eq('user_id', userId)

    const pickedItemIds = (currentPicks || []).map((p: any) => p.item_id)

    // Get all user items with category info
    const { data: userItems, error } = await (supabase.from('items') as any)
        .select(`
            id,
            name,
            image,
            tier,
            global_item:global_items(title, image_url),
            category:categories(name)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

    if (error) throw error

    return (userItems || [])
        .filter((item: any) => !pickedItemIds.includes(item.id))
        .map((item: any) => ({
            id: item.id,
            name: item.global_item?.title || item.name,
            image: item.global_item?.image_url || item.image,
            tier: item.tier,
            categoryName: item.category?.name || null
        }))
}

export async function addTopPick(itemId: string): Promise<{ success: boolean; error?: string }> {
    const userId = await getCurrentUserId()
    if (!userId) {
        return { success: false, error: 'Not authenticated' }
    }

    const supabase = await createClient()

    // Check current count
    const { count: existingCount } = await (supabase.from('user_top_picks') as any)
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)

    if ((existingCount || 0) >= 3) {
        return { success: false, error: 'Maximum 3 top picks allowed. Remove one first.' }
    }

    // Check if item already in top picks
    const { data: alreadyPicked } = await (supabase.from('user_top_picks') as any)
        .select('id')
        .eq('user_id', userId)
        .eq('item_id', itemId)
        .single()

    if (alreadyPicked) {
        return { success: false, error: 'Item already in top picks' }
    }

    // Verify item belongs to user
    const { data: item } = await (supabase.from('items') as any)
        .select('id')
        .eq('id', itemId)
        .eq('user_id', userId)
        .single()

    if (!item) {
        return { success: false, error: 'Item not found or not owned by you' }
    }

    try {
        const { error } = await (supabase.from('user_top_picks') as any).insert({
            user_id: userId,
            item_id: itemId,
            sort_order: existingCount || 0,
        })

        if (error) throw error

        revalidatePath('/profile')
        return { success: true }
    } catch (error) {
        console.error('Failed to add top pick:', error)
        return { success: false, error: 'Failed to add top pick' }
    }
}

export async function removeTopPick(itemId: string): Promise<{ success: boolean; error?: string }> {
    const userId = await getCurrentUserId()
    if (!userId) {
        return { success: false, error: 'Not authenticated' }
    }

    const supabase = await createClient()

    try {
        await (supabase.from('user_top_picks') as any)
            .delete()
            .eq('user_id', userId)
            .eq('item_id', itemId)

        // Reorder remaining picks
        const { data: remaining } = await (supabase.from('user_top_picks') as any)
            .select('id')
            .eq('user_id', userId)
            .order('sort_order', { ascending: true })

        for (let i = 0; i < (remaining || []).length; i++) {
            await (supabase.from('user_top_picks') as any)
                .update({ sort_order: i })
                .eq('id', remaining![i].id)
        }

        revalidatePath('/profile')
        return { success: true }
    } catch (error) {
        console.error('Failed to remove top pick:', error)
        return { success: false, error: 'Failed to remove top pick' }
    }
}

export async function reorderTopPicks(itemIds: string[]): Promise<{ success: boolean; error?: string }> {
    const userId = await getCurrentUserId()
    if (!userId) {
        return { success: false, error: 'Not authenticated' }
    }

    if (itemIds.length > 3) {
        return { success: false, error: 'Maximum 3 top picks allowed' }
    }

    const supabase = await createClient()

    try {
        for (let i = 0; i < itemIds.length; i++) {
            await (supabase.from('user_top_picks') as any)
                .update({ sort_order: i })
                .eq('user_id', userId)
                .eq('item_id', itemIds[i])
        }

        revalidatePath('/profile')
        return { success: true }
    } catch (error) {
        console.error('Failed to reorder top picks:', error)
        return { success: false, error: 'Failed to reorder top picks' }
    }
}
