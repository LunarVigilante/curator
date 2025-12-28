'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import { TrendingUp, Tag, BarChart3, Activity, X, Sparkles, Loader2 } from 'lucide-react'
import Image from 'next/image'
import { TasteReportModal } from '../analysis/TasteReportModal'
import { TasteAnalysis } from '@/lib/types/analysis'
import { toast } from 'sonner'
import { getStatsAnalytics } from '@/lib/actions/stats'
import type { StatsData, TierCount } from '@/lib/types/stats'
import { calculatePercentages } from '@/lib/utils/stats-utils'

// Props interface - accepts either raw items OR pre-calculated stats
interface StatsDashboardProps {
    // Pre-calculated stats from server (preferred)
    serverStats?: StatsData
    // Category ID for filtered stats
    categoryId?: string
    // Optional item count for display
    itemCount?: number
    // Close handler
    onClose?: () => void
}

export default function StatsDashboard({ serverStats, categoryId, itemCount, onClose }: StatsDashboardProps) {
    const [stats, setStats] = useState<StatsData | null>(serverStats || null)
    const [loading, setLoading] = useState(!serverStats)
    const [showTasteReport, setShowTasteReport] = useState(false)
    const [tasteData, setTasteData] = useState<TasteAnalysis | null>(null)

    // Fetch stats from server if not provided
    useEffect(() => {
        if (!serverStats && !stats) {
            setLoading(true)
            getStatsAnalytics(categoryId)
                .then(data => {
                    setStats(data)
                })
                .catch(err => {
                    console.error('Failed to load stats:', err)
                    toast.error('Failed to load statistics')
                })
                .finally(() => setLoading(false))
        }
    }, [serverStats, categoryId, stats])

    // Calculate percentages for display
    const tierDataWithPercentages = stats
        ? calculatePercentages(stats.tierDistribution, stats.totalRated)
        : []

    // Map tags to [name, count] tuples for backward compatibility
    const topTagsTuples: [string, number][] = stats
        ? stats.topTags.map(t => [t.tagName, t.count])
        : []

    const handleAnalyze = async () => {
        setShowTasteReport(true)
        try {
            const res = await fetch('/api/ai/analyze-taste', {
                method: 'POST',
                body: JSON.stringify({ categoryId })
            })
            if (!res.ok) throw new Error("Analysis failed")
            const data = await res.json()
            setTasteData(data)
        } catch (error) {
            console.error(error)
            toast.error("Failed to generate taste report")
            setShowTasteReport(false)
        }
    }

    if (loading) {
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-40 bg-black/80 backdrop-blur-xl p-8 flex items-center justify-center"
            >
                <Loader2 className="w-8 h-8 animate-spin text-white" />
            </motion.div>
        )
    }

    if (!stats) {
        return null
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 z-40 bg-black/80 backdrop-blur-xl p-8 overflow-y-auto"
        >
            {/* Close Button */}
            {onClose && (
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="absolute top-6 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-50"
                >
                    <X className="h-5 w-5" />
                </Button>
            )}

            <div className="max-w-6xl mx-auto space-y-8">

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-4">
                        <Activity className="w-8 h-8 text-primary" />
                        <div>
                            <h2 className="text-3xl font-black text-white tracking-tight">Collection Insights</h2>
                            <p className="text-zinc-400">Analyzing {itemCount ?? stats.totalRated} items</p>
                        </div>
                    </div>

                    <Button
                        onClick={handleAnalyze}
                        className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white shadow-lg border border-white/20"
                        size="lg"
                    >
                        <Sparkles className="w-4 h-4 mr-2" />
                        Analyze My Taste
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                    {/* 1. Tier Distribution Chart */}
                    <Card className="col-span-1 md:col-span-2 bg-zinc-900/50 border-white/10 shadow-2xl">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-zinc-100">
                                <BarChart3 className="w-5 h-5 text-blue-400" />
                                Tier Distribution
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-end justify-between h-[200px] gap-2 pt-4 px-4 pb-2">
                                {tierDataWithPercentages.map((d) => (
                                    <div key={d.tier} className="flex-1 flex flex-col items-center gap-3 group relative">

                                        {/* Bar */}
                                        <div className="relative w-full flex justify-center items-end h-full">
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: `${(d.count / (stats.totalRated || 1)) * 100}%`, opacity: 1 }}
                                                transition={{ duration: 0.5, ease: "easeOut" }}
                                                className="w-full max-w-[50px] rounded-t-lg shadow-[0_0_15px_rgba(0,0,0,0.5)] border-t border-white/10"
                                                style={{
                                                    backgroundColor: d.color,
                                                    minHeight: '4px',
                                                }}
                                            />
                                            {/* Floating Label */}
                                            <span className="absolute -top-8 text-xs font-bold text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-800 px-2 py-1 rounded border border-white/10">
                                                {d.count} ({d.percentage}%)
                                            </span>
                                        </div>

                                        {/* Axis Label */}
                                        <span className="font-black text-zinc-400 text-lg">{d.tier}</span>
                                    </div>
                                ))}
                                {tierDataWithPercentages.length === 0 && (
                                    <div className="w-full h-full flex items-center justify-center text-zinc-500 italic">
                                        No rated items yet...
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* 2. Top Tags */}
                    <Card className="col-span-1 bg-zinc-900/50 border-white/10 shadow-lg">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-zinc-100">
                                <Tag className="w-5 h-5 text-purple-400" />
                                Top Tags
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {topTagsTuples.slice(0, 5).map((t, i) => (
                                    <div key={t[0]} className="flex items-center justify-between group">
                                        <div className="flex items-center gap-3">
                                            <span className="text-zinc-500 font-mono text-xs">0{i + 1}</span>
                                            <span className="font-medium text-zinc-300 group-hover:text-purple-300 transition-colors">{t[0]}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="h-1.5 w-16 bg-zinc-800 rounded-full overflow-hidden">
                                                <div className="h-full bg-purple-500/50" style={{ width: `${(t[1] / (topTagsTuples[0]?.[1] || 1)) * 100}%` }} />
                                            </div>
                                            <span className="text-xs text-zinc-500">{t[1]}</span>
                                        </div>
                                    </div>
                                ))}
                                {topTagsTuples.length === 0 && <p className="text-zinc-500 text-sm">No tags found.</p>}
                            </div>
                        </CardContent>
                    </Card>

                    {/* 3. Hall of Fame */}
                    <Card className="col-span-1 md:col-span-3 bg-zinc-900/50 border-white/10 shadow-lg">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-zinc-100">
                                <TrendingUp className="w-5 h-5 text-red-400" />
                                Hall of Fame (Highest Rated)
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                {stats.topRated.map(item => (
                                    <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg bg-zinc-950/50 border border-white/5">
                                        {item.image ? (
                                            <Image src={item.image} alt={item.name} width={40} height={40} className="rounded object-cover" sizes="40px" />
                                        ) : (
                                            <div className="w-10 h-10 bg-zinc-800 rounded flex-shrink-0" />
                                        )}
                                        <div className="min-w-0">
                                            <div className="font-bold text-sm truncate text-white">{item.name}</div>
                                            <div className="text-xs text-yellow-500 font-mono">
                                                {item.tier}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {stats.topRated.length === 0 && <p className="text-zinc-500 text-sm italic">Rank items to see them here.</p>}
                            </div>
                        </CardContent>
                    </Card>

                </div>
            </div>

            <TasteReportModal
                isOpen={showTasteReport}
                onOpenChange={setShowTasteReport}
                data={tasteData}
            />
        </motion.div>
    )
}
