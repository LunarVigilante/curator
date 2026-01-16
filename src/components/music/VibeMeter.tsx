'use client'

import { useMemo } from 'react'
import { Progress } from '@/components/ui/progress'

interface AudioFeatures {
    danceability?: number
    energy?: number
    valence?: number
    acousticness?: number
    tempo?: number
}

interface VibeMeterProps {
    // Can accept array of track features or single album average
    features: AudioFeatures | AudioFeatures[] | null
}

// Labels for meter display
const VIBE_METRICS: { key: string; icon: string; label: string; color: string; subtext?: string }[] = [
    { key: 'danceability', icon: '💃', label: 'Danceability', color: 'bg-purple-500' },
    { key: 'energy', icon: '⚡', label: 'Energy', color: 'bg-orange-500' },
    { key: 'valence', icon: '🌞', label: 'Mood', subtext: 'Sad → Happy', color: 'bg-yellow-500' },
    { key: 'acousticness', icon: '🎸', label: 'Acousticness', color: 'bg-green-500' },
]

type MetricKey = 'danceability' | 'energy' | 'valence' | 'acousticness'

// Aggregate multiple features into averages
function aggregateFeatures(features: AudioFeatures[]): AudioFeatures {
    if (features.length === 0) return {}

    const sums: Record<string, { total: number; count: number }> = {}

    for (const f of features) {
        for (const key of ['danceability', 'energy', 'valence', 'acousticness'] as const) {
            if (f[key] != null) {
                if (!sums[key]) sums[key] = { total: 0, count: 0 }
                sums[key].total += f[key]!
                sums[key].count++
            }
        }
    }

    const result: AudioFeatures = {}
    for (const [key, val] of Object.entries(sums)) {
        if (val.count > 0) {
            (result as any)[key] = val.total / val.count
        }
    }

    return result
}

export default function VibeMeter({ features }: VibeMeterProps) {
    // Compute the averaged features
    const avgFeatures = useMemo(() => {
        if (!features) return null
        if (Array.isArray(features)) {
            const validFeatures = features.filter(Boolean)
            return validFeatures.length > 0 ? aggregateFeatures(validFeatures) : null
        }
        return features
    }, [features])

    // Check if we have any data
    const hasData = avgFeatures && Object.keys(avgFeatures).length > 0

    if (!hasData) {
        return (
            <div className="text-zinc-500 text-xs text-center py-4">
                No audio analysis available
            </div>
        )
    }

    return (
        <div className="space-y-3">
            <h4 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                Album Vibe
            </h4>

            <div className="space-y-3">
                {VIBE_METRICS.map((metric) => {
                    const value = avgFeatures[metric.key as MetricKey]
                    if (value == null) return null

                    // Convert 0-1 to 0-100
                    const percentage = Math.round(value * 100)

                    return (
                        <div key={metric.key} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                                <span className="flex items-center gap-1.5 text-zinc-300">
                                    <span>{metric.icon}</span>
                                    <span>{metric.label}</span>
                                </span>
                                <span className="text-zinc-500 tabular-nums">
                                    {percentage}%
                                </span>
                            </div>

                            <div className="relative h-2 bg-zinc-800 rounded-full overflow-hidden">
                                <div
                                    className={`h-full ${metric.color} transition-all duration-500 rounded-full`}
                                    style={{ width: `${percentage}%` }}
                                />
                            </div>

                            {metric.subtext && (
                                <p className="text-[10px] text-zinc-600 text-center">
                                    {metric.subtext}
                                </p>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
