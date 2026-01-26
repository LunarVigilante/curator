'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Radar } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getRadarChartData } from '@/lib/actions/benchmarks'
import { RadarChartPayload } from '@/lib/types/taste-analytics'
import { RadarChartComparison } from '@/components/analysis/RadarChartComparison'

interface TasteProfileChartWidgetProps {
    className?: string
}

export default function TasteProfileChartWidget({ className }: TasteProfileChartWidgetProps) {
    const [data, setData] = useState<RadarChartPayload | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function loadData() {
            try {
                const chartData = await getRadarChartData(undefined, 'global')
                setData(chartData)
            } catch (error) {
                console.error('Failed to load taste profile:', error)
            } finally {
                setLoading(false)
            }
        }
        loadData()
    }, [])

    return (
        <Card className={cn(
            "bg-zinc-900/50 backdrop-blur-md border-white/10 h-full overflow-hidden",
            className
        )}>
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Radar className="h-5 w-5 text-emerald-400" />
                    Your Taste Profile
                </CardTitle>
            </CardHeader>
            <CardContent className="h-[300px] flex items-center justify-center p-0">
                <div className="w-full h-full relative">
                    <RadarChartComparison data={data!} isLoading={loading} />
                </div>
            </CardContent>
        </Card>
    )
}
