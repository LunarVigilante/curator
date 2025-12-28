'use client'

import React, { useEffect, useState } from 'react'
import {
    getAlignmentScore,
    getRadarChartData,
    getUnlockStatus
} from '@/lib/actions/benchmarks'
import {
    AlignmentResult,
    RadarChartPayload,
    UnlockStatus
} from '@/lib/types/taste-analytics'
import { RadarChartComparison } from './RadarChartComparison'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Lock, Users, Activity, Crown, Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface BenchmarksContentProps {
    categoryId?: string
}

export function BenchmarksContent({ categoryId }: BenchmarksContentProps) {
    const [radarData, setRadarData] = useState<RadarChartPayload | null>(null)
    const [globalAlignment, setGlobalAlignment] = useState<AlignmentResult | null>(null)
    const [expertAlignment, setExpertAlignment] = useState<AlignmentResult | null>(null)
    const [radarUnlocked, setRadarUnlocked] = useState<UnlockStatus | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let mounted = true

        async function fetchData() {
            setLoading(true)
            try {
                // Check unlocks first
                const radarLock = await getUnlockStatus('radar_comparison')

                // Fetch data in parallel
                const [radar, global, experts] = await Promise.all([
                    getRadarChartData(categoryId, 'global'),
                    getAlignmentScore('global', categoryId),
                    getAlignmentScore('experts', categoryId)
                ])

                if (mounted) {
                    setRadarUnlocked(radarLock)
                    setRadarData(radar)
                    setGlobalAlignment(global)
                    setExpertAlignment(experts)
                }
            } catch (err) {
                console.error("Failed to fetch benchmark data", err)
            } finally {
                if (mounted) setLoading(false)
            }
        }

        fetchData()

        return () => { mounted = false }
    }, [categoryId])

    return (
        <div className="p-8 focus-visible:outline-none animate-in fade-in slide-in-from-bottom-2 duration-300 max-w-7xl mx-auto space-y-8">

            {/* 1. Radar Chart Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center gap-3 mb-2">
                        <Activity className="w-5 h-5 text-blue-400" />
                        <h3 className="font-serif text-xl text-blue-100 italic">Taste Profile vs. Global Average</h3>
                    </div>

                    <div className="relative">
                        {/* Gating Overlay for Radar */}
                        {(!radarUnlocked?.unlocked) && (
                            <div className="absolute inset-0 z-20 backdrop-blur-md bg-zinc-950/60 flex flex-col items-center justify-center rounded-xl border border-white/5">
                                <div className="p-6 text-center space-y-4 max-w-md">
                                    <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mx-auto ring-1 ring-white/10">
                                        <Lock className="w-8 h-8 text-zinc-500" />
                                    </div>
                                    <h3 className="text-xl font-semibold text-white">Unlock Radar Comparison</h3>
                                    <p className="text-zinc-400">
                                        {radarUnlocked?.displayLabel || "Rate more items to generate your unique taste shape."}
                                    </p>
                                    {radarUnlocked && typeof radarUnlocked.progress === 'number' && typeof radarUnlocked.required === 'number' && (
                                        <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden mt-2">
                                            <div
                                                className="h-full bg-blue-500 rounded-full transition-all duration-1000"
                                                style={{ width: `${Math.min(100, (radarUnlocked.progress / radarUnlocked.required) * 100)}%` }}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <Card className="bg-white/5 border-white/10 overflow-hidden">
                            <CardContent className="p-6">
                                {radarData && (
                                    <RadarChartComparison data={radarData} isLoading={loading} />
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* 2. Alignment Scores Column */}
                <div className="space-y-6">
                    <div className="flex items-center gap-3 mb-2">
                        <Users className="w-5 h-5 text-emerald-400" />
                        <h3 className="font-serif text-xl text-emerald-100 italic">Cohorts</h3>
                    </div>

                    <div className="grid gap-4">
                        {/* Global Alignment Card */}
                        <Card className="bg-white/5 border-white/10">
                            <CardContent className="p-5 space-y-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h4 className="font-medium text-zinc-300 flex items-center gap-2">
                                            Global Average
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger>
                                                        <Info className="w-3.5 h-3.5 text-zinc-600" />
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        How much your ratings agree with the general public.
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </h4>
                                        <p className="text-xs text-zinc-500 mt-1">Based on {globalAlignment?.sampleSize.toLocaleString() ?? 0} ratings</p>
                                    </div>
                                    <Badge variant="outline" className="bg-zinc-900/50 border-zinc-700 text-zinc-400">
                                        Beta
                                    </Badge>
                                </div>

                                {loading ? (
                                    <div className="h-2 w-full bg-zinc-800 rounded-full animate-pulse" />
                                ) : globalAlignment?.score !== null ? (
                                    <div>
                                        <div className="flex items-end justify-between mb-2">
                                            <span className="text-3xl font-bold text-white">{globalAlignment?.score}%</span>
                                            <span className="text-sm text-zinc-400 mb-1">Match</span>
                                        </div>
                                        <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-emerald-500 rounded-full"
                                                style={{ width: `${globalAlignment?.score}%` }}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-3 bg-zinc-900/50 rounded-lg text-sm text-zinc-500 text-center">
                                        {globalAlignment?.message || "Not enough data"}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Expert Alignment Card */}
                        <Card className="bg-gradient-to-br from-amber-900/10 to-transparent border-amber-500/10">
                            <CardContent className="p-5 space-y-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h4 className="font-medium text-amber-200/90 flex items-center gap-2">
                                            <Crown className="w-4 h-4 text-amber-500" /> Expert Critics
                                        </h4>
                                        <p className="text-xs text-amber-500/50 mt-1">Users with 50+ ratings</p>
                                    </div>
                                </div>

                                {loading ? (
                                    <div className="h-2 w-full bg-zinc-800 rounded-full animate-pulse" />
                                ) : expertAlignment?.score !== null ? (
                                    <div>
                                        <div className="flex items-end justify-between mb-2">
                                            <span className="text-3xl font-bold text-amber-400">{expertAlignment?.score}%</span>
                                            <span className="text-sm text-amber-500/60 mb-1">Match</span>
                                        </div>
                                        <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-amber-500 rounded-full"
                                                style={{ width: `${expertAlignment?.score}%` }}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-3 bg-zinc-900/50 rounded-lg text-sm text-zinc-500 text-center">
                                        {expertAlignment?.message || "Not enough data"}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    )
}
