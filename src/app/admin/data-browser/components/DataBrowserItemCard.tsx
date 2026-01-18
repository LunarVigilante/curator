'use client'

import React from 'react'
import Image from 'next/image'
import {
    MoreHorizontal, Pencil, Wand2, Tag, RefreshCw, FileText,
    Flag, Trash2, ImageIcon, Film
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuTrigger, DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import { GlobalItem } from '../types'
import { CATEGORY_ICONS } from '../constants'
import { parseCachedTags } from '../utils'

interface DataBrowserItemCardProps {
    item: GlobalItem
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
}

export function DataBrowserItemCard({
    item,
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
    isTagging
}: DataBrowserItemCardProps) {
    const catInfo = CATEGORY_ICONS[item.category_type || ''] || { icon: Film, color: 'text-gray-400', label: 'Item' }
    const CategoryIcon = catInfo.icon

    return (
        <Card
            onClick={onClick}
            onDoubleClick={onDoubleClick}
            className={`select-none group bg-zinc-900/40 border-zinc-800/50 overflow-hidden cursor-pointer transition-all hover:border-zinc-600 hover:shadow-lg hover:shadow-cyan-900/10 ${isSelected ? 'ring-2 ring-cyan-500 border-transparent' : ''}`}
        >
            <div className="relative aspect-[2/3] bg-zinc-900 overflow-hidden">
                {item.image_url ? (
                    <Image
                        src={item.image_url}
                        alt={item.title}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        unoptimized
                    />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-zinc-700 p-4 text-center">
                        <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
                        <span className="text-xs">No Image</span>
                    </div>
                )}

                {/* Overlays */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />

                {/* Selection Indicator */}
                {isSelected && (
                    <div className="absolute top-2 left-2 w-5 h-5 bg-cyan-500 rounded-full flex items-center justify-center z-10 shadow-md transform scale-100 transition-transform">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
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

                {/* Title Overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-3 pointer-events-none bg-gradient-to-t from-black via-black/80 to-transparent pt-8">
                    <div className="flex items-start justify-between gap-2">
                        <div>
                            <h4 className="font-semibold text-sm text-white leading-tight line-clamp-2 drop-shadow-md">
                                {item.title}
                            </h4>
                            {item.release_year && (
                                <p className="text-[10px] text-zinc-400 mt-0.5">{item.release_year}</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Footer */}
            <CardContent className="p-3 bg-zinc-900 h-[88px] flex flex-col justify-between">
                <p className="text-[11px] text-zinc-400 line-clamp-3 leading-relaxed">
                    {item.description || <span className="italic opacity-30">No description available.</span>}
                </p>

                {/* Cached Tags Preview */}
                {(() => {
                    const tags = parseCachedTags(item.cached_tags)
                    if (tags.length === 0) return null
                    return (
                        <div className="flex flex-wrap gap-1 mt-auto pt-2">
                            {tags.slice(0, 3).map(tag => (
                                <Badge key={tag.id} variant="secondary" className="text-[8px] px-1 py-0 h-3.5 bg-zinc-800 text-zinc-500 border-0">
                                    {tag.name}
                                </Badge>
                            ))}
                            {tags.length > 3 && (
                                <span className="text-[9px] text-zinc-600 self-center">+{tags.length - 3}</span>
                            )}
                        </div>
                    )
                })()}
            </CardContent>
        </Card>
    )
}
