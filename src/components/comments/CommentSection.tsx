'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { MessageCircle, Send, Loader2, ChevronDown } from 'lucide-react'
import { getCollectionComments, addCollectionComment, type Comment, type CommentsPage } from '@/lib/actions/comments'
import { CommentCard } from './CommentCard'
import { toast } from 'sonner'

interface CommentSectionProps {
    categoryId: string
    isOwner: boolean
    currentUserId?: string | null
}

export function CommentSection({ categoryId, isOwner, currentUserId }: CommentSectionProps) {
    const [commentsData, setCommentsData] = useState<CommentsPage | null>(null)
    const [loading, setLoading] = useState(true)
    const [loadingMore, setLoadingMore] = useState(false)
    const [newComment, setNewComment] = useState('')
    const [submitting, setSubmitting] = useState(false)

    // Load initial comments
    useEffect(() => {
        setLoading(true)
        getCollectionComments(categoryId)
            .then(setCommentsData)
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [categoryId])

    const handleSubmit = async () => {
        if (!newComment.trim() || !currentUserId) return

        setSubmitting(true)
        try {
            const result = await addCollectionComment(categoryId, newComment)
            if (result.success && result.comment) {
                setCommentsData(prev => prev ? {
                    ...prev,
                    comments: [result.comment!, ...prev.comments],
                    totalCount: prev.totalCount + 1,
                } : prev)
                setNewComment('')
                toast.success('Comment added!')
            } else {
                toast.error(result.error || 'Failed to add comment')
            }
        } catch (error) {
            toast.error('Something went wrong')
        } finally {
            setSubmitting(false)
        }
    }

    const handleLoadMore = async () => {
        if (!commentsData?.hasMore) return

        setLoadingMore(true)
        try {
            const nextPage = await getCollectionComments(categoryId, commentsData.page + 1)
            setCommentsData(prev => prev ? {
                ...nextPage,
                comments: [...prev.comments, ...nextPage.comments],
            } : nextPage)
        } catch (error) {
            toast.error('Failed to load more comments')
        } finally {
            setLoadingMore(false)
        }
    }

    const handleCommentDeleted = (commentId: string) => {
        setCommentsData(prev => prev ? {
            ...prev,
            comments: prev.comments.filter(c => c.id !== commentId),
            totalCount: prev.totalCount - 1,
        } : prev)
    }

    const handleReplyAdded = (parentId: string, reply: Comment) => {
        setCommentsData(prev => {
            if (!prev) return prev
            return {
                ...prev,
                comments: prev.comments.map(c => {
                    if (c.id === parentId) {
                        return {
                            ...c,
                            replies: [...(c.replies || []), reply]
                        }
                    }
                    return c
                })
            }
        })
    }

    return (
        <Card className="bg-zinc-900/50 border-white/10">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-zinc-100">
                    <MessageCircle className="w-5 h-5 text-blue-400" />
                    Discussion
                    {commentsData && (
                        <span className="text-sm font-normal text-zinc-500">
                            ({commentsData.totalCount})
                        </span>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* New Comment Input */}
                {currentUserId ? (
                    <div className="flex gap-3">
                        <Avatar className="w-10 h-10 flex-shrink-0">
                            <AvatarFallback>U</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 space-y-2">
                            <Textarea
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                placeholder="Share your thoughts on this collection..."
                                rows={2}
                                className="bg-zinc-800 border-white/10 text-white resize-none"
                                maxLength={2000}
                            />
                            <div className="flex justify-end">
                                <Button
                                    onClick={handleSubmit}
                                    disabled={submitting || !newComment.trim()}
                                    size="sm"
                                    className="bg-blue-600 hover:bg-blue-500"
                                >
                                    {submitting ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <>
                                            <Send className="w-4 h-4 mr-1" />
                                            Comment
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-4 text-zinc-500 text-sm">
                        Sign in to join the discussion
                    </div>
                )}

                {/* Divider */}
                <div className="border-t border-white/5" />

                {/* Comments List */}
                {loading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
                    </div>
                ) : commentsData?.comments.length === 0 ? (
                    <div className="text-center py-8 text-zinc-500">
                        <MessageCircle className="w-10 h-10 mx-auto mb-2 opacity-20" />
                        <p>No comments yet</p>
                        <p className="text-sm">Be the first to share your thoughts!</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {commentsData?.comments.map(comment => (
                            <CommentCard
                                key={comment.id}
                                comment={comment}
                                categoryId={categoryId}
                                isCollectionOwner={isOwner}
                                currentUserId={currentUserId}
                                onDeleted={() => handleCommentDeleted(comment.id)}
                                onReplyAdded={(reply) => handleReplyAdded(comment.id, reply)}
                            />
                        ))}

                        {/* Load More */}
                        {commentsData?.hasMore && (
                            <div className="flex justify-center pt-4">
                                <Button
                                    variant="ghost"
                                    onClick={handleLoadMore}
                                    disabled={loadingMore}
                                    className="text-zinc-400"
                                >
                                    {loadingMore ? (
                                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                    ) : (
                                        <ChevronDown className="w-4 h-4 mr-2" />
                                    )}
                                    Load More Comments
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
