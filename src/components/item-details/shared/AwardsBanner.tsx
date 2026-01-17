'use client'

import React from 'react'
import { Trophy } from 'lucide-react'
import { motion } from 'framer-motion'

interface AwardsBannerProps {
    awards: string
}

/**
    * High-fidelity gold-themed awards banner as seen in the reference design.
    */
export function AwardsBanner({ awards }: AwardsBannerProps) {
    if (!awards) return null

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full py-2.5 px-4 rounded-lg bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 flex items-center gap-3"
        >
            <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                <Trophy className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-amber-200/90 text-sm font-medium tracking-wide">
                {awards}
            </p>
        </motion.div>
    )
}
