'use client'

import React, { useState, useTransition } from 'react'
import { Card } from "@/components/ui/card"
import { Lock, Disc, Film, BookOpen, Gamepad2, Tv, Mic2, Star, ThumbsUp, Bookmark } from 'lucide-react'
import { cn } from "@/lib/utils"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { toggleLike, toggleSave } from "@/lib/actions/interactions"

interface CollectionCardProps {
    category: {
        id: string
        name: string
        image: string | null
        isPublic: boolean
        owner: {
            id: string
            name: string | null
            image: string | null
        } | null
        items?: { id: string }[]
        itemCount?: number
        metadata?: string | null // JSON string
    }
    viewMode?: 'compact' | 'standard' | 'comfort'
    initialLiked?: boolean
    initialSaved?: boolean
    initialLikeCount?: number
    tags?: { id: string; tag: string; isAdminOnly: boolean }[]
}

export function CollectionCard({
    category,
    viewMode = 'standard',
    initialLiked = false,
    initialSaved = false,
    initialLikeCount = 0,
    tags = []
}: CollectionCardProps) {
    // State for optimistic UI
    const [isLiked, setIsLiked] = useState(initialLiked)
    const [isSaved, setIsSaved] = useState(initialSaved)
    const [likeCount, setLikeCount] = useState(initialLikeCount)
    const [isPending, startTransition] = useTransition()

    // Parse metadata safely
    let meta = {}
    try {
        meta = category.metadata ? JSON.parse(category.metadata) : {}
    } catch (e) { }

    const type = (meta as any).type || 'General'
    const itemCount = category.itemCount ?? category.items?.length ?? 0

    // Category Icon Logic
    const getCategoryIcon = (type: string) => {
        switch (type.toLowerCase()) {
            case 'movie':
            case 'movies': return <Film className="w-3.5 h-3.5" />

            case 'music':
            case 'music_album':
            case 'music_artist':
            case 'music_albums': return <Disc className="w-3.5 h-3.5" />

            case 'book':
            case 'books': return <BookOpen className="w-3.5 h-3.5" />

            case 'game':
            case 'video games':
            case 'video_games': return <Gamepad2 className="w-3.5 h-3.5" />

            case 'tv':
            case 'tv shows':
            case 'tv_shows': return <Tv className="w-3.5 h-3.5" />

            case 'podcast':
            case 'podcasts': return <Mic2 className="w-3.5 h-3.5" />

            case 'board_game':
            case 'board games': return <Gamepad2 className="w-3.5 h-3.5" />

            case 'comic':
            case 'comics': return <BookOpen className="w-3.5 h-3.5" />

            default: return <Star className="w-3.5 h-3.5" />
        }
    }

    // Get display name for type (handle special cases like TV)
    const getDisplayName = (type: string) => {
        const lowerType = type.toLowerCase()
        switch (lowerType) {
            case 'tv': return 'TV'
            case 'board_game': return 'Board Games'
            case 'music_artist': return 'Music'
            case 'music_album': return 'Music'
            default: return type.replace('_', ' ')
        }
    }

    // Display tags: show up to 3, prioritizing admin-only tags first
    const displayTags = [...tags]
        .sort((a, b) => (b.isAdminOnly ? 1 : 0) - (a.isAdminOnly ? 1 : 0))
        .slice(0, 3)

    // Handle Like Click
    const handleLike = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()

        // Optimistic update
        setIsLiked(!isLiked)
        setLikeCount(prev => isLiked ? prev - 1 : prev + 1)

        startTransition(async () => {
            const result = await toggleLike(category.id)
            if (!result.success) {
                // Revert on error
                setIsLiked(isLiked)
                setLikeCount(prev => isLiked ? prev + 1 : prev - 1)
            }
        })
    }

    // Handle Save Click
    const handleSave = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()

        // Optimistic update
        setIsSaved(!isSaved)

        startTransition(async () => {
            const result = await toggleSave(category.id)
            if (!result.success) {
                // Revert on error
                setIsSaved(isSaved)
            }
        })
    }

    return (
        <Card className="group border-0 bg-transparent overflow-hidden h-full flex flex-col gap-3">
            {/* Image Container */}
            <div className={cn(
                "relative rounded-xl overflow-hidden border border-white/10 group-hover:border-white/30 transition-all duration-300 w-full bg-zinc-900 shadow-lg group-hover:shadow-blue-500/10",
                viewMode === 'compact' ? "aspect-square" : "aspect-[4/3]"
            )}>
                {/* Background Image */}
                {category.image ? (
                    <div
                        className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                        style={{ backgroundImage: `url(${category.image})` }}
                    />
                ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-900" />
                )}

                {/* Top Left Save/Bookmark Button */}
                <button
                    onClick={handleSave}
                    className={cn(
                        "absolute top-3 left-3 z-20 p-1.5 rounded-full backdrop-blur-sm border transition-all duration-200",
                        isSaved
                            ? "bg-blue-500/20 border-blue-500/50 text-blue-400 opacity-100"
                            : "bg-black/60 border-white/10 text-zinc-400 opacity-0 group-hover:opacity-100 hover:text-white hover:bg-black/80"
                    )}
                    disabled={isPending}
                >
                    <Bookmark className={cn("w-4 h-4", isSaved && "fill-blue-400")} />
                </button>

                {/* Private Lock */}
                {!category.isPublic && (
                    <div className="absolute bottom-3 right-3 z-20 bg-black/60 p-1.5 rounded-full backdrop-blur-sm border border-white/10">
                        <Lock className="w-3 h-3 text-zinc-400" />
                    </div>
                )}

                {/* Top Right Category Badge */}
                <div className="absolute top-3 right-3 z-10">
                    <Badge variant="secondary" className="bg-black/40 backdrop-blur-md border border-white/10 text-white/90 shadow-sm px-2.5 py-1">
                        <span className="text-xs font-medium tracking-wide">{getDisplayName(type)}</span>
                    </Badge>
                </div>

                {/* Gradient Overlay */}
                <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/95 via-black/40 to-transparent pointer-events-none" />

                {/* Bottom Left Item Count (On Image) */}
                <div className="absolute bottom-3 left-3 z-10">
                    <div className="px-2 py-1 rounded-md bg-white/10 backdrop-blur-sm border border-white/5 text-[10px] font-medium text-zinc-200 uppercase tracking-wider">
                        {itemCount} Items
                    </div>
                </div>
            </div>

            {/* Footer Content (Outside Image for Standard/Comfort) */}
            {viewMode !== 'compact' && (
                <div className="space-y-3 px-1">
                    {/* Title */}
                    <div>
                        <h3 className="font-bold text-lg text-zinc-100 leading-tight group-hover:text-blue-400 transition-colors line-clamp-1">
                            {category.name}
                        </h3>
                    </div>

                    {/* Tags - Only show if there are tags */}
                    {displayTags.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {displayTags.map((tagItem) => (
                                <span
                                    key={tagItem.id}
                                    className={cn(
                                        "px-2 py-0.5 rounded-full text-[10px] font-medium border",
                                        tagItem.isAdminOnly
                                            ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                                            : "bg-zinc-800/50 border-white/5 text-zinc-400"
                                    )}
                                >
                                    {tagItem.tag}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Meta Footer: Creator & Likes */}
                    <div className="flex items-center justify-between pt-1 border-t border-white/5 mt-1">
                        <button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                if (category.owner?.id) {
                                    window.location.href = `/profile/${category.owner.id}`
                                }
                            }}
                            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                        >
                            <Avatar className="w-5 h-5 border border-white/10">
                                <AvatarImage src={category.owner?.image || ''} />
                                <AvatarFallback className="text-[9px] bg-zinc-800 text-zinc-400">
                                    {category.owner?.name?.[0] || '?'}
                                </AvatarFallback>
                            </Avatar>
                            <span className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors">
                                {category.owner?.name || 'Unknown'}
                            </span>
                        </button>

                        <button
                            onClick={handleLike}
                            disabled={isPending}
                            className={cn(
                                "flex items-center gap-1.5 text-xs transition-colors",
                                isLiked ? "text-blue-400" : "text-zinc-500 hover:text-zinc-300"
                            )}
                        >
                            <ThumbsUp className={cn("w-3.5 h-3.5", isLiked && "fill-blue-400")} />
                            <span>{likeCount}</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Compact Mode Content */}
            {viewMode === 'compact' && (
                <div className="px-1">
                    <h3 className="font-medium text-sm text-zinc-200 truncate group-hover:text-blue-400 transition-colors">
                        {category.name}
                    </h3>
                    <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-zinc-500 truncate">
                            {category.owner?.name || 'Unknown'}
                        </span>
                        <button
                            onClick={handleLike}
                            disabled={isPending}
                            className={cn(
                                "flex items-center gap-1 text-[10px] transition-colors",
                                isLiked ? "text-blue-400" : "text-zinc-600 hover:text-zinc-400"
                            )}
                        >
                            <ThumbsUp className={cn("w-3 h-3", isLiked && "fill-blue-400")} />
                            <span>{likeCount}</span>
                        </button>
                    </div>
                </div>
            )}
        </Card>
    )
}
