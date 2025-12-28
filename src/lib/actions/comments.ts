'use server'

import { db } from '@/lib/db'
import { collectionComments, categories, users } from '@/db/schema'
import { eq, desc, and, isNull, sql } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

// ============================================================================
// Auth Helper
// ============================================================================

async function getCurrentUserId(): Promise<string | null> {
    const session = await auth.api.getSession({ headers: await headers() })
    return session?.user?.id || null
}

// ============================================================================
// Comment Types
// ============================================================================

export type Comment = {
    id: string
    content: string
    isCreatorReply: boolean
    createdAt: Date
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

/**
 * Get comments for a collection (paginated)
 */
export async function getCollectionComments(
    categoryId: string,
    page: number = 1,
    pageSize: number = 20
): Promise<CommentsPage> {
    const offset = (page - 1) * pageSize

    // Get category owner to mark creator replies
    const category = await db.query.categories.findFirst({
        where: eq(categories.id, categoryId),
        columns: { userId: true }
    })
    const ownerId = category?.userId

    // Get top-level comments (no parent)
    const commentsData = await db
        .select({
            id: collectionComments.id,
            content: collectionComments.content,
            isCreatorReply: collectionComments.isCreatorReply,
            createdAt: collectionComments.createdAt,
            userId: collectionComments.userId,
            userName: users.name,
            userDisplayName: users.displayName,
            userImage: users.image,
        })
        .from(collectionComments)
        .innerJoin(users, eq(collectionComments.userId, users.id))
        .where(and(
            eq(collectionComments.categoryId, categoryId),
            isNull(collectionComments.parentId)
        ))
        .orderBy(desc(collectionComments.createdAt))
        .limit(pageSize)
        .offset(offset)

    // Get total count
    const countResult = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(collectionComments)
        .where(and(
            eq(collectionComments.categoryId, categoryId),
            isNull(collectionComments.parentId)
        ))

    const totalCount = countResult[0]?.count || 0

    // Get replies for each comment
    const comments: Comment[] = await Promise.all(
        commentsData.map(async (comment) => {
            const repliesData = await db
                .select({
                    id: collectionComments.id,
                    content: collectionComments.content,
                    isCreatorReply: collectionComments.isCreatorReply,
                    createdAt: collectionComments.createdAt,
                    userId: collectionComments.userId,
                    userName: users.name,
                    userDisplayName: users.displayName,
                    userImage: users.image,
                })
                .from(collectionComments)
                .innerJoin(users, eq(collectionComments.userId, users.id))
                .where(eq(collectionComments.parentId, comment.id))
                .orderBy(collectionComments.createdAt)
                .limit(10) // Limit replies shown

            const replies: Comment[] = repliesData.map(reply => ({
                id: reply.id,
                content: reply.content,
                isCreatorReply: reply.isCreatorReply || reply.userId === ownerId,
                createdAt: reply.createdAt,
                user: {
                    id: reply.userId,
                    name: reply.userName,
                    displayName: reply.userDisplayName,
                    image: reply.userImage,
                }
            }))

            return {
                id: comment.id,
                content: comment.content,
                isCreatorReply: comment.isCreatorReply || comment.userId === ownerId,
                createdAt: comment.createdAt,
                user: {
                    id: comment.userId,
                    name: comment.userName,
                    displayName: comment.userDisplayName,
                    image: comment.userImage,
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

/**
 * Add a comment to a collection
 */
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

    // Get category to check if user is owner
    const category = await db.query.categories.findFirst({
        where: eq(categories.id, categoryId),
        columns: { userId: true }
    })

    if (!category) {
        return { success: false, error: 'Collection not found' }
    }

    const isCreatorReply = category.userId === userId

    try {
        const [newComment] = await db.insert(collectionComments)
            .values({
                categoryId,
                userId,
                content: content.trim(),
                parentId: parentId || null,
                isCreatorReply,
            })
            .returning()

        // Get user info for return
        const user = await db.query.users.findFirst({
            where: eq(users.id, userId),
            columns: { id: true, name: true, displayName: true, image: true }
        })

        revalidatePath(`/categories/${categoryId}`)

        return {
            success: true,
            comment: {
                id: newComment.id,
                content: newComment.content,
                isCreatorReply: newComment.isCreatorReply,
                createdAt: newComment.createdAt,
                user: {
                    id: user!.id,
                    name: user!.name,
                    displayName: user!.displayName,
                    image: user!.image,
                }
            }
        }
    } catch (error) {
        console.error('Failed to add comment:', error)
        return { success: false, error: 'Failed to add comment' }
    }
}

/**
 * Delete a comment (owner or admin only)
 */
export async function deleteComment(commentId: string): Promise<{ success: boolean; error?: string }> {
    const userId = await getCurrentUserId()
    if (!userId) {
        return { success: false, error: 'Not authenticated' }
    }

    const comment = await db.query.collectionComments.findFirst({
        where: eq(collectionComments.id, commentId),
        columns: { userId: true, categoryId: true }
    })

    if (!comment) {
        return { success: false, error: 'Comment not found' }
    }

    // Check if user is comment owner or category owner
    const category = await db.query.categories.findFirst({
        where: eq(categories.id, comment.categoryId),
        columns: { userId: true }
    })

    if (comment.userId !== userId && category?.userId !== userId) {
        return { success: false, error: 'Not authorized to delete this comment' }
    }

    try {
        // Delete comment and all replies
        await db.delete(collectionComments)
            .where(eq(collectionComments.parentId, commentId))
        await db.delete(collectionComments)
            .where(eq(collectionComments.id, commentId))

        revalidatePath(`/categories/${comment.categoryId}`)
        return { success: true }
    } catch (error) {
        console.error('Failed to delete comment:', error)
        return { success: false, error: 'Failed to delete comment' }
    }
}

/**
 * Edit a comment
 */
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

    const comment = await db.query.collectionComments.findFirst({
        where: eq(collectionComments.id, commentId),
        columns: { userId: true, categoryId: true }
    })

    if (!comment || comment.userId !== userId) {
        return { success: false, error: 'Comment not found or not authorized' }
    }

    try {
        await db.update(collectionComments)
            .set({ content: content.trim(), updatedAt: new Date() })
            .where(eq(collectionComments.id, commentId))

        revalidatePath(`/categories/${comment.categoryId}`)
        return { success: true }
    } catch (error) {
        console.error('Failed to edit comment:', error)
        return { success: false, error: 'Failed to edit comment' }
    }
}
