'use client'

import React from 'react'
import { Gem, Drama, FlaskConical, CheckCircle2, AlertTriangle, Flame } from 'lucide-react'
import type { GlobalItem } from '../types'

interface SemanticInsightBarProps {
    item: GlobalItem
}

/**
 * High-visibility semantic insight bar showing:
 * - Narrative Engine (Save the Cat classification)
 * - Key Archetype (first harvested archetype)
 * - Core Trope (from keywords/themes)
 * - Story Status (cliffhanger tier badge)
 */
export function SemanticInsightBar({ item }: SemanticInsightBarProps) {
    const metadata = item.metadata as Record<string, unknown> || {}

    // Extract semantic data
    const saveTheCat = metadata.save_the_cat as string | undefined
    const archetypes = metadata.archetypes as string[] | undefined
    const keywords = item.keywords || item.themes || []
    const cliffhangerTier = (item as { cliffhanger_tier?: string }).cliffhanger_tier

    // Only show for TV shows with semantic data
    const hasSemanticData = saveTheCat || (archetypes && archetypes.length > 0) ||
        keywords.length > 0 || cliffhangerTier

    if (!hasSemanticData) return null

    // Story status badge configuration
    const getStoryStatus = () => {
        switch (cliffhangerTier) {
            case 'none':
            case 'resolved':
                return { icon: CheckCircle2, label: 'Complete Story', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' }
            case 'unresolved':
                return { icon: AlertTriangle, label: 'Open-Ended', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30' }
            case 'cliffhanger':
                return { icon: Flame, label: 'Major Cliffhanger', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30' }
            default:
                return null
        }
    }

    const storyStatus = getStoryStatus()
    const primaryArchetype = archetypes?.[0]
    const primaryTrope = keywords[0]

    return (
        <div className="flex flex-wrap gap-2 py-3">
            {/* Narrative Engine - Save the Cat */}
            {saveTheCat && (
                <InsightChip
                    icon={<Gem className="w-3.5 h-3.5 text-purple-400" />}
                    label="Narrative"
                    value={saveTheCat}
                    className="bg-purple-500/10 border-purple-500/30"
                />
            )}

            {/* Key Archetype */}
            {primaryArchetype && (
                <InsightChip
                    icon={<Drama className="w-3.5 h-3.5 text-blue-400" />}
                    label="Archetype"
                    value={primaryArchetype}
                    className="bg-blue-500/10 border-blue-500/30"
                />
            )}

            {/* Core Trope */}
            {primaryTrope && (
                <InsightChip
                    icon={<FlaskConical className="w-3.5 h-3.5 text-cyan-400" />}
                    label="Trope"
                    value={primaryTrope}
                    className="bg-cyan-500/10 border-cyan-500/30"
                />
            )}

            {/* Story Status */}
            {storyStatus && (
                <InsightChip
                    icon={<storyStatus.icon className={`w-3.5 h-3.5 ${storyStatus.color}`} />}
                    label="Story"
                    value={storyStatus.label}
                    className={storyStatus.bg}
                />
            )}
        </div>
    )
}

function InsightChip({
    icon,
    label,
    value,
    className = ''
}: {
    icon: React.ReactNode
    label: string
    value: string
    className?: string
}) {
    return (
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${className}`}>
            {icon}
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</span>
            <span className="text-xs text-white font-medium">{value}</span>
        </div>
    )
}
