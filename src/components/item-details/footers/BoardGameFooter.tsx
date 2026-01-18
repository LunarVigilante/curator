'use client'

import { motion } from 'framer-motion'
import { Users, Activity, Dice5, Building } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { GlobalItem } from '../types'
import { getComplexityData } from '../utils'

interface BoardGameFooterProps {
    item: GlobalItem
    itemVariants: any
}

/**
 * Board Game-specific footer grid with Players, Playtime, Complexity, and Publisher columns
 */
export function BoardGameFooter({ item, itemVariants }: BoardGameFooterProps) {
    const hasPlayers = (item.min_players && item.min_players > 0) || (item.max_players && item.max_players > 0)
    const hasTime = (item.min_playtime && item.min_playtime > 0) || (item.max_playtime && item.max_playtime > 0) || (item.min_age && item.min_age > 0)
    const hasComplexity = item.complexity !== null && item.complexity > 0
    const hasProduction = (item.publishers && item.publishers.length > 0) || (item.artists && item.artists.length > 0)

    if (!hasPlayers && !hasTime && !hasComplexity && !hasProduction) return null

    return (
        <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4 py-6 border-t border-white/5 mt-2">

            {/* Col 1: Player Count */}
            {hasPlayers && (
                <div className="space-y-3">
                    <h5 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest flex items-center gap-1.5">
                        <Users className="w-3 h-3" /> Players
                    </h5>
                    <div className="space-y-1">
                        <span className="text-white font-semibold text-sm block">
                            {item.min_players === item.max_players
                                ? `${item.min_players}`
                                : `${item.min_players || '?'}-${item.max_players || '?'}`
                            }
                        </span>
                        {item.best_players && (
                            <span className="text-green-400 text-xs block font-medium">
                                Best: {item.best_players}
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* Col 2: Time & Age */}
            {hasTime && (
                <div className="space-y-3">
                    <h5 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest flex items-center gap-1.5">
                        <Activity className="w-3 h-3" /> Playtime
                    </h5>
                    <div className="space-y-1">
                        {(item.min_playtime || item.max_playtime) && (
                            <span className="text-white font-medium text-sm block">
                                {item.min_playtime === item.max_playtime
                                    ? `${item.min_playtime} Min`
                                    : `${item.min_playtime || '?'}-${item.max_playtime || '?'} Min`
                                }
                            </span>
                        )}
                        {(item.min_age || item.min_age_community) && (
                            <span className="text-zinc-500 text-xs block">
                                Age: {item.min_age_community || item.min_age}+
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* Col 3: Complexity */}
            {hasComplexity && (() => {
                const { label, color } = getComplexityData(item.complexity)
                return (
                    <div className="space-y-3">
                        <h5 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest flex items-center gap-1.5">
                            <Dice5 className="w-3 h-3" /> Complexity
                        </h5>
                        <div className="space-y-1">
                            <span className={cn("font-semibold text-sm block", color)}>
                                {label}
                            </span>
                            <span className="text-zinc-500 text-xs block">
                                ({item.complexity!.toFixed(1)} / 5)
                            </span>
                        </div>
                    </div>
                )
            })()}

            {/* Col 4: Production */}
            {hasProduction && (
                <div className="space-y-3">
                    <h5 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest flex items-center gap-1.5">
                        <Building className="w-3 h-3" /> Publisher
                    </h5>
                    <div className="space-y-1">
                        {item.publishers && item.publishers.length > 0 && (
                            <span className="text-white font-medium text-sm block">{item.publishers[0]}</span>
                        )}
                        {item.artists && item.artists.length > 0 && (
                            <span className="text-zinc-500 text-xs block">Art: {item.artists[0]}</span>
                        )}
                    </div>
                </div>
            )}

        </motion.div>
    )
}
