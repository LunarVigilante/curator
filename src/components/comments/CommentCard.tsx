'use client'

import { useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Reply, Trash2, Crown, Loader2, Send } from 'lucide-react'
import { deleteComment, addCollectionComment, type Comment } from '@/lib/actions/comments'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'

interface CommentCardProps {
    comment: Comment
    categoryId: string
    isCollectionOwner: boolean
    currentUserId?: string | null
    onDeleted?: () => void
    onReplyAdded?: (reply: Comment) => void
    isReply?: boolean
}

export function CommentCard({
    comment,
    categoryId,
    isCollectionOwner,
    currentUserId,
    onDeleted,
    onReplyAdded,
    isReply = false
}: CommentCardProps) {
    const [showReplyInput, setShowReplyInput] = useState(false)
    const [replyContent, setReplyContent] = useState('')
    const [submittingReply, setSubmittingReply] = useState(false)
    const [deleting, setDeleting] = useState(false)

    const displayName = comment.user.displayName || comment.user.name
    const initials = displayName.slice(0, 2).toUpperCase()
    const isOwnComment = currentUserId === comment.user.id
    const canDelete = isOwnComment || isCollectionOwner

    const handleDelete = async () => {
        setDeleting(true)
        try {
            const result = await deleteComment(comment.id)
            if (result.success) {
                toast.success('Comment deleted')
                onDeleted?.()
            } else {
                toast.error(result.error || 'Failed to delete')
            }
        } catch (error) {
            toast.error('Something went wrong')
        } finally {
            setDeleting(false)
        }
    }

    const handleReply = async () => {
        if (!replyContent.trim()) return

        setSubmittingReply(true)
        try {
            const result = await addCollectionComment(categoryId, replyContent, comment.id)
            if (result.success && result.comment) {
                setReplyContent('')
                setShowReplyInput(false)
                onReplyAdded?.(result.comment)
                toast.success('Reply added!')
            } else {
                toast.error(result.error || 'Failed to reply')
            }
        } catch (error) {
            toast.error('Something went wrong')
        } finally {
            setSubmittingReply(false)
        }
    }

    return (
        <div className={`${isReply ? 'ml-12 pl-4 border-l border-white/5' : ''}`}>
            <div className="flex gap-3 group">
                <Avatar className="w-10 h-10 flex-shrink-0">
                    <AvatarImage src={comment.user.image || undefined} alt={displayName} />
                    <AvatarFallback className="text-sm bg-zinc-700">{initials}</AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-white">{displayName}</span>
                        {comment.isCreatorReply && (
                            <Badge
                                variant="secondary"
                                className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-xs"
                            >
                                <Crown className="w-3 h-3 mr-1" />
                                Curator
                            </Badge>
                        )}
                        <span className="text-xs text-zinc-500">
                            {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                        </span>
                    </div>

                    {/* Content */}
                    <p className={`text-sm text-zinc-300 whitespace-pre-wrap ${comment.isCreatorReply ? 'bg-purple-500/5 p-2 rounded border-l-2 border-purple-500/30' : ''
                        }`}>
                        {comment.content}
                    </p>

                    {/* Actions */}
                    <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {currentUserId && !isReply && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowReplyInput(!showReplyInput)}
                                className="h-7 text-xs text-zinc-400 hover:text-white"
                            >
                                <Reply className="w-3 h-3 mr-1" />
                                Reply
                            </Button>
                        )}
                        {canDelete && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-zinc-400">
                                        <MoreHorizontal className="w-4 h-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="bg-zinc-800 border-white/10">
                                    <DropdownMenuItem
                                        onClick={handleDelete}
                                        disabled={deleting}
                                        className="text-red-400 focus:text-red-400 focus:bg-red-500/10"
                                    >
                                        {deleting ? (
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        ) : (
                                            <Trash2 className="w-4 h-4 mr-2" />
                                        )}
                                        Delete
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </div>

                    {/* Reply Input */}
                    {showReplyInput && (
                        <div className="mt-3 flex gap-2">
                            <Textarea
                                value={replyContent}
                                onChange={(e) => setReplyContent(e.target.value)}
                                placeholder="Write a reply..."
                                rows={2}
                                className="bg-zinc-800 border-white/10 text-white text-sm resize-none"
                                maxLength={1000}
                            />
                            <div className="flex flex-col gap-1">
                                <Button
                                    onClick={handleReply}
                                    disabled={submittingReply || !replyContent.trim()}
                                    size="sm"
                                    className="bg-blue-600 hover:bg-blue-500"
                                >
                                    {submittingReply ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Send className="w-4 h-4" />
                                    )}
                                </Button>
                                <Button
                                    onClick={() => setShowReplyInput(false)}
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs"
                                >
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Replies */}
            {comment.replies && comment.replies.length > 0 && (
                <div className="mt-4 space-y-4">
                    {comment.replies.map(reply => (
                        <CommentCard
                            key={reply.id}
                            comment={reply}
                            categoryId={categoryId}
                            isCollectionOwner={isCollectionOwner}
                            currentUserId={currentUserId}
                            onDeleted={() => {/* Handle in parent */ }}
                            isReply
                        />
                    ))}
                </div>
            )}
        </div>
    )
}
