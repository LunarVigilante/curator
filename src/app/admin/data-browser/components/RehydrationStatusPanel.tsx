'use client'

import { useState, useEffect } from 'react'
import {
    RefreshCw,
    ChevronDown,
    ChevronUp,
    AlertCircle,
    Clock,
    Tv,
    Zap
} from 'lucide-react'
import { toast } from 'sonner'
import { getRehydrationStats, triggerRehydration, type RehydrationStats } from '@/lib/actions/rehydration'

/**
 * Rehydration Status Panel
 * 
 * Collapsible panel showing TV show staleness stats and rehydration controls.
 * Displays:
 * - Total TV shows and stale counts by priority tier
 * - Last rehydration timestamp
 * - Run rehydration button with tier selector
 */
export default function RehydrationStatusPanel() {
    const [expanded, setExpanded] = useState(false)
    const [stats, setStats] = useState<RehydrationStats | null>(null)
    const [loading, setLoading] = useState(false)
    const [running, setRunning] = useState(false)

    // Fetch stats on mount and when expanded
    useEffect(() => {
        if (expanded && !stats) {
            fetchStats()
        }
    }, [expanded, stats])

    const fetchStats = async () => {
        setLoading(true)
        try {
            const data = await getRehydrationStats()
            setStats(data)
        } catch (error) {
            console.error('Failed to fetch rehydration stats:', error)
            toast.error('Failed to load rehydration stats')
        } finally {
            setLoading(false)
        }
    }

    const handleTriggerRehydration = async (priority: 'weekly' | 'monthly' | 'quarterly' | 'all') => {
        setRunning(true)
        try {
            const result = await triggerRehydration(priority)
            if (result.success) {
                toast.success(
                    `Rehydration queued for ${result.count} items. Run CLI to process.`,
                    {
                        description: `npx tsx src/scripts/backfill/index.ts --category=TV_SHOW --phase=rehydrate`,
                        duration: 10000
                    }
                )
                // Refresh stats
                fetchStats()
            } else {
                toast.error(`Rehydration failed: ${result.error}`)
            }
        } catch (error) {
            console.error('Rehydration trigger failed:', error)
            toast.error('Failed to trigger rehydration')
        } finally {
            setRunning(false)
        }
    }

    const totalStale = stats
        ? stats.staleWeekly + stats.staleMonthly + stats.staleQuarterly
        : 0

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return 'Never'
        const date = new Date(dateStr)
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

        if (diffDays === 0) return 'Today'
        if (diffDays === 1) return 'Yesterday'
        if (diffDays < 7) return `${diffDays} days ago`
        return date.toLocaleDateString()
    }

    return (
        <div className="mb-4 bg-slate-800/50 border border-slate-700/50 rounded-lg overflow-hidden">
            {/* Collapsed Header - Always Visible */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-700/30 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-cyan-500/20 rounded">
                        <Tv className="w-4 h-4 text-cyan-400" />
                    </div>
                    <span className="text-sm font-medium text-slate-200">
                        TV Show Rehydration
                    </span>
                    {totalStale > 0 && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-amber-500/20 text-amber-300 rounded-full">
                            {totalStale} stale
                        </span>
                    )}
                    {stats?.neverRehydrated ? (
                        <span className="px-2 py-0.5 text-xs font-medium bg-red-500/20 text-red-300 rounded-full">
                            {stats.neverRehydrated} never processed
                        </span>
                    ) : null}
                </div>
                <div className="flex items-center gap-2">
                    {stats && (
                        <span className="text-xs text-slate-400">
                            Last run: {formatDate(stats.lastRehydrationRun)}
                        </span>
                    )}
                    {expanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                </div>
            </button>

            {/* Expanded Content */}
            {expanded && (
                <div className="px-4 pb-4 border-t border-slate-700/50">
                    {loading ? (
                        <div className="py-4 flex items-center justify-center gap-2 text-slate-400">
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span className="text-sm">Loading stats...</span>
                        </div>
                    ) : stats ? (
                        <div className="pt-4 space-y-4">
                            {/* Stats Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <StatCard
                                    label="Total TV Shows"
                                    value={stats.totalTvShows}
                                    icon={<Tv className="w-4 h-4" />}
                                    color="cyan"
                                />
                                <StatCard
                                    label="Stale (Weekly)"
                                    value={stats.staleWeekly}
                                    sublabel="Returning Series"
                                    icon={<Clock className="w-4 h-4" />}
                                    color={stats.staleWeekly > 0 ? 'amber' : 'green'}
                                />
                                <StatCard
                                    label="Stale (Monthly)"
                                    value={stats.staleMonthly}
                                    sublabel="In Production"
                                    icon={<Clock className="w-4 h-4" />}
                                    color={stats.staleMonthly > 0 ? 'amber' : 'green'}
                                />
                                <StatCard
                                    label="Stale (Quarterly)"
                                    value={stats.staleQuarterly}
                                    sublabel="Ended Shows"
                                    icon={<Clock className="w-4 h-4" />}
                                    color={stats.staleQuarterly > 0 ? 'amber' : 'green'}
                                />
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-wrap items-center gap-2 pt-2">
                                <button
                                    onClick={() => handleTriggerRehydration('weekly')}
                                    disabled={running || stats.staleWeekly === 0}
                                    className="px-3 py-1.5 text-xs font-medium bg-cyan-500/20 text-cyan-300 rounded hover:bg-cyan-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                                >
                                    <Zap className="w-3.5 h-3.5" />
                                    Rehydrate Weekly ({stats.staleWeekly})
                                </button>
                                <button
                                    onClick={() => handleTriggerRehydration('monthly')}
                                    disabled={running || stats.staleMonthly === 0}
                                    className="px-3 py-1.5 text-xs font-medium bg-slate-600/50 text-slate-300 rounded hover:bg-slate-600/70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                                >
                                    <Zap className="w-3.5 h-3.5" />
                                    Rehydrate Monthly ({stats.staleMonthly})
                                </button>
                                <button
                                    onClick={() => handleTriggerRehydration('all')}
                                    disabled={running || totalStale === 0}
                                    className="px-3 py-1.5 text-xs font-medium bg-amber-500/20 text-amber-300 rounded hover:bg-amber-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                                >
                                    <RefreshCw className="w-3.5 h-3.5" />
                                    Rehydrate All Stale ({totalStale})
                                </button>
                                <button
                                    onClick={fetchStats}
                                    disabled={loading}
                                    className="px-3 py-1.5 text-xs font-medium bg-slate-700/50 text-slate-400 rounded hover:bg-slate-700/70 transition-colors disabled:opacity-50 ml-auto"
                                >
                                    Refresh Stats
                                </button>
                            </div>

                            {/* Help Text */}
                            <div className="flex items-start gap-2 p-3 bg-slate-700/30 rounded text-xs text-slate-400">
                                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-medium text-slate-300 mb-1">How Rehydration Works</p>
                                    <p>
                                        Rehydration refreshes TV show metadata (seasons, episodes, ratings) from TMDB
                                        and rebuilds embeddings using cached descriptions. No LLM calls = ~98% cheaper than full regeneration.
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="py-4 text-center text-slate-400 text-sm">
                            Failed to load stats
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// Helper component for stat cards
function StatCard({
    label,
    value,
    sublabel,
    icon,
    color
}: {
    label: string
    value: number
    sublabel?: string
    icon: React.ReactNode
    color: 'cyan' | 'amber' | 'green' | 'red'
}) {
    const colorClasses = {
        cyan: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400',
        amber: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
        green: 'bg-green-500/10 border-green-500/30 text-green-400',
        red: 'bg-red-500/10 border-red-500/30 text-red-400'
    }

    return (
        <div className={`p-3 rounded border ${colorClasses[color]}`}>
            <div className="flex items-center gap-2 mb-1">
                {icon}
                <span className="text-xs font-medium opacity-80">{label}</span>
            </div>
            <div className="text-2xl font-bold">{value.toLocaleString()}</div>
            {sublabel && (
                <div className="text-xs opacity-60 mt-0.5">{sublabel}</div>
            )}
        </div>
    )
}
