'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
    Flag, ExternalLink, Tag as TagIcon,
    Gamepad2, Film, Music, Globe, Box, Play, Sparkles,
    Clapperboard, ChevronDown, ChevronUp
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PlatformBadgeList } from '@/components/ui/PlatformBadge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useUser } from '@/hooks/useUser'
import { useTagDescriptions } from '@/hooks/useTagDescriptions'
import type { GlobalItem } from '../types'
import { normalizeCategory } from '../utils'
import { RelatedItemsRow } from '@/components/item-details/RelatedItemsRow'

const TAGS_PER_PAGE = 3

interface ItemDetailSidebarProps {
    item: GlobalItem
    onEdit: (item: GlobalItem) => void
    onDelete: (id: string) => void
    onReportOpen: () => void
    onRefreshMetadata?: () => void
    onRegenerateDescription?: () => void
    isRefreshing?: boolean
    isRegenerating?: boolean
    onSimilarItemClick?: (itemId: string) => void
}

export function ItemDetailSidebar({
    item,
    onEdit: _onEdit,
    onDelete: _onDelete,
    onReportOpen,
    onRefreshMetadata: _onRefreshMetadata,
    onRegenerateDescription: _onRegenerateDescription,
    isRefreshing: _isRefreshing,
    isRegenerating: _isRegenerating,
    onSimilarItemClick
}: ItemDetailSidebarProps) {
    const { isAdmin: _isAdmin } = useUser()
    const [visibleTagCount, setVisibleTagCount] = useState(TAGS_PER_PAGE)
    const category = normalizeCategory(item.category_type)
    const isMusicArtist = category === 'MUSIC_ARTIST'
    const isVideoGame = category === 'VIDEO_GAME'
    const isMovie = category === 'MOVIE'
    const isTV = category === 'TV' || category === 'TV_SHOW'
    const metadata = item.metadata as Record<string, any> || {}

    // Fetch tag descriptions from tags table
    const { tags: allTags } = useTagDescriptions(item.cached_tags)
    const visibleTags = allTags.slice(0, visibleTagCount)
    const hasMoreTags = visibleTagCount < allTags.length
    const canShowLess = visibleTagCount > TAGS_PER_PAGE

    const handleShowMore = () => {
        setVisibleTagCount(prev => Math.min(prev + TAGS_PER_PAGE, allTags.length))
    }

    const handleShowLess = () => {
        setVisibleTagCount(TAGS_PER_PAGE)
    }

    return (
        <div className="w-full flex flex-col items-center md:items-start gap-6">
            {/* Main Poster/Image with Dashed Border (hidden when image present) */}
            <div className={`relative w-full p-1.5 rounded-2xl group ${item.image_url ? '' : 'border border-dashed border-zinc-800'}`}>
                <div className="relative w-full aspect-[2/3] rounded-xl overflow-hidden shadow-2xl shadow-black/80 ring-1 ring-white/10">
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-10" />
                    {item.image_url ? (
                        <Image
                            src={item.image_url}
                            alt={item.title}
                            fill
                            priority
                            className="object-cover transition-transform duration-700 group-hover:scale-105"
                            unoptimized
                        />
                    ) : (
                        <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                            <Box className="w-16 h-16 text-zinc-700" />
                        </div>
                    )}
                </div>
            </div>

            {/* Trailer Button (Cinematic) - Added top margin for breathing room */}
            {item.trailer_url && (
                <Button asChild className="w-full h-12 mt-2 bg-zinc-900 hover:bg-zinc-800 border border-white/5 rounded-xl text-zinc-300 font-bold tracking-widest uppercase text-[10px] gap-2">
                    <Link href={item.trailer_url} target="_blank">
                        <Play className="w-3 h-3 fill-zinc-300" /> Trailer
                    </Link>
                </Button>
            )}

            {/* Report Issue Button - Available to all users */}
            <Button
                variant="outline"
                onClick={onReportOpen}
                className="w-full border-zinc-700 hover:bg-red-500/10 text-zinc-400 hover:text-red-400 hover:border-red-500/30"
            >
                <Flag className="w-4 h-4 mr-2" />
                Report Issue
            </Button>

            {/* Video Game Platforms */}
            {isVideoGame && item.platforms && (
                <div className="w-full space-y-2">
                    <h4 className="text-[10px] uppercase tracking-wider text-zinc-300 font-bold flex items-center gap-1.5">
                        <Gamepad2 className="w-3 h-3" /> Platforms
                    </h4>
                    <PlatformBadgeList platforms={item.platforms} />
                </div>
            )}

            {/* Genres */}
            {item.genres && item.genres.length > 0 && !isMusicArtist && (
                <div className="w-full space-y-3">
                    <h4 className="text-[10px] uppercase tracking-wider text-zinc-300 font-bold flex items-center gap-1.5">
                        <TagIcon className="w-3 h-3" /> Genres
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                        {item.genres.map((genre) => (
                            <Badge key={genre} variant="outline" className="text-zinc-400 border-zinc-800 bg-zinc-900/50">
                                {genre}
                            </Badge>
                        ))}
                    </div>
                </div>
            )}

            {/* Tags (Cached Tags - now below Genres) with Show More */}
            {allTags.length > 0 && (
                <div className="w-full space-y-3">
                    <h4 className="text-[10px] uppercase tracking-wider text-zinc-300 font-bold flex items-center gap-1.5">
                        <TagIcon className="w-3 h-3" /> Tags
                    </h4>
                    <TooltipProvider delayDuration={300}>
                        <div className="flex flex-wrap gap-1.5">
                            {visibleTags.map((tag, idx) => (
                                <Tooltip key={`${tag.id}-${idx}`}>
                                    <TooltipTrigger asChild>
                                        <span
                                            className="text-[11px] text-zinc-300 bg-white/5 px-2 py-0.5 rounded hover:text-white hover:bg-white/10 transition-colors cursor-default border border-transparent hover:border-white/10"
                                        >
                                            #{tag.name}
                                        </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-xs">
                                        <p className="text-xs">{tag.description || `Semantic tag: ${tag.name}`}</p>
                                    </TooltipContent>
                                </Tooltip>
                            ))}
                        </div>
                    </TooltipProvider>
                    {/* Show More / Show Less Controls */}
                    {(hasMoreTags || canShowLess) && (
                        <div className="flex items-center gap-3 pt-1">
                            {hasMoreTags && (
                                <button
                                    onClick={handleShowMore}
                                    className="text-[11px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors"
                                >
                                    <ChevronDown className="w-3 h-3" />
                                    Show more ({allTags.length - visibleTagCount} remaining)
                                </button>
                            )}
                            {canShowLess && (
                                <button
                                    onClick={handleShowLess}
                                    className="text-[11px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors"
                                >
                                    <ChevronUp className="w-3 h-3" />
                                    Show less
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Related Items (Scrollable Vertical List) */}
            <div className="w-full flex-1 min-h-0 overflow-hidden">
                <ScrollArea className="h-full">
                    {/* RelatedItemsRow handles its own header and visibility */}
                    <RelatedItemsRow
                        sourceItemId={item.id}
                        variant="compact"
                        onItemClick={onSimilarItemClick}
                        initialCategory={item.category_type}
                    />
                </ScrollArea>
            </div>
        </div>
    )
}
