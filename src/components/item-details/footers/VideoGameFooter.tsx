'use client'

import { motion } from 'framer-motion'
import { Activity, Building, Gamepad2, Star } from 'lucide-react'
import type { GlobalItem } from '../types'

interface VideoGameFooterProps {
    item: GlobalItem
    itemVariants: any
}

/**
 * Video Game-specific footer grid with Length/Mode, Developer, Genre, and IGDB Score columns
 */
export function VideoGameFooter({ item, itemVariants }: VideoGameFooterProps) {
    const ttb = item.time_to_beat as { main?: number; completionist?: number } | null
    const gameModes = item.game_modes as string[] | null

    // Determine what data we have for each column
    const hasLengthOrMode = (ttb?.main) || (gameModes && gameModes.length > 0)
    const hasDeveloper = (item.developers && item.developers.length > 0) || (item.publishers && item.publishers.length > 0)
    const hasGenre = item.genres && item.genres.length > 0
    const hasScore = item.vote_average !== null && item.vote_average > 0

    // Only render grid if we have something
    if (!hasLengthOrMode && !hasDeveloper && !hasGenre && !hasScore) return null

    return (
        <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4 py-6 border-t border-white/5 mt-2">

            {/* Col 1: Length / Mode */}
            {hasLengthOrMode && (
                <div className="space-y-3">
                    <h5 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest flex items-center gap-1.5">
                        <Activity className="w-3 h-3" /> Length / Mode
                    </h5>
                    <div className="space-y-1">
                        <span className="text-white font-semibold text-sm block">
                            {ttb?.main ? `${ttb.main}h` : (gameModes?.[0] || 'N/A')}
                        </span>
                        {ttb?.completionist && (
                            <span className="text-zinc-500 text-xs block">
                                {ttb.completionist}h (100%)
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* Col 2: Developer */}
            {hasDeveloper && (
                <div className="space-y-3">
                    <h5 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest flex items-center gap-1.5">
                        <Building className="w-3 h-3" /> Developer
                    </h5>
                    <div className="space-y-1">
                        <span className="text-white font-medium text-sm block">
                            {item.developers?.[0] || item.publishers?.[0] || 'Unknown'}
                        </span>
                        {item.developers?.[0] && item.publishers?.[0] && (
                            <span className="text-zinc-500 text-xs block">Pub: {item.publishers[0]}</span>
                        )}
                    </div>
                </div>
            )}

            {/* Col 3: Genre */}
            {item.genres && item.genres.length > 0 && (
                <div className="space-y-3">
                    <h5 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest flex items-center gap-1.5">
                        <Gamepad2 className="w-3 h-3" /> Genre
                    </h5>
                    <div className="space-y-1">
                        <span className="text-white font-medium text-sm block">{item.genres[0]}</span>
                        {item.genres.length > 1 && (
                            <span className="text-zinc-500 text-xs block">{item.genres.slice(1, 3).join(', ')}</span>
                        )}
                    </div>
                </div>
            )}

            {/* Col 4: IGDB Score */}
            {hasScore && (
                <div className="space-y-3">
                    <h5 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest flex items-center gap-1.5">
                        <Star className="w-3 h-3" /> IGDB Score
                    </h5>
                    <div className="space-y-1">
                        <span className="text-violet-400 font-semibold text-sm block">
                            {item.vote_average!.toFixed(1)}
                        </span>
                        {item.vote_count !== null && item.vote_count > 0 && (
                            <span className="text-zinc-500 text-xs block">
                                ({item.vote_count} Reviews)
                            </span>
                        )}
                    </div>
                </div>
            )}

        </motion.div>
    )
}
