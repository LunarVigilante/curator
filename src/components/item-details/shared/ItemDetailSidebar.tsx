'use client'

import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
    Pencil, Flag, Trash2, ExternalLink, Tag as TagIcon,
    Gamepad2, Film, Music, Globe, Box, Play, Sparkles,
    RefreshCw, Wand2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PlatformBadgeList } from '@/components/ui/PlatformBadge'
import { cn } from '@/lib/utils'
import type { GlobalItem } from '../types'
import { normalizeCategory } from '../utils'
import { RelatedItemsRow } from '@/components/item-details/RelatedItemsRow'

interface ItemDetailSidebarProps {
    item: GlobalItem
    onEdit: (item: GlobalItem) => void
    onDelete: (id: string) => void
    onReportOpen: () => void
    onRefreshMetadata?: () => void
    onRegenerateDescription?: () => void
    isRefreshing?: boolean
    isRegenerating?: boolean
}

export function ItemDetailSidebar({
    item,
    onEdit,
    onDelete,
    onReportOpen,
    onRefreshMetadata,
    onRegenerateDescription,
    isRefreshing,
    isRegenerating
}: ItemDetailSidebarProps) {
    const category = normalizeCategory(item.category_type)
    const isMusicArtist = category === 'MUSIC_ARTIST'
    const isVideoGame = category === 'VIDEO_GAME'
    const metadata = item.metadata as Record<string, any> || {}

    return (
        <div className="w-full md:w-[400px] flex-shrink-0 flex flex-col gap-6 md:sticky md:top-0">
            {/* Main Poster/Image with Dashed Border */}
            <div className="relative p-1.5 border border-dashed border-zinc-800 rounded-2xl group">
                <div className="relative w-full aspect-[2/3] rounded-xl overflow-hidden shadow-2xl shadow-black/80 ring-1 ring-white/10">
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-10" />
                    {item.image_url ? (
                        <Image
                            src={item.image_url}
                            alt={item.title}
                            fill
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

            {/* Trailer Button (Cinematic) */}
            {item.trailer_url && (
                <Button asChild className="w-full h-12 bg-zinc-900 hover:bg-zinc-800 border border-white/5 rounded-xl text-zinc-300 font-bold tracking-widest uppercase text-[10px] gap-2">
                    <Link href={item.trailer_url} target="_blank">
                        <Play className="w-3 h-3 fill-zinc-300" /> Trailer
                    </Link>
                </Button>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="flex-1 text-zinc-400 border-zinc-700 hover:bg-zinc-800" onClick={() => onEdit(item)}>
                    <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
                </Button>

                {/* Magic Actions */}
                {onRefreshMetadata && (
                    <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-zinc-400 border-zinc-700 hover:bg-zinc-800"
                        onClick={onRefreshMetadata}
                        disabled={isRefreshing}
                    >
                        <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", isRefreshing && "animate-spin")} />
                        {isRefreshing ? 'Refreshing...' : 'Refresh'}
                    </Button>
                )}
                {onRegenerateDescription && (
                    <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-zinc-400 border-zinc-700 hover:bg-zinc-800"
                        onClick={onRegenerateDescription}
                        disabled={isRegenerating}
                    >
                        <Wand2 className={cn("w-3.5 h-3.5 mr-1.5", isRegenerating && "animate-pulse")} />
                        {isRegenerating ? 'Magic...' : 'Regen'}
                    </Button>
                )}

                <Button variant="outline" size="sm" className="flex-1 text-zinc-400 border-zinc-700 hover:bg-zinc-800" onClick={onReportOpen}>
                    <Flag className="w-3.5 h-3.5 mr-1.5" /> Report
                </Button>
                <Button variant="outline" size="sm" className="text-red-400 border-zinc-700 hover:bg-red-500/10" onClick={() => onDelete(item.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                </Button>
            </div>

            {/* External Links */}
            <div className="flex flex-wrap gap-2">
                {item.imdb_rating && (
                    <Button asChild variant="outline" size="sm" className="bg-[#F5C518]/10 text-[#F5C518] border-[#F5C518]/20 hover:bg-[#F5C518]/20 h-8">
                        <Link href={`https://www.imdb.com/title/${item.external_ids?.imdb}`} target="_blank">
                            <Film className="w-3 h-3 mr-1.5" /> IMDb
                        </Link>
                    </Button>
                )}
                {category === 'BOARD_GAME' && item.external_ids?.bgg && (
                    <Button asChild variant="outline" size="sm" className="bg-orange-500/10 text-orange-400 border-orange-500/20 hover:bg-orange-500/20 h-8">
                        <Link href={`https://boardgamegeek.com/boardgame/${item.external_ids?.bgg}`} target="_blank">
                            <ExternalLink className="w-3 h-3 mr-1.5" /> BGG
                        </Link>
                    </Button>
                )}
                {item.external_ids?.spotify && (
                    <Button asChild variant="outline" size="sm" className="bg-[#1DB954]/10 text-[#1DB954] border-[#1DB954]/20 hover:bg-[#1DB954]/20 h-8">
                        <Link href={`https://open.spotify.com/${isMusicArtist ? 'artist' : 'album'}/${item.external_ids?.spotify}`} target="_blank">
                            <Music className="w-3 h-3 mr-1.5" /> Spotify
                        </Link>
                    </Button>
                )}
                {/* Generic Website Link */}
                {metadata?.homepage && (
                    <Button asChild variant="outline" size="sm" className="text-zinc-400 border-zinc-800 h-8">
                        <Link href={metadata.homepage} target="_blank">
                            <Globe className="w-3 h-3 mr-1.5" /> Site
                        </Link>
                    </Button>
                )}
            </div>

            {/* Video Game Platforms */}
            {isVideoGame && item.platforms && (
                <div className="space-y-2">
                    <h4 className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold flex items-center gap-1.5">
                        <Gamepad2 className="w-3 h-3" /> Platforms
                    </h4>
                    <PlatformBadgeList platforms={item.platforms} />
                </div>
            )}

            {/* Tags (Cached Tags) */}
            {item.cached_tags && item.cached_tags.length > 0 && (
                <div className="space-y-3">
                    <h4 className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold flex items-center gap-1.5">
                        <TagIcon className="w-3 h-3" /> Tags
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                        {item.cached_tags.slice(0, 20).map((tag, idx) => (
                            <span
                                key={`${tag.id}-${idx}`}
                                className="text-[11px] text-zinc-500 bg-white/5 px-2 py-0.5 rounded hover:text-zinc-300 hover:bg-white/10 transition-colors cursor-default border border-transparent hover:border-white/10"
                            >
                                #{tag.name}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Genres (Secondary Tag Cloud) */}
            {item.genres && item.genres.length > 0 && !isMusicArtist && (
                <div className="space-y-3">
                    <h4 className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold flex items-center gap-1.5">
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

            {/* Related Items (Vertical Sidebar List) */}
            <div className="pt-6 border-t border-white/5">
                <h4 className="text-[10px] uppercase tracking-widest text-zinc-500 font-black mb-4 flex items-center gap-2">
                    <Sparkles className="w-3 h-3" /> Similar Items
                </h4>
                <div className="space-y-4">
                    {/* RelatedItemsRow already renders a row, we might need a RelatedItemsSidebar component 
                        or just pass a 'vertical' prop to RelatedItemsRow if it supports it.
                        Assuming for now it's a row, but visually contained in the side column.
                    */}
                    <RelatedItemsRow sourceItemId={item.id} variant="compact" />
                </div>
            </div>
        </div>
    )
}
