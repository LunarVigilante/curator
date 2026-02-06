'use client'

import React, { useMemo } from 'react'
import Image from 'next/image'
import {
    MoreHorizontal, Pencil, Wand2, Tag, RefreshCw, FileText,
    Flag, Trash2, ImageIcon, Film, Circle
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuTrigger, DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import { GlobalItem } from '../types'
import { CATEGORY_ICONS } from '../constants'
import { parseCachedTags } from '../utils'

interface DataBrowserItemCardProps {
    item: GlobalItem
    index: number
    isSelected: boolean
    gridColsClass?: string
    // Action Callbacks
    onClick: (e: React.MouseEvent) => void
    onDoubleClick: () => void
    onEdit: () => void
    onRegenerate: () => void
    onGenerateTags: () => void
    onRefreshMetadata: () => void
    onViewRaw: () => void
    onFlag: () => void
    onDelete: () => void
    onViewDetails: () => void
    // Loading States
    isRegenerating: boolean
    isRefreshing: boolean
    isTagging: boolean
    // View Mode
    viewMode?: 'standard' | 'compact'
}

// Safe Binge status badge config
const STATUS_BADGES = {
    complete: { emoji: '🟢', label: 'Ended', bgClass: 'bg-emerald-500/90' },
    cliffhanger: { emoji: '🔴', label: 'Cliffhanger', bgClass: 'bg-red-500/90' },
    ongoing: { emoji: '🔵', label: 'Ongoing', bgClass: 'bg-blue-500/90' }
} as const

// Get status badge for TV shows
function getTvStatusBadge(item: GlobalItem): typeof STATUS_BADGES[keyof typeof STATUS_BADGES] | null {
    const statusLower = item.status?.toLowerCase() || ''
    const cliffTier = item.cliffhanger_tier?.toLowerCase()

    // Check if ended
    const isEnded = statusLower.includes('ended') || statusLower.includes('canceled')

    if (isEnded) {
        // Check cliffhanger status
        if (cliffTier === 'cliffhanger' || cliffTier === 'unresolved') {
            return STATUS_BADGES.cliffhanger
        }
        return STATUS_BADGES.complete
    }

    // Ongoing/Returning
    if (statusLower.includes('returning') || statusLower.includes('production') || statusLower.includes('planned')) {
        return STATUS_BADGES.ongoing
    }

    return null
}

// Unscripted/Reality format archetypes with emoji prefixes
const UNSCRIPTED_ARCHETYPES: Record<string, { label: string; keywords: string[] }> = {
    'social_experiment': {
        label: '🧪 Social Experiment',
        keywords: ['social experiment', 'social dynamics', 'human behavior', 'psychological']
    },
    'elimination': {
        label: '⚔️ Elimination',
        keywords: ['elimination', 'competition', 'contest', 'survivor', 'voted off', 'challenge']
    },
    'dating': {
        label: '💕 Dating',
        keywords: ['dating', 'romance', 'love', 'bachelor', 'bachelorette', 'matchmaking', 'singles']
    },
    'talent': {
        label: '🌟 Talent',
        keywords: ['talent', 'singing', 'dancing', 'performance', 'audition', 'idol', 'got talent']
    },
    'makeover': {
        label: '✨ Makeover',
        keywords: ['makeover', 'transformation', 'renovation', 'before and after', 'redesign']
    },
    'cooking': {
        label: '👨‍🍳 Cooking',
        keywords: ['cooking', 'chef', 'culinary', 'baking', 'kitchen', 'food competition']
    },
    'game_show': {
        label: '🎯 Game Show',
        keywords: ['game show', 'trivia', 'quiz', 'contestants', 'prize', 'jackpot']
    },
    'docuseries': {
        label: '📹 Docuseries',
        keywords: ['documentary', 'docuseries', 'true story', 'real life', 'investigation']
    },
    'comedy': {
        label: '🎭 Comedy',
        keywords: ['comedy', 'stand-up', 'comedians', 'laugh', 'improv', 'sketch', 'absurdist']
    },
    'travel': {
        label: '🌍 Travel',
        keywords: ['travel', 'adventure', 'explore', 'journey', 'expedition', 'race']
    }
}

// Scripted character archetypes
const SCRIPTED_ARCHETYPES = ['Anti-Hero', 'Gladiator', 'Fool', 'Trickster', 'Sage', 'Hero', 'Outlaw', 'Everyman', 'Ruler', 'Mentor', 'Chosen One']

// Extract archetype from metadata, genres, or keywords
function extractArchetype(item: GlobalItem): string | null {
    const metadata = item.metadata as Record<string, unknown> | undefined

    // 1. Check explicit archetype in metadata
    if (metadata?.archetype && typeof metadata.archetype === 'string') {
        return metadata.archetype
    }

    // Build searchable text from genres + keywords
    const genres = (item.genres || []).map(g => g.toLowerCase())
    const keywords = (item.keywords || []).map(k => k.toLowerCase())
    const searchText = [...genres, ...keywords].join(' ')

    // 2. Check if this is unscripted content (reality, variety, talk show, game show)
    const isUnscripted = genres.some(g =>
        ['reality', 'talk show', 'variety', 'game show', 'documentary', 'news'].includes(g.toLowerCase())
    ) || keywords.some(k =>
        ['reality', 'unscripted', 'non-fiction', 'real life'].includes(k.toLowerCase())
    )

    if (isUnscripted) {
        // Check for unscripted format archetypes
        for (const [, archetype] of Object.entries(UNSCRIPTED_ARCHETYPES)) {
            if (archetype.keywords.some(kw => searchText.includes(kw))) {
                return archetype.label
            }
        }
        // Default for unscripted if no specific match
        if (genres.includes('reality')) return '📺 Reality'
        if (genres.includes('talk show')) return '🎤 Talk Show'
        if (genres.includes('variety')) return '🎪 Variety'
    }

    // 3. Check for scripted character archetypes in keywords
    const found = item.keywords?.find(k =>
        SCRIPTED_ARCHETYPES.some(arch => k.toLowerCase().includes(arch.toLowerCase()))
    )

    return found || null
}

// Memoized component to prevent re-renders when props haven't changed
export const DataBrowserItemCard = React.memo(function DataBrowserItemCard({
    item,
    index,
    isSelected,
    onClick,
    onDoubleClick,
    onEdit,
    onRegenerate,
    onGenerateTags,
    onRefreshMetadata,
    onViewRaw,
    onFlag,
    onDelete,
    onViewDetails,
    isRegenerating,
    isRefreshing,
    isTagging,
    viewMode = 'standard'
}: DataBrowserItemCardProps) {
    const isCompact = viewMode === 'compact'
    // Check if TV show
    const isTV = item.category_type === 'TV_SHOW' || item.category_type === 'TV'

    // Memoize category info lookup
    const catInfo = useMemo(() =>
        CATEGORY_ICONS[item.category_type || ''] || { icon: Film, color: 'text-gray-400', label: 'Item' },
        [item.category_type]
    )
    const CategoryIcon = catInfo.icon

    // Memoize tags parsing
    const tags = useMemo(() => parseCachedTags(item.cached_tags), [item.cached_tags])

    // TV-specific: Get status badge
    const statusBadge = useMemo(() => isTV ? getTvStatusBadge(item) : null, [isTV, item.status, item.cliffhanger_tier])

    // TV-specific: Get archetype
    const archetype = useMemo(() => isTV ? extractArchetype(item) : null, [isTV, item.metadata, item.keywords])

    // Get display text - prefer semantic summary for TV
    const displayText = useMemo(() => {
        if (isTV) {
            const parts = item.description_parts as Record<string, string> | undefined
            // Prefer premise for TV shows (high signal, concise)
            if (parts?.premise) return parts.premise
        }
        return item.description || ''
    }, [isTV, item.description, item.description_parts])

    // Compact card: poster-only with fewer overlays
    if (isCompact) {
        return (
            <TooltipProvider delayDuration={300}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Card
                            onClick={onClick}
                            onDoubleClick={onDoubleClick}
                            className={`select-none group bg-zinc-900/40 border-zinc-800/50 overflow-hidden cursor-pointer transition-all hover:border-cyan-600 hover:shadow-lg hover:shadow-cyan-900/20 p-0 gap-0 h-full flex flex-col ${isSelected ? 'ring-2 ring-cyan-500 border-transparent' : ''}`}
                        >
                            <div className="relative aspect-[2/3] bg-zinc-900 overflow-hidden flex-shrink-0">
                                {item.image_url ? (
                                    <Image
                                        src={item.image_url}
                                        alt={item.title}
                                        fill
                                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                                        priority={index < 12}
                                        unoptimized
                                    />
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-zinc-700 p-2 text-center">
                                        <ImageIcon className="w-6 h-6 mb-1 opacity-50" />
                                    </div>
                                )}

                                {/* Gradient overlay */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />

                                {/* Selection Indicator */}
                                {isSelected && (
                                    <div className="absolute top-1.5 left-1.5 w-4 h-4 bg-cyan-500 rounded-full flex items-center justify-center z-20 shadow-md">
                                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                )}

                                {/* TV Status Badge - Larger in compact */}
                                {isTV && statusBadge && !isSelected && (
                                    <div className={`absolute top-1.5 left-1.5 z-10 flex items-center gap-1 px-2 py-1 rounded-full ${statusBadge.bgClass} backdrop-blur-sm shadow-lg`}>
                                        <span className="text-xs">{statusBadge.emoji}</span>
                                        <span className="text-[10px] text-white font-bold tracking-wide">{statusBadge.label}</span>
                                    </div>
                                )}

                                {/* Category Icon */}
                                <div className="absolute top-1.5 right-1.5 z-10 group-hover:opacity-0 transition-opacity">
                                    <div className="w-5 h-5 rounded-md bg-black/60 backdrop-blur-sm flex items-center justify-center border border-white/10">
                                        <CategoryIcon className={`w-3 h-3 ${catInfo.color}`} />
                                    </div>
                                </div>

                                {/* Context Menu (Hover) */}
                                <div className="absolute top-1.5 right-1.5 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                size="icon"
                                                variant="secondary"
                                                className="h-6 w-6 rounded-full bg-black/70 hover:bg-black/90 text-white border-0 backdrop-blur-md"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <MoreHorizontal className="w-3.5 h-3.5" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="bg-zinc-950 border-zinc-800 min-w-[140px] text-zinc-300 text-xs">
                                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onViewDetails() }} className="cursor-pointer focus:bg-zinc-800 focus:text-white">
                                                View Details
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit() }} className="cursor-pointer focus:bg-zinc-800 focus:text-white">
                                                <Pencil className="w-3 h-3 mr-2" /> Edit
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator className="bg-zinc-800" />
                                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete() }} className="text-red-500 focus:bg-red-950/30 focus:text-red-400 cursor-pointer">
                                                <Trash2 className="w-3 h-3 mr-2" /> Delete
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>

                                {/* Title Overlay - Minimal */}
                                <div className="absolute bottom-0 left-0 right-0 p-2 pointer-events-none bg-gradient-to-t from-black via-black/80 to-transparent pt-6">
                                    <h4 className="font-semibold text-xs text-white leading-tight line-clamp-2 drop-shadow-md">
                                        {item.title}
                                    </h4>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        {item.release_year && (
                                            <span className="text-[9px] text-zinc-400">{item.release_year}</span>
                                        )}
                                        {/* Single archetype chip in compact */}
                                        {isTV && archetype && (
                                            <Badge variant="secondary" className="text-[7px] px-1 py-0 h-3 bg-purple-900/60 text-purple-300 border-0">
                                                {archetype}
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs bg-zinc-950 border-zinc-700 p-3">
                        <p className="font-semibold text-white text-sm mb-1">{item.title}</p>
                        <p className="text-xs text-zinc-400 leading-relaxed">
                            {displayText || 'No description available.'}
                        </p>
                        {tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                                {tags.slice(0, 4).map(tag => (
                                    <Badge key={tag.id} variant="secondary" className="text-[9px] px-1.5 py-0 h-4 bg-zinc-800 text-zinc-400 border-0">
                                        {tag.name}
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        )
    }

    // Standard card render
    return (
        <Card
            onClick={onClick}
            onDoubleClick={onDoubleClick}
            className={`select-none group bg-zinc-900/40 border-zinc-800/50 overflow-hidden cursor-pointer transition-all hover:border-zinc-600 hover:shadow-lg hover:shadow-cyan-900/10 p-0 gap-0 h-full flex flex-col ${isSelected ? 'ring-2 ring-cyan-500 border-transparent' : ''}`}
        >
            {/* Poster Section - Full Bleed */}
            <div className="relative aspect-[2/3] bg-zinc-900 overflow-hidden flex-shrink-0">
                {item.image_url ? (
                    <Image
                        src={item.image_url}
                        alt={item.title}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        priority={index < 8}
                        unoptimized
                    />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-zinc-700 p-4 text-center">
                        <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
                        <span className="text-xs">No Image</span>
                    </div>
                )}

                {/* Minimal gradient - only at bottom for title legibility */}
                <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/80 to-transparent opacity-70 group-hover:opacity-90 transition-opacity" />

                {/* Selection Indicator */}
                {isSelected && (
                    <div className="absolute top-2 left-2 w-5 h-5 bg-cyan-500 rounded-full flex items-center justify-center z-10 shadow-md">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                )}

                {/* TV Safe Binge Status Badge (top-left, below selection) */}
                {isTV && statusBadge && !isSelected && (
                    <div className={`absolute top-2 left-2 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded-full ${statusBadge.bgClass} backdrop-blur-sm shadow-md`}>
                        <span className="text-[10px]">{statusBadge.emoji}</span>
                        <span className="text-[9px] text-white font-semibold tracking-wide">{statusBadge.label}</span>
                    </div>
                )}

                {/* Category Icon */}
                <div className="absolute top-2 right-2 z-10 group-hover:opacity-0 transition-opacity">
                    <div className="w-6 h-6 rounded-md bg-black/50 backdrop-blur-sm flex items-center justify-center border border-white/10">
                        <CategoryIcon className={`w-3.5 h-3.5 ${catInfo.color}`} />
                    </div>
                </div>

                {/* Context Menu (Hover) */}
                <div className="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                size="icon"
                                variant="secondary"
                                className="h-7 w-7 rounded-full bg-black/60 hover:bg-black/80 text-white border-0 backdrop-blur-md"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <MoreHorizontal className="w-4 h-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-zinc-950 border-zinc-800 min-w-[160px] text-zinc-300">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit() }} className="cursor-pointer focus:bg-zinc-800 focus:text-white">
                                <Pencil className="w-3.5 h-3.5 mr-2" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-zinc-800" />
                            <DropdownMenuItem
                                onClick={(e) => { e.stopPropagation(); onRegenerate() }}
                                disabled={isRegenerating}
                                className="cursor-pointer focus:bg-zinc-800 focus:text-white"
                            >
                                <Wand2 className={`w-3.5 h-3.5 mr-2 ${isRegenerating ? 'animate-pulse' : ''}`} />
                                {isRegenerating ? 'Regenerating...' : 'Regenerate Desc'}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={(e) => { e.stopPropagation(); onGenerateTags() }}
                                disabled={isTagging}
                                className="cursor-pointer focus:bg-zinc-800 focus:text-white"
                            >
                                <Tag className={`w-3.5 h-3.5 mr-2 ${isTagging ? 'animate-pulse' : ''}`} />
                                {isTagging ? 'Generating...' : 'Generate Tags'}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={(e) => { e.stopPropagation(); onRefreshMetadata() }}
                                disabled={isRefreshing}
                                className="cursor-pointer focus:bg-zinc-800 focus:text-white"
                            >
                                <RefreshCw className={`w-3.5 h-3.5 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                                {isRefreshing ? 'Refreshing...' : 'Refresh Metadata'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onViewRaw() }} className="cursor-pointer focus:bg-zinc-800 focus:text-white">
                                <FileText className="w-3.5 h-3.5 mr-2" /> Raw Data
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onFlag() }} className="text-amber-500 focus:bg-amber-950/30 focus:text-amber-400 cursor-pointer">
                                <Flag className="w-3.5 h-3.5 mr-2" /> Flag Data
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-zinc-800" />
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete() }} className="text-red-500 focus:bg-red-950/30 focus:text-red-400 cursor-pointer">
                                <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {/* Hero Action: View Details */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-[2px]">
                    <Button
                        variant="secondary"
                        className="bg-cyan-600 hover:bg-cyan-500 text-white border-0 shadow-lg shadow-cyan-900/40 px-5 py-2 h-auto rounded-full font-medium"
                        onClick={(e) => { e.stopPropagation(); onViewDetails() }}
                    >
                        View Details
                    </Button>
                </div>
            </div>

            {/* Content Footer - Flexbox with space-between */}
            <CardContent className="p-3 bg-zinc-900 flex-1 flex flex-col justify-between overflow-hidden">
                {/* Top: Title + Year (anchored to top) */}
                <div className="flex items-start justify-between gap-2 mb-2 flex-shrink-0">
                    <div className="min-w-0 flex-1">
                        <h4 className="font-semibold text-sm text-white leading-tight line-clamp-1 drop-shadow-sm">
                            {item.title}
                        </h4>
                        {item.release_year && (
                            <p className="text-[10px] text-zinc-500 mt-0.5">{item.release_year}</p>
                        )}
                    </div>
                </div>

                {/* Middle: Description (3-line limit with overflow hidden) */}
                <p className="text-[11px] text-zinc-400 line-clamp-3 leading-relaxed overflow-hidden flex-shrink flex-1 mb-2">
                    {displayText || <span className="italic opacity-30">No description available.</span>}
                </p>

                {/* Bottom: Tags (fixed to bottom with safety gap) */}
                <div className="flex flex-wrap gap-1 pt-1 mt-auto flex-shrink-0">
                    {/* Archetype chip first if available */}
                    {archetype && (
                        <Badge variant="secondary" className="text-[8px] px-1.5 py-0 h-3.5 bg-purple-900/50 text-purple-300 border border-purple-500/30">
                            {archetype}
                        </Badge>
                    )}

                    {/* 2 additional high-signal tags (or 3 if no archetype) */}
                    {tags.slice(0, archetype ? 2 : 3).map(tag => (
                        <Badge key={tag.id} variant="secondary" className="text-[8px] px-1 py-0 h-3.5 bg-zinc-800 text-zinc-500 border-0">
                            {tag.name}
                        </Badge>
                    ))}

                    {/* +X indicator for remaining tags */}
                    {tags.length > (archetype ? 2 : 3) && (
                        <span className="text-[9px] text-zinc-600 self-center">+{tags.length - (archetype ? 2 : 3)}</span>
                    )}
                </div>
            </CardContent>
        </Card>
    )
})

