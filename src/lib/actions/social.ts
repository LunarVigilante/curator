'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getSession, getCurrentUserId } from '@/lib/auth'
import { logActivity } from '@/lib/actions/activity'

export async function toggleFollow(targetUserId: string) {
    const session = await getSession()

    if (!session) {
        throw new Error("Unauthorized")
    }

    const currentUserId = session.user.id

    if (currentUserId === targetUserId) {
        throw new Error("Cannot follow yourself")
    }

    const supabase = await createClient()

    // Check if already following
    const { data: existing } = await (supabase.from('follows') as any)
        .select('*')
        .eq('follower_id', currentUserId)
        .eq('following_id', targetUserId)
        .single()

    if (existing) {
        // Unfollow
        await (supabase.from('follows') as any)
            .delete()
            .eq('follower_id', currentUserId)
            .eq('following_id', targetUserId)

        revalidatePath('/')
        return { isFollowing: false }
    } else {
        // Follow
        await (supabase.from('follows') as any).insert({
            follower_id: currentUserId,
            following_id: targetUserId,
        })

        // Log Activity
        const { data: targetUser } = await (supabase.from('profiles') as any)
            .select('name')
            .eq('id', targetUserId)
            .single()

        if (targetUser) {
            await logActivity(currentUserId, 'FOLLOWED_USER', { targetUserName: targetUser.name, targetUserId })
        }

        revalidatePath('/')
        return { isFollowing: true }
    }
}

export async function getFollowedUsers(userId: string) {
    const supabase = await createClient()

    const { data, error } = await (supabase.from('follows') as any)
        .select('following:profiles!follows_following_id_fkey(*)')
        .eq('follower_id', userId)

    if (error) throw error
    return (data || []).map((r: any) => r.following)
}

export async function isFollowingUser(followerId: string, targetUserId: string) {
    const supabase = await createClient()

    const { data } = await (supabase.from('follows') as any)
        .select('*')
        .eq('follower_id', followerId)
        .eq('following_id', targetUserId)
        .single()

    return !!data
}
