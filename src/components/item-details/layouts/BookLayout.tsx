'use client'

import React from 'react'
import { motion } from 'framer-motion'
import Image from 'next/image'
import ReactMarkdown from 'react-markdown'
import {
    BookOpen, Star, ExternalLink, Pencil, Trash2, ChevronUp, ChevronDown, Tag as TagIcon,
    RefreshCw, Wand2, X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { GlobalItem } from '../types'
import { cleanTitle } from '../utils'

interface BookLayoutProps {
    item: GlobalItem
    descriptionExpanded: boolean
    onToggleDescription: () => void
    onEdit: (item: GlobalItem) => void
    onDelete: (id: string) => void
    onClose: () => void
    onRefreshMetadata?: () => void
    onRegenerateDescription?: () => void
    isRefreshing?: boolean
    isRegenerating?: boolean
    containerVariants: any
    itemVariants: any
    sidebarVariants: any
}

/**
 * Book-specific two-column layout with cover, metadata grid, and description
 */
export function BookLayout({
    item,
    descriptionExpanded,
    onToggleDescription,
    onEdit,
    onDelete,
    onClose,
    onRefreshMetadata,
    onRegenerateDescription,
    isRefreshing,
    isRegenerating,
    containerVariants,
    itemVariants,
    sidebarVariants
}: BookLayoutProps) {
    const metadata = item.metadata as Record<string, any> || {}

    return (
        <div className="relative z-10 flex flex-col md:flex-row w-full h-full">
            {/* Atmospheric Book Cover Background */}
            {item.image_url && (
                <>
                    <div
                        className="absolute inset-0 bg-cover bg-center blur-3xl opacity-30 scale-110"
                        style={{ backgroundImage: `url(${item.image_url})` }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-br from-zinc-950/90 via-zinc-950/80 to-zinc-950/70" />
                </>
            )}

            {/* --- LEFT COLUMN: Book Cover --- */}
            <motion.div
                className="relative z-10 w-full md:w-[300px] flex-shrink-0 flex flex-col items-center p-6 md:p-8"
                variants={sidebarVariants}
                initial="hidden"
                animate="visible"
            >
                {/* Book Cover */}
                <div className="relative w-48 md:w-56 aspect-[2/3] rounded-lg overflow-hidden shadow-2xl shadow-black/50 ring-1 ring-white/10 mb-6">
                    {item.image_url ? (
                        <Image
                            src={item.image_url}
                            alt={item.title}
                            fill
                            className="object-cover"
                            unoptimized
                        />
                    ) : (
                        <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                            <BookOpen className="w-16 h-16 text-zinc-700" />
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2 justify-center">
                    {item.external_ids?.google && (
                        <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20"
                        >
                            <a
                                href={`https://books.google.com/books?id=${item.external_ids.google}`}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                                Preview
                            </a>
                        </Button>
                    )}
                    {metadata?.isbn && (
                        <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
                        >
                            <a
                                href={`https://www.goodreads.com/search?q=${metadata?.isbn}`}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <Star className="w-3.5 h-3.5 mr-1.5" />
                                Goodreads
                            </a>
                        </Button>
                    )}

                    {onRefreshMetadata && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="text-zinc-400 border-zinc-700 hover:bg-zinc-800"
                            onClick={onRefreshMetadata}
                            disabled={isRefreshing}
                        >
                            <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", isRefreshing && "animate-spin")} />
                            {isRefreshing ? '...' : 'Refresh'}
                        </Button>
                    )}
                    {onRegenerateDescription && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="text-zinc-400 border-zinc-700 hover:bg-zinc-800"
                            onClick={onRegenerateDescription}
                            disabled={isRegenerating}
                        >
                            <Wand2 className={cn("w-3.5 h-3.5 mr-1.5", isRegenerating && "animate-pulse")} />
                            {isRegenerating ? '...' : 'Regen'}
                        </Button>
                    )}

                    <Button variant="outline" size="sm" className="text-zinc-400 border-zinc-700 hover:bg-zinc-800" onClick={() => onEdit(item)}>
                        <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
                    </Button>
                    <Button variant="outline" size="sm" className="text-red-400 border-zinc-700 hover:bg-red-500/10" onClick={() => onDelete(item.id)}>
                        <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete
                    </Button>
                </div>
            </motion.div>

            {/* --- RIGHT COLUMN: Content --- */}
            <div className="relative z-10 flex-1 flex flex-col p-6 md:p-8 overflow-hidden">
                {/* Close Button */}
                <Button
                    onClick={onClose}
                    size="icon"
                    variant="ghost"
                    className="absolute top-4 right-4 h-10 w-10 rounded-full bg-black/20 hover:bg-black/40 text-white z-50"
                >
                    <X className="w-5 h-5" />
                </Button>

                <ScrollArea className="flex-1 -mx-2 px-2">
                    <motion.div
                        className="space-y-6"
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                    >
                        {/* Header */}
                        <motion.div variants={itemVariants}>
                            <Badge variant="outline" className="mb-3 text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                                <BookOpen className="w-3 h-3 mr-1" /> Book
                            </Badge>
                            <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight mb-2">
                                {cleanTitle(item.title)}
                            </h2>
                            {/* Author Line */}
                            {metadata?.authors && (
                                <p className="text-lg text-zinc-400">
                                    by <span className="text-cyan-400 font-medium">
                                        {(metadata?.authors as string[])?.join(', ')}
                                    </span>
                                </p>
                            )}
                            {item.release_year && (
                                <p className="text-sm text-zinc-500 mt-1">{item.release_year}</p>
                            )}
                        </motion.div>

                        {/* Enriched Metadata Grid */}
                        <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {metadata?.page_count && (
                                <div className="bg-zinc-900/50 rounded-xl p-3 backdrop-blur-sm">
                                    <p className="text-lg font-bold text-white">
                                        {metadata?.page_count}
                                    </p>
                                    <p className="text-xs text-zinc-500 uppercase tracking-wider">Pages</p>
                                </div>
                            )}
                            {metadata?.publisher && (
                                <div className="bg-zinc-900/50 rounded-xl p-3 backdrop-blur-sm">
                                    <p className="text-sm font-medium text-white truncate" title={metadata?.publisher}>
                                        {metadata?.publisher}
                                    </p>
                                    <p className="text-xs text-zinc-500 uppercase tracking-wider">Publisher</p>
                                </div>
                            )}
                            {metadata?.isbn && (
                                <div className="bg-zinc-900/50 rounded-xl p-3 backdrop-blur-sm">
                                    <p className="text-sm font-mono text-white">
                                        {metadata?.isbn}
                                    </p>
                                    <p className="text-xs text-zinc-500 uppercase tracking-wider">ISBN</p>
                                </div>
                            )}
                            {metadata?.average_rating && (
                                <div className="bg-zinc-900/50 rounded-xl p-3 backdrop-blur-sm">
                                    <p className="text-lg font-bold text-amber-400 flex items-center gap-1">
                                        <Star className="w-4 h-4 fill-amber-400" />
                                        {metadata?.average_rating}/5
                                    </p>
                                    <p className="text-xs text-zinc-500 uppercase tracking-wider">Rating</p>
                                </div>
                            )}
                        </motion.div>

                        {/* Genres */}
                        {item.genres && item.genres.length > 0 && (
                            <motion.div variants={itemVariants} className="flex flex-wrap gap-2">
                                {item.genres.slice(0, 8).map(genre => (
                                    <Badge key={genre} variant="outline" className="text-zinc-400 border-white/10 bg-white/5">
                                        {genre}
                                    </Badge>
                                ))}
                            </motion.div>
                        )}

                        {/* Description with Read Deep Dive */}
                        {item.description && (
                            <motion.div variants={itemVariants} className="space-y-2">
                                <div className={cn(
                                    "text-zinc-300 text-sm leading-relaxed",
                                    !descriptionExpanded && "line-clamp-4"
                                )}>
                                    <ReactMarkdown
                                        components={{
                                            p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                                            strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
                                            em: ({ children }) => <em className="italic text-zinc-400">{children}</em>,
                                        }}
                                    >
                                        {item.description}
                                    </ReactMarkdown>
                                </div>
                                {item.description.length > 300 && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={onToggleDescription}
                                        className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 p-0 h-auto"
                                    >
                                        {descriptionExpanded ? (
                                            <>
                                                <ChevronUp className="w-4 h-4 mr-1" /> Show Less
                                            </>
                                        ) : (
                                            <>
                                                <ChevronDown className="w-4 h-4 mr-1" /> Read Deep Dive
                                            </>
                                        )}
                                    </Button>
                                )}
                            </motion.div>
                        )}

                        {/* Tags */}
                        {item.cached_tags && item.cached_tags.length > 0 && (
                            <motion.div variants={itemVariants} className="space-y-2">
                                <h4 className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold flex items-center gap-1.5">
                                    <TagIcon className="w-3 h-3" /> Tags
                                </h4>
                                <div className="flex flex-wrap gap-1.5">
                                    {item.cached_tags.slice(0, 15).map((tag, idx) => (
                                        <span key={`${tag.id}-${idx}`} className="text-[11px] text-zinc-500 bg-black/40 px-2 py-0.5 rounded hover:text-zinc-300 hover:bg-black/60 transition-colors cursor-default border border-transparent hover:border-white/10">
                                            #{tag.name}
                                        </span>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </motion.div>
                </ScrollArea>
            </div>
        </div>
    )
}

