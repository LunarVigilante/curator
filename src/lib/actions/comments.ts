'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getCurrentUserId } from '@/lib/auth'

// ============================================================================
// Comment Types
// ============================================================================

export type Comment = {
    id: string
    content: string
    isCreatorReply: boolean
    createdAt: string
    user: {
        id: string
        name: string
        displayName: string | null
        image: string | null
    }
    replies?: Comment[]
}

export type CommentsPage = {
    comments: Comment[]
    totalCount: number
    hasMore: boolean
    page: number
}

// ============================================================================
// Comment Actions
// ============================================================================

export async function getCollectionComments(
    categoryId: string,
    page: number = 1,
    pageSize: number = 20
): Promise<CommentsPage> {
    const offset = (page - 1) * pageSize
    const supabase = await createClient()

    // Get category owner to mark creator replies
    const { data: category } = await (supabase.from('categories') as any)
        .select('user_id')
        .eq('id', categoryId)
        .single()

    const ownerId = category?.user_id

    // Get top-level comments (no parent)
    const { data: commentsData, count, error } = await (supabase.from('collection_comments') as any)
        .select(`
            id,
            content,
            is_creator_reply,
            created_at,
            user_id,
            user:profiles(id, name, display_name, image)
        `, { count: 'exact' })
        .eq('category_id', categoryId)
        .is('parent_id', null)
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1)

    if (error) throw error

    const totalCount = count || 0

    // Get replies for each comment
    const comments: Comment[] = await Promise.all(
        (commentsData || []).map(async (comment: any) => {
            const { data: repliesData } = await (supabase.from('collection_comments') as any)
                .select(`
                    id,
                    content,
                    is_creator_reply,
                    created_at,
                    user_id,
                    user:profiles(id, name, display_name, image)
                `)
                .eq('parent_id', comment.id)
                .order('created_at', { ascending: true })
                .limit(10)

            const replies: Comment[] = (repliesData || []).map((reply: any) => ({
                id: reply.id,
                content: reply.content,
                isCreatorReply: reply.is_creator_reply || reply.user_id === ownerId,
                createdAt: reply.created_at,
                user: {
                    id: reply.user?.id || reply.user_id,
                    name: reply.user?.name || 'Unknown',
                    displayName: reply.user?.display_name,
                    image: reply.user?.image,
                }
            }))

            return {
                id: comment.id,
                content: comment.content,
                isCreatorReply: comment.is_creator_reply || comment.user_id === ownerId,
                createdAt: comment.created_at,
                user: {
                    id: comment.user?.id || comment.user_id,
                    name: comment.user?.name || 'Unknown',
                    displayName: comment.user?.display_name,
                    image: comment.user?.image,
                },
                replies: replies.length > 0 ? replies : undefined,
            }
        })
    )

    return {
        comments,
        totalCount,
        hasMore: offset + pageSize < totalCount,
        page,
    }
}

export async function addCollectionComment(
    categoryId: string,
    content: string,
    parentId?: string
): Promise<{ success: boolean; error?: string; comment?: Comment }> {
    const userId = await getCurrentUserId()
    if (!userId) {
        return { success: false, error: 'Not authenticated' }
    }

    if (!content.trim()) {
        return { success: false, error: 'Comment cannot be empty' }
    }

    const supabase = await createClient()

    // Get category to check if user is owner
    const { data: category } = await (supabase.from('categories') as any)
        .select('user_id')
        .eq('id', categoryId)
        .single()

    if (!category) {
        return { success: false, error: 'Collection not found' }
    }

    const isCreatorReply = category.user_id === userId

    try {
        const { data: newComment, error } = await (supabase.from('collection_comments') as any)
            .insert({
                category_id: categoryId,
                user_id: userId,
                content: content.trim(),
                parent_id: parentId || null,
                is_creator_reply: isCreatorReply,
            })
            .select()
            .single()

        if (error) throw error

        // Get user info for return
        const { data: user } = await (supabase.from('profiles') as any)
            .select('id, name, display_name, image')
            .eq('id', userId)
            .single()

        revalidatePath(`/categories/${categoryId}`)

        return {
            success: true,
            comment: {
                id: newComment.id,
                content: newComment.content,
                isCreatorReply: newComment.is_creator_reply,
                createdAt: newComment.created_at,
                user: {
                    id: user!.id,
                    name: user!.name || 'Unknown',
                    displayName: user!.display_name,
                    image: user!.image,
                }
            }
        }
    } catch (error) {
        console.error('Failed to add comment:', error)
        return { success: false, error: 'Failed to add comment' }
    }
}

export async function deleteComment(commentId: string): Promise<{ success: boolean; error?: string }> {
    const userId = await getCurrentUserId()
    if (!userId) {
        return { success: false, error: 'Not authenticated' }
    }

    const supabase = await createClient()

    const { data: comment } = await (supabase.from('collection_comments') as any)
        .select('user_id, category_id')
        .eq('id', commentId)
        .single()

    if (!comment) {
        return { success: false, error: 'Comment not found' }
    }

    // Check if user is comment owner or category owner
    const { data: category } = await (supabase.from('categories') as any)
        .select('user_id')
        .eq('id', comment.category_id)
        .single()

    if (comment.user_id !== userId && category?.user_id !== userId) {
        return { success: false, error: 'Not authorized to delete this comment' }
    }

    try {
        // Delete comment and all replies
        await (supabase.from('collection_comments') as any).delete().eq('parent_id', commentId)
        await (supabase.from('collection_comments') as any).delete().eq('id', commentId)

        revalidatePath(`/categories/${comment.category_id}`)
        return { success: true }
    } catch (error) {
        console.error('Failed to delete comment:', error)
        return { success: false, error: 'Failed to delete comment' }
    }
}

export async function editComment(
    commentId: string,
    content: string
): Promise<{ success: boolean; error?: string }> {
    const userId = await getCurrentUserId()
    if (!userId) {
        return { success: false, error: 'Not authenticated' }
    }

    if (!content.trim()) {
        return { success: false, error: 'Comment cannot be empty' }
    }

    const supabase = await createClient()

    const { data: comment } = await (supabase.from('collection_comments') as any)
        .select('user_id, category_id')
        .eq('id', commentId)
        .single()

    if (!comment || comment.user_id !== userId) {
        return { success: false, error: 'Comment not found or not authorized' }
    }

    try {
        await (supabase.from('collection_comments') as any)
            .update({ content: content.trim(), updated_at: new Date().toISOString() })
            .eq('id', commentId)

        revalidatePath(`/categories/${comment.category_id}`)
        return { success: true }
    } catch (error) {
        console.error('Failed to edit comment:', error)
        return { success: false, error: 'Failed to edit comment' }
    }
}
