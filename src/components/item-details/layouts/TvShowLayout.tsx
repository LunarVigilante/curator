'use client'

import React, { useMemo } from 'react'
import { motion, Variants } from 'framer-motion'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { GlobalItem } from '../types'
import { ItemDetailSidebar, ItemDetailHeader, AwardsBanner, CastRow, SemanticInsightBar, StructuredDescription } from '../shared'
import { MovieTvFooter } from '../footers'

interface TvShowLayoutProps {
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
    containerVariants: Variants
    itemVariants: Variants
    sidebarVariants: Variants
}

// Genre Lens color mapping for TV shows
const GENRE_LENS_COLORS: Record<string, { accent: string; glow: string }> = {
    'Crime': { accent: 'border-red-800/50', glow: 'shadow-red-900/20' },
    'Sci-Fi': { accent: 'border-cyan-500/50', glow: 'shadow-cyan-900/20' },
    'Science Fiction': { accent: 'border-cyan-500/50', glow: 'shadow-cyan-900/20' },
    'Comedy': { accent: 'border-amber-500/50', glow: 'shadow-amber-900/20' },
    'Drama': { accent: 'border-purple-600/50', glow: 'shadow-purple-900/20' },
    'Horror': { accent: 'border-red-600/50', glow: 'shadow-red-900/20' },
    'Fantasy': { accent: 'border-violet-500/50', glow: 'shadow-violet-900/20' },
    'Action': { accent: 'border-orange-500/50', glow: 'shadow-orange-900/20' },
    'Thriller': { accent: 'border-slate-500/50', glow: 'shadow-slate-900/20' },
    'Documentary': { accent: 'border-emerald-500/50', glow: 'shadow-emerald-900/20' },
    'Animation': { accent: 'border-pink-500/50', glow: 'shadow-pink-900/20' },
    'Romance': { accent: 'border-rose-500/50', glow: 'shadow-rose-900/20' },
    'Mystery': { accent: 'border-indigo-500/50', glow: 'shadow-indigo-900/20' },
    'Reality': { accent: 'border-yellow-500/50', glow: 'shadow-yellow-900/20' },
}

/**
 * TV Show-specific detail layout
 * 
 * Unique TV Features:
 * - SemanticInsightBar (Narrative Engine, Archetypes, Tropes, Safe Binge status)
 * - StructuredDescription with section headers (Premise/Thematic/Atmosphere)
 * - Binge Metrics row in header (Seasons • Episodes • Year Range • Network)
 * - Genre Lens dynamic accent colors
 * - TV-specific footer with creative/production/format/run columns
 * 
 * Layout Structure:
 * - LEFT: Sidebar with poster, similar items, tags
 * - RIGHT: Header (with binge metrics), awards, cast, semantic insights, structured description, footer
 */
export function TvShowLayout({
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
}: TvShowLayoutProps) {
    // Determine genre lens accent colors
    const genreLensStyle = useMemo(() => {
        const primaryGenre = item.genres?.[0]
        if (!primaryGenre) return { accent: '', glow: '' }
        return GENRE_LENS_COLORS[primaryGenre] || { accent: '', glow: '' }
    }, [item.genres])

    return (
        <div className={`relative z-10 flex flex-wrap md:flex-nowrap items-stretch w-full h-full overflow-hidden ${genreLensStyle.glow}`}>
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
                className="relative z-10 p-6 md:p-8 md:pr-4 flex-[1_1_280px] min-w-[280px] max-w-[350px] overflow-y-auto mx-auto md:mx-0 scrollbar-thin"
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

            {/* --- RIGHT COLUMN: Content with Genre Accent Border --- */}
            <div className={`relative z-10 flex-[2.5_1_450px] min-w-[450px] flex flex-col p-6 md:p-8 overflow-hidden ${genreLensStyle.accent ? `border-l-2 ${genreLensStyle.accent}` : ''}`}>
                <motion.div
                    className="flex flex-col h-full"
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                >
                    {/* === FIXED TOP: Header + Awards (conditional) + Cast === */}
                    <div className="flex-shrink-0 w-full">
                        {/* Header with Binge Metrics */}
                        <motion.div variants={itemVariants}>
                            <ItemDetailHeader item={item} />
                        </motion.div>

                        {/* Awards Banner - only render if has awards */}
                        {item.awards_text && (
                            <div className="mt-4">
                                <AwardsBanner awards={item.awards_text} />
                            </div>
                        )}

                        {/* Cast Row */}
                        {item.cast && item.cast.length > 0 && (
                            <motion.div variants={itemVariants} className="mt-4">
                                <CastRow cast={item.cast} />
                            </motion.div>
                        )}
                    </div>

                    {/* === SCROLLABLE MIDDLE: Semantic Insights + Structured Description === */}
                    <ScrollArea className="flex-1 my-4 -mx-2 px-2 min-h-0 overflow-y-auto">
                        <motion.div variants={itemVariants} className="pr-4 space-y-4">
                            {/* Structured Description with section headers */}
                            <StructuredDescription item={item} />
                        </motion.div>
                    </ScrollArea>

                    {/* === FIXED BOTTOM: TV-specific Footer === */}
                    <div className="flex-shrink-0">
                        <MovieTvFooter item={item} itemVariants={itemVariants} isTV={true} />
                    </div>
                </motion.div>
            </div>
        </div>
    )
}
