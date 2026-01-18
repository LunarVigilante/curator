'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Info, Users, User, Scale, TrendingUp, Award } from 'lucide-react'

// Types from Phase 2 agent orchestrator
export interface RankingJustification {
    recommended_tier: 'S' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F'
    confidence: number
    borda_influence: number
    topsis_influence: number
    reasoning: string
    // Extended data for rich display
    borda_score?: number
    voter_count?: number
    tier_distribution?: Record<string, number>
    criteria_breakdown?: Array<{
        name: string
        score: number
        weight: number
        contribution: number // How much this criterion affected final score
    }>
}

interface JustificationPanelProps {
    itemName: string
    itemImage?: string | null
    justification: RankingJustification
    className?: string
}

const TIER_COLORS: Record<string, string> = {
    'S': 'bg-red-500',
    'A': 'bg-orange-500',
    'B': 'bg-yellow-500',
    'C': 'bg-green-500',
    'D': 'bg-blue-500',
    'E': 'bg-indigo-500',
    'F': 'bg-purple-500',
}

const TIER_DESCRIPTIONS: Record<string, string> = {
    'S': 'Exceptional - Top tier',
    'A': 'Excellent - Highly recommended',
    'B': 'Great - Above average',
    'C': 'Good - Solid choice',
    'D': 'Fair - Has merit',
    'E': 'Below Average',
    'F': 'Poor - Not recommended',
}

