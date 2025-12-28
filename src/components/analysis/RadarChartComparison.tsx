'use client'

import React, { useMemo } from 'react'
import {
    Radar,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    ResponsiveContainer,
    Tooltip,
    Legend
} from 'recharts'
import { Lock } from 'lucide-react'
import { RadarChartPayload } from '@/lib/types/taste-analytics'

interface RadarChartComparisonProps {
    data: RadarChartPayload
    isLoading?: boolean
}

export function RadarChartComparison({ data, isLoading }: RadarChartComparisonProps) {
    const chartData = useMemo(() => {
        return data.axes.map((axis, i) => ({
            subject: axis,
            A: data.userScores[i] || 0,
            B: data.cohortScores[i] || 0,
            fullMark: 100,
        }))
    }, [data])

    if (isLoading) {
        return (
            <div className="w-full h-[300px] flex items-center justify-center bg-zinc-900/50 rounded-xl animate-pulse">
                <div className="text-zinc-500">Loading comparison...</div>
            </div>
        )
    }

    if (!data.isValid) {
        return (
            <div className="w-full h-[300px] relative flex items-center justify-center bg-zinc-900/30 rounded-xl border border-dashed border-zinc-800">
                <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center text-center p-6 rounded-xl">
                    <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
                        <Lock className="w-6 h-6 text-zinc-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">Insufficient Data</h3>
                    <p className="text-zinc-400 max-w-xs">{data.emptyStateMessage}</p>
                    <div className="mt-4 w-full max-w-[200px] h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${(data.currentItemCount / data.minItemsRequired) * 100}%` }}
                        />
                    </div>
                    <p className="text-xs text-zinc-500 mt-2">
                        {data.currentItemCount} / {data.minItemsRequired} items rated
                    </p>
                </div>
                {/* Blurred mock chart behind */}
                <div className="opacity-20 blur-sm pointer-events-none">
                    <ResponsiveContainer width="100%" height={300}>
                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
                            <PolarGrid stroke="#3f3f46" />
                            <PolarAngleAxis dataKey="subject" tick={{ fill: '#71717a', fontSize: 10 }} />
                            <Radar name="You" dataKey="A" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.5} />
                            <Radar name="Global" dataKey="B" stroke="#71717a" fill="#71717a" fillOpacity={0.2} />
                        </RadarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        )
    }

    return (
        <div className="w-full h-[350px] bg-zinc-900/30 rounded-xl border border-zinc-800/50 p-4">
            <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
                    <PolarGrid stroke="#3f3f46" strokeDasharray="3 3" />
                    <PolarAngleAxis
                        dataKey="subject"
                        tick={{ fill: '#a1a1aa', fontSize: 11 }}
                    />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />

                    <Radar
                        name="You"
                        dataKey="A"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        fill="#3b82f6"
                        fillOpacity={0.3}
                        isAnimationActive={true}
                    />
                    <Radar
                        name={data.cohort.label}
                        dataKey="B"
                        stroke="#71717a"
                        strokeWidth={2}
                        strokeDasharray="4 4"
                        fill="#71717a"
                        fillOpacity={0.1}
                        isAnimationActive={false}
                    />

                    <Tooltip
                        contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px' }}
                        itemStyle={{ color: '#e4e4e7' }}
                        labelStyle={{ color: '#a1a1aa', marginBottom: '4px' }}
                    />
                    <Legend
                        verticalAlign="bottom"
                        height={36}
                        iconType="circle"
                    />
                </RadarChart>
            </ResponsiveContainer>
        </div>
    )
}
