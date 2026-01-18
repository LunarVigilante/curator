'use client'

import React from 'react'
import { motion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { GlobalItem } from '../types'
import { normalizeCategory } from '../utils'
import { ItemDetailSidebar, ItemDetailHeader, AwardsBanner, CastRow } from '../shared'
import { AnimeFooter, BoardGameFooter, VideoGameFooter, MovieTvFooter } from '../footers'

interface StandardLayoutProps {
    item: GlobalItem
    onEdit: (item: GlobalItem) => void
    onDelete: (id: string) => void
    onReportOpen: () => void
    onClose: () => void
    onItemChange?: (item: GlobalItem | null) => void
    onRefreshMetadata?: () => void
    onRegenerateDescription?: () => void
    isRefreshing?: boolean
    isRegenerating?: boolean
    containerVariants: any
    itemVariants: any
    sidebarVariants: any
}

/**
 * Standard two-column layout for Movies, TV, Games, Anime, and Music Albums
 */
export function StandardLayout({
    item,
    onEdit,
    onDelete,
    onReportOpen,
    onClose,
    onItemChange,
    onRefreshMetadata,
    onRegenerateDescription,
    isRefreshing,
    isRegenerating,
    containerVariants,
    itemVariants,
    sidebarVariants
}: StandardLayoutProps) {
    const category = normalizeCategory(item.category_type)
    const isAnime = category === 'ANIME'
    const isBoardGame = category === 'BOARD_GAME'
    const isVideoGame = category === 'VIDEO_GAME'
    const isMovie = category === 'MOVIE'
    const isTV = category === 'TV' || category === 'TV_SHOW'
    const isMusicAlbum = category === 'MUSIC_ALBUM'
    const isMusicArtist = category === 'MUSIC_ARTIST'

    // Cast display logic
    const displayedCast = item.cast?.slice(0, 10).join(', ')
    const hasMoreCast = (item.cast?.length || 0) > 10

    return (
        <div className="relative z-10 flex flex-col md:flex-row w-full h-full">
            {/* Backdrop */}
            {item.backdrop_path && (
                <>
                    <div
                        className="absolute inset-0 bg-cover bg-center blur-3xl opacity-20 scale-110"
                        style={{ backgroundImage: `url(${item.backdrop_path})` }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-br from-zinc-950/95 via-zinc-950/80 to-zinc-950/60" />
                </>
            )}

            {/* --- LEFT COLUMN: Sidebar --- */}
            <motion.div
                className="relative z-10 p-6 md:p-8 md:pr-0"
                variants={sidebarVariants}
                initial="hidden"
                animate="visible"
            >
                <ItemDetailSidebar
                    item={item}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onReportOpen={onReportOpen}
                    onRefreshMetadata={onRefreshMetadata}
                    onRegenerateDescription={onRegenerateDescription}
                    isRefreshing={isRefreshing}
                    isRegenerating={isRegenerating}
                />
            </motion.div>

            {/* --- RIGHT COLUMN: Content --- */}
            <div className="relative z-10 flex-1 flex flex-col p-6 md:p-8 overflow-hidden">
                {/* Close Button placed here for mobile access, though usually in Dialog wrapper */}
                {/* (Handled by parent Dialog usually, but keeping layout distinct) */}

                <ScrollArea className="flex-1 -mx-2 px-2">
                    <motion.div
                        className="space-y-8 pb-10"
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                    >
                        {/* Header Section */}
                        <motion.div variants={itemVariants}>
                            <ItemDetailHeader item={item} />
                        </motion.div>

                        {/* Awards Banner */}
                        {item.awards_text && (
                            <motion.div variants={itemVariants}>
                                <AwardsBanner awards={item.awards_text} />
                            </motion.div>
                        )}

                        {/* Cast Row (Pills) */}
                        {item.cast && item.cast.length > 0 && (
                            <motion.div variants={itemVariants}>
                                <CastRow cast={item.cast} />
                            </motion.div>
                        )}

                        {/* Description */}
                        {item.description && (
                            <motion.div
                                variants={itemVariants}
                                className="prose prose-invert max-w-none text-zinc-300 text-lg leading-relaxed font-light"
                            >
                                <ReactMarkdown
                                    components={{
                                        p: ({ children }) => <p className="mb-4 last:mb-0">{children}</p>,
                                        strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>
                                    }}
                                >
                                    {item.description}
                                </ReactMarkdown>
                            </motion.div>
                        )}

                        {/* Category Specific Footers (Refined 4-column grid) */}
                        {isAnime && <AnimeFooter item={item} itemVariants={itemVariants} />}
                        {isBoardGame && <BoardGameFooter item={item} itemVariants={itemVariants} />}
                        {isVideoGame && <VideoGameFooter item={item} itemVariants={itemVariants} />}
                        {(isMovie || isTV) && <MovieTvFooter item={item} itemVariants={itemVariants} isTV={isTV} />}

                    </motion.div>
                </ScrollArea>
            </div>
        </div>
    )
}