export function JustificationPanel({
    itemName,
    itemImage,
    justification,
    className = ''
}: JustificationPanelProps) {
    const {
        recommended_tier,
        confidence,
        borda_influence,
        topsis_influence,
        reasoning,
        borda_score,
        voter_count,
        tier_distribution,
        criteria_breakdown
    } = justification

    return (
        <TooltipProvider>
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={className}
            >
                <Card className="bg-black/80 backdrop-blur-md border-white/10">
                    <CardHeader className="pb-3">
                        <div className="flex items-center gap-3">
                            {itemImage && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={itemImage}
                                    alt={itemName}
                                    className="w-12 h-12 rounded object-cover"
                                />
                            )}
                            <div className="flex-1 min-w-0">
                                <CardTitle className="text-lg truncate text-white">
                                    {itemName}
                                </CardTitle>
                                <div className="flex items-center gap-2 mt-1">
                                    <Badge className={`${TIER_COLORS[recommended_tier]} text-white font-bold`}>
                                        {recommended_tier} Tier
                                    </Badge>
                                    <span className="text-xs text-white/60">
                                        {TIER_DESCRIPTIONS[recommended_tier]}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                        {/* Confidence Score */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-white/70 flex items-center gap-1.5">
                                    <Award className="w-4 h-4" />
                                    Ranking Confidence
                                </span>
                                <span className="text-white font-medium">
                                    {Math.round(confidence * 100)}%
                                </span>
                            </div>
                            <Progress value={confidence * 100} className="h-2" />
                        </div>

                        {/* Influence Sources */}
                        <div className="space-y-2">
                            <h4 className="text-sm font-medium text-white/80 flex items-center gap-1.5">
                                <Scale className="w-4 h-4" />
                                Ranking Sources
                            </h4>

                            <div className="grid grid-cols-2 gap-3">
                                {/* Borda (Community) */}
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="bg-white/5 rounded-lg p-3 cursor-help">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Users className="w-4 h-4 text-blue-400" />
                                                <span className="text-xs font-medium text-white/80">
                                                    Community
                                                </span>
                                            </div>
                                            <div className="text-2xl font-bold text-blue-400">
                                                {Math.round(borda_influence * 100)}%
                                            </div>
                                            {borda_score !== undefined && (
                                                <div className="text-xs text-white/50 mt-1">
                                                    Score: {borda_score.toFixed(2)} ({voter_count} votes)
                                                </div>
                                            )}
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p className="max-w-xs">
                                            <strong>Borda Count</strong> - Aggregated tier rankings from all users.
                                            Higher influence when more people have ranked this item.
                                        </p>
                                    </TooltipContent>
                                </Tooltip>

                                {/* TOPSIS (Personal) */}
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="bg-white/5 rounded-lg p-3 cursor-help">
                                            <div className="flex items-center gap-2 mb-2">
                                                <User className="w-4 h-4 text-purple-400" />
                                                <span className="text-xs font-medium text-white/80">
                                                    Personal Fit
                                                </span>
                                            </div>
                                            <div className="text-2xl font-bold text-purple-400">
                                                {Math.round(topsis_influence * 100)}%
                                            </div>
                                            <div className="text-xs text-white/50 mt-1">
                                                Based on your criteria
                                            </div>
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p className="max-w-xs">
                                            <strong>TOPSIS Score</strong> - Personalized ranking based on
                                            your weighted criteria preferences.
                                        </p>
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                        </div>

                        {/* Tier Distribution (if available) */}
                        {tier_distribution && Object.keys(tier_distribution).length > 0 && (
                            <div className="space-y-2">
                                <h4 className="text-sm font-medium text-white/80 flex items-center gap-1.5">
                                    <TrendingUp className="w-4 h-4" />
                                    Community Distribution
                                </h4>
                                <div className="flex gap-1">
                                    {['S', 'A', 'B', 'C', 'D', 'E', 'F'].map(tier => {
                                        const count = tier_distribution[tier] || 0
                                        const total = Object.values(tier_distribution).reduce((a, b) => a + b, 0)
                                        const pct = total > 0 ? (count / total) * 100 : 0

                                        return pct > 0 ? (
                                            <Tooltip key={tier}>
                                                <TooltipTrigger asChild>
                                                    <div
                                                        className={`${TIER_COLORS[tier]} h-6 rounded transition-all`}
                                                        style={{ width: `${Math.max(pct, 5)}%` }}
                                                    />
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    {tier}: {count} votes ({pct.toFixed(0)}%)
                                                </TooltipContent>
                                            </Tooltip>
                                        ) : null
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Criteria Breakdown (if available) */}
                        {criteria_breakdown && criteria_breakdown.length > 0 && (
                            <div className="space-y-2">
                                <h4 className="text-sm font-medium text-white/80 flex items-center gap-1.5">
                                    <Info className="w-4 h-4" />
                                    Criteria Breakdown
                                </h4>
                                <div className="space-y-2">
                                    {criteria_breakdown
                                        .sort((a, b) => b.contribution - a.contribution)
                                        .slice(0, 5)
                                        .map((criterion) => (
                                            <div key={criterion.name} className="flex items-center gap-2">
                                                <span className="text-xs text-white/60 w-24 truncate">
                                                    {criterion.name}
                                                </span>
                                                <div className="flex-1 bg-white/10 rounded-full h-2 overflow-hidden">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                                                        style={{ width: `${criterion.score * 10}%` }}
                                                    />
                                                </div>
                                                <span className="text-xs text-white/80 w-8 text-right">
                                                    {criterion.score}/10
                                                </span>
                                            </div>
                                        ))
                                    }
                                </div>
                            </div>
                        )}

                        {/* AI Reasoning */}
                        <div className="pt-2 border-t border-white/10">
                            <p className="text-sm text-white/70 italic">
                                "{reasoning}"
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>
        </TooltipProvider>
    )
}

// Compact version for item tiles
export function JustificationBadge({
    tier,
    confidence,
    onClick
}: {
    tier: string
    confidence: number
    onClick?: () => void
}) {
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <button
                        onClick={onClick}
                        className="absolute top-1 right-1 w-5 h-5 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-black/80 transition-colors"
                    >
                        <Info className="w-3 h-3 text-white/70" />
                    </button>
                </TooltipTrigger>
                <TooltipContent side="left">
                    <p className="text-xs">
                        {tier} Tier • {Math.round(confidence * 100)}% confidence
                        <br />
                        <span className="text-white/60">Click for details</span>
                    </p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}
