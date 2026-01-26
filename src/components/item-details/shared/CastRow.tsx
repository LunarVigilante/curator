'use client'

import React from 'react'
import { Users } from 'lucide-react'
import { motion } from 'framer-motion'

interface CastRowProps {
    cast: string[]
}

/**
    * Horizontal pill-based cast list with "+N more" badge.
    */
export function CastRow({ cast }: CastRowProps) {
    const hasCast = cast && cast.length > 0
    const displayedCast = hasCast ? cast.slice(0, 6) : []
    const remainingCount = hasCast ? cast.length - 6 : 0

    return (
        <div className="space-y-3">
            <h4 className="text-[10px] uppercase tracking-widest text-zinc-500 font-black flex items-center gap-2">
                <Users className="w-3 h-3" /> Cast
            </h4>
            {hasCast ? (
                <div className="flex flex-wrap gap-2">
                    {displayedCast.map((actor, idx) => (
                        <motion.span
                            key={`${actor}-${idx}`}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: idx * 0.05 }}
                            className="px-3 py-1 rounded-full bg-zinc-900 border border-white/5 text-zinc-300 text-xs font-medium hover:bg-zinc-800 hover:text-white transition-colors cursor-default"
                        >
                            {actor}
                        </motion.span>
                    ))}
                    {remainingCount > 0 && (
                        <span className="px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-bold">
                            +{remainingCount} more
                        </span>
                    )}
                </div>
            ) : (
                <p className="text-zinc-500 text-sm italic">Cast information unavailable</p>
            )}
        </div>
    )
}
