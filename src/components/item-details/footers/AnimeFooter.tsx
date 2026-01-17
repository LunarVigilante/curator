'use client'

import { motion } from 'framer-motion'
import { Building, Calendar, Film, Pencil } from 'lucide-react'
import type { GlobalItem } from '../types'
import { isValidValue, toTitleCase, formatAnimeSeason, getLanguageName } from '../utils'

interface AnimeFooterProps {
    item: GlobalItem
    itemVariants: any
}

/**
 * Anime-specific footer grid with Studio, Season, Format, and Creatives columns
 */
export function AnimeFooter({ item, itemVariants }: AnimeFooterProps) {
    const hasStudio = isValidValue(item.studio)
    const hasSeason = isValidValue(item.season) || isValidValue(item.release_year)
    const hasEpisodes = (item.episodes && item.episodes > 0) || (item.runtime && item.runtime > 0)
    const hasCreatives = isValidValue(item.director) || isValidValue(item.original_creator)

    if (!hasStudio && !hasSeason && !hasEpisodes && !hasCreatives) return null

    return (
        <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4 py-6 border-t border-white/5 mt-2">

            {/* Col 1: Production (Crucial) */}
            {hasStudio && (
                <div className="space-y-3">
                    <h5 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest flex items-center gap-1.5">
                        <Building className="w-3 h-3" /> Studio
                    </h5>
                    <div className="space-y-1">
                        <span className="text-white font-semibold text-sm block">{item.studio}</span>
                        {isValidValue(item.source_material) && (
                            <span className="text-zinc-500 text-xs block">Source: {toTitleCase(item.source_material)}</span>
                        )}
                    </div>
                </div>
            )}

            {/* Col 2: Release Context */}
            {hasSeason && (
                <div className="space-y-3">
                    <h5 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest flex items-center gap-1.5">
                        <Calendar className="w-3 h-3" /> Season
                    </h5>
                    <div className="space-y-1">
                        <span className="text-pink-200 font-medium text-sm capitalize block">
                            {formatAnimeSeason(item.season, item.release_year)}
                        </span>
                        {isValidValue(item.status) && (
                            <span className="text-zinc-500 text-xs capitalize block">{item.status}</span>
                        )}
                        {/* Only show language if NOT Japanese (assumed default for anime) */}
                        {getLanguageName(item.original_language) &&
                            item.original_language !== 'ja' &&
                            item.original_language?.toLowerCase() !== 'japanese' && (
                                <span className="text-zinc-500 text-xs block">{getLanguageName(item.original_language)}</span>
                            )}
                    </div>
                </div>
            )}

            {/* Col 3: Format */}
            {hasEpisodes && (
                <div className="space-y-3">
                    <h5 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest flex items-center gap-1.5">
                        <Film className="w-3 h-3" /> Format
                    </h5>
                    <div className="space-y-1">
                        {item.episodes && item.episodes > 0 && (
                            <span className="text-white font-medium text-sm block">{item.episodes} eps</span>
                        )}
                        {item.runtime && item.runtime > 0 && (
                            <span className="text-zinc-500 text-xs block">{item.runtime}m per ep</span>
                        )}
                    </div>
                </div>
            )}

            {/* Col 4: Creatives */}
            {hasCreatives && (
                <div className="space-y-3">
                    <h5 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest flex items-center gap-1.5">
                        <Pencil className="w-3 h-3" /> Creatives
                    </h5>
                    <div className="space-y-1">
                        {isValidValue(item.director) && (
                            <span className="text-sm block">
                                <span className="text-zinc-500">Director: </span>
                                <span className="text-zinc-200 font-medium">{item.director}</span>
                            </span>
                        )}
                        {isValidValue(item.original_creator) && (
                            <span className="text-sm block">
                                <span className="text-zinc-500">Creator: </span>
                                <span className="text-zinc-200 font-medium">{item.original_creator}</span>
                            </span>
                        )}
                    </div>
                </div>
            )}

        </motion.div>
    )
}
