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
    onSimilarItemClick?: (itemId: string) => void
    isRefreshing?: boolean
    isRegenerating?: boolean
    containerVariants: any
    itemVariants: any
    sidebarVariants: any
}

/**
 * Standard two-column layout for Movies, TV, Games, Anime, and Music Albums
 * 
 * Layout Structure:
 * - LEFT: Sidebar with scrollable "Similar Items" section
 * - RIGHT: Fixed header/cast at top, scrollable description in middle, fixed footer at bottom
 */
export function StandardLayout({
    item,
    onEdit,
    onDelete,
    onReportOpen,
    onRefreshMetadata,
    onRegenerateDescription,
    onSimilarItemClick,
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
                    onSimilarItemClick={onSimilarItemClick}
                />
            </motion.div>

            {/* --- RIGHT COLUMN: Content with fixed header/footer and scrollable description --- */}
            <div className="relative z-10 flex-1 flex flex-col p-6 md:p-8 overflow-hidden">
                <motion.div
                    className="flex flex-col h-full"
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                >
                    {/* === FIXED TOP: Header + Awards + Cast === */}
                    <div className="flex-shrink-0 space-y-4">
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

                        {/* Cast Row (Pills) - Fixed above description */}
                        {(isMovie || isTV || isAnime || (item.cast && item.cast.length > 0)) && (
                            <motion.div variants={itemVariants}>
                                <CastRow cast={item.cast || []} />
                            </motion.div>
                        )}
                    </div>

                    {/* === SCROLLABLE MIDDLE: Description === */}
                    {item.description && (
                        <ScrollArea className="flex-1 my-4 -mx-2 px-2 min-h-0">
                            <motion.div
                                variants={itemVariants}
                                className="prose prose-invert max-w-none text-zinc-300 text-base leading-relaxed font-light pr-4"
                            >
                                <ReactMarkdown
                                    components={{
                                        p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                                        strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>
                                    }}
                                >
                                    {item.description}
                                </ReactMarkdown>
                            </motion.div>
                        </ScrollArea>
                    )}

                    {/* === FIXED BOTTOM: Category Specific Footers === */}
                    <div className="flex-shrink-0">
                        {isAnime && <AnimeFooter item={item} itemVariants={itemVariants} />}
                        {isBoardGame && <BoardGameFooter item={item} itemVariants={itemVariants} />}
                        {isVideoGame && <VideoGameFooter item={item} itemVariants={itemVariants} />}
                        {(isMovie || isTV) && <MovieTvFooter item={item} itemVariants={itemVariants} isTV={isTV} />}
                    </div>
                </motion.div>
            </div>
        </div>
    )
}
