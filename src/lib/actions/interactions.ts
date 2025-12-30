'use server'

import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'

/**
 * Toggle Like on a collection (public upvote)
 */
export async function toggleLike(categoryId: string) {
    const session = await getSession()
    if (!session?.user?.id) {
        return { success: false, error: 'Not authenticated' }
    }

    const userId = session.user.id
    const supabase = await createClient()

    // Check if already liked
    const { data: existing } = await (supabase.from('collection_likes') as any)
        .select('*')
        .eq('user_id', userId)
        .eq('category_id', categoryId)
        .single()

    if (existing) {
        // Remove like
        await (supabase.from('collection_likes') as any)
            .delete()
            .eq('user_id', userId)
            .eq('category_id', categoryId)
        return { success: true, liked: false }
    } else {
        // Add like
        await (supabase.from('collection_likes') as any).insert({
            user_id: userId,
            category_id: categoryId
        })
        return { success: true, liked: true }
    }
}

/**
 * Toggle Save on a collection (private bookmark)
 */
export async function toggleSave(categoryId: string) {
    const session = await getSession()
    if (!session?.user?.id) {
        return { success: false, error: 'Not authenticated' }
    }

    const userId = session.user.id
    const supabase = await createClient()

    // Check if already saved
    const { data: existing } = await (supabase.from('collection_saves') as any)
        .select('*')
        .eq('user_id', userId)
        .eq('category_id', categoryId)
        .single()

    if (existing) {
        // Remove save
        await (supabase.from('collection_saves') as any)
            .delete()
            .eq('user_id', userId)
            .eq('category_id', categoryId)
        return { success: true, saved: false }
    } else {
        // Add save
        await (supabase.from('collection_saves') as any).insert({
            user_id: userId,
            category_id: categoryId
        })
        return { success: true, saved: true }
    }
}

/**
 * Get like count for a collection
 */
export async function getLikeCount(categoryId: string) {
    const supabase = await createClient()

    const { count } = await (supabase.from('collection_likes') as any)
        .select('*', { count: 'exact', head: true })
        .eq('category_id', categoryId)

    return count || 0
}

/**
 * Get save count for a collection
 */
export async function getSaveCount(categoryId: string) {
    const supabase = await createClient()

    const { count } = await (supabase.from('collection_saves') as any)
        .select('*', { count: 'exact', head: true })
        .eq('category_id', categoryId)

    return count || 0
}

/**
 * Check if current user has liked/saved a collection
 */
export async function getInteractionStatus(categoryId: string) {
    const session = await getSession()
    if (!session?.user?.id) {
        return { liked: false, saved: false }
    }

    const userId = session.user.id
    const supabase = await createClient()

    const [{ data: likedResult }, { data: savedResult }] = await Promise.all([
        (supabase.from('collection_likes') as any)
            .select('*')
            .eq('user_id', userId)
            .eq('category_id', categoryId)
            .single(),
        (supabase.from('collection_saves') as any)
            .select('*')
            .eq('user_id', userId)
            .eq('category_id', categoryId)
            .single()
    ])

    return { liked: !!likedResult, saved: !!savedResult }
}

/**
 * Get batch interaction status for multiple collections (for Browse page)
 */
export async function getBatchInteractionStatus(categoryIds: string[]) {
    const session = await getSession()
    if (!session?.user?.id || categoryIds.length === 0) {
        return {}
    }

    const userId = session.user.id
    const supabase = await createClient()

    const [{ data: likes }, { data: saves }] = await Promise.all([
        (supabase.from('collection_likes') as any).select('category_id').eq('user_id', userId),
        (supabase.from('collection_saves') as any).select('category_id').eq('user_id', userId)
    ])

    const likedSet = new Set((likes || []).map((l: any) => l.category_id))
    const savedSet = new Set((saves || []).map((s: any) => s.category_id))

    const result: Record<string, { liked: boolean; saved: boolean }> = {}
    for (const id of categoryIds) {
        result[id] = {
            liked: likedSet.has(id),
            saved: savedSet.has(id)
        }
    }
    return result
}

/**
 * Get saved collections (bookmarks) for current user
 */
export async function getSavedCollections() {
    const session = await getSession()
    if (!session?.user?.id) {
        return { data: [], error: 'Not authenticated' }
    }

    const userId = session.user.id
    const supabase = await createClient()

    const { data: saves } = await (supabase.from('collection_saves') as any)
        .select('category_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

    if (!saves || saves.length === 0) {
        return { data: [] }
    }

    const categoryIds = saves.map((s: any) => s.category_id)
    const { data: categoryData } = await (supabase.from('categories') as any)
        .select('*, owner:profiles(*), items(id)')
        .in('id', categoryIds)

    return { data: categoryData || [] }
}

/**
 * Get like counts for multiple collections
 */
export async function getBatchLikeCounts(categoryIds: string[]) {
    if (categoryIds.length === 0) return {}

    const supabase = await createClient()

    // Get all likes for these categories
    const { data: likes } = await (supabase.from('collection_likes') as any)
        .select('category_id')
        .in('category_id', categoryIds)

    // Count by category
    const result: Record<string, number> = {}
    for (const id of categoryIds) {
        result[id] = 0
    }
    for (const like of (likes || []) as any[]) {
        result[like.category_id] = (result[like.category_id] || 0) + 1
    }
    return result
}

/**
 * Get liked collections for current user
 */
export async function getLikedCollections() {
    const session = await getSession()
    if (!session?.user?.id) {
        return { data: [], error: 'Not authenticated' }
    }

    const userId = session.user.id
    const supabase = await createClient()

    const { data: likes } = await (supabase.from('collection_likes') as any)
        .select('category_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

    if (!likes || likes.length === 0) {
        return { data: [] }
    }

    const categoryIds = likes.map((l: any) => l.category_id)
    const { data: categoryData } = await (supabase.from('categories') as any)
        .select('*, owner:profiles(*), items(id)')
        .in('id', categoryIds)

    return { data: categoryData || [] }
}

/**
 * Get users the current user is following
 */
export async function getFollowing() {
    const session = await getSession()
    if (!session?.user?.id) {
        return { data: [], error: 'Not authenticated' }
    }

    const userId = session.user.id
    const supabase = await createClient()

    const { data: followList } = await (supabase.from('follows') as any)
        .select('following_id')
        .eq('follower_id', userId)
        .order('created_at', { ascending: false })

    if (!followList || followList.length === 0) {
        return { data: [] }
    }

    const followingIds = followList.map((f: any) => f.following_id)
    const { data: userData } = await (supabase.from('profiles') as any)
        .select('id, name, email, image, bio, created_at')
        .in('id', followingIds)

    return { data: userData || [] }
}
