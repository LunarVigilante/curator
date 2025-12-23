'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    calculateTierDistribution,
    calculateTopTags,
    identifyControversialItems
} from '@/lib/stats'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Tag, BarChart3, Activity } from 'lucide-react'
import Image from 'next/image'
import type { Item } from '../rating/TierListBoard'

export default function StatsDashboard({ items }: { items: Item[] }) {

    // Memoize stats to avoid recalculating on every render if not needed
    const { distribution, topTags, controversial } = useMemo(() => {
        return {
            distribution: calculateTierDistribution(items),
            topTags: calculateTopTags(items),
            controversial: identifyControversialItems(items)
        }
    }, [items])

    const totalRated = distribution.reduce((acc, curr) => acc + curr.count, 0)

    return (
        <div className="absolute inset-0 z-40 bg-black/95 backdrop-blur-xl p-8 overflow-y-auto animate-in fade-in duration-300">
            <div className="max-w-6xl mx-auto space-y-8">

                <div className="flex items-center gap-4 mb-8">
                    <Activity className="w-8 h-8 text-primary" />
                    <div>
                        <h2 className="text-3xl font-black text-white tracking-tight">Collection Insights</h2>
                        <p className="text-zinc-400">Analyzing {items.length} items</p>
                    </div>
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
                                {distribution.map((d) => (
                                    <div key={d.tier} className="flex-1 flex flex-col items-center gap-3 group relative">

                                        {/* Bar */}
                                        <div className="relative w-full flex justify-center items-end h-full">
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: `${(d.count / (totalRated || 1)) * 100}%`, opacity: 1 }}
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
                                {distribution.length === 0 && (
                                    <div className="w-full h-full flex items-center justify-center text-zinc-500 italic">
                                        No rated items yet...
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* 2. Top Tags */}
                    <Card className="bg-zinc-900/50 border-white/10 shadow-2xl">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-zinc-100">
                                <Tag className="w-5 h-5 text-purple-400" />
                                Dominant Vibes
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col gap-3">
                                {topTags.map((tag, i) => (
                                    <div
                                        key={tag.name}
                                        className="flex items-center justify-between w-full p-3 rounded-lg bg-zinc-800/40 border border-white/5 hover:bg-zinc-800/60 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className={`
                                                flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold
                                                ${i === 0 ? 'bg-yellow-500/20 text-yellow-500' :
                                                    i === 1 ? 'bg-zinc-500/20 text-zinc-400' :
                                                        i === 2 ? 'bg-orange-500/20 text-orange-500' : 'bg-zinc-800 text-zinc-500'}
                                            `}>
                                                #{i + 1}
                                            </span>
                                            <span className="font-semibold text-zinc-200">{tag.name}</span>
                                        </div>
                                        <span className="text-xs text-zinc-500 font-mono bg-black/20 px-2 py-1 rounded">
                                            {tag.count}
                                        </span>
                                    </div>
                                ))}
                                {topTags.length === 0 && (
                                    <div className="py-8 text-center text-zinc-500 text-sm italic">
                                        No tags found. Add tags to items to see trends!
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* 3. Controversial Picks */}
                    <Card className="col-span-1 md:col-span-3 bg-zinc-900/50 border-white/10 shadow-2xl">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-zinc-100">
                                <Activity className="w-5 h-5 text-yellow-400" />
                                Controversial Picks
                                <span className="text-sm font-normal text-zinc-500 ml-2">(Tier Rank vs Tournament Elo)</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
                                {controversial.map((item) => (
                                    <div key={item.id} className="flex flex-col rounded-lg bg-zinc-950 border border-white/5 overflow-hidden relative group hover:border-white/20 transition-all shadow-lg">
                                        {/* Image Header */}
                                        <div className="relative w-full aspect-video sm:aspect-[4/3] bg-zinc-900 overflow-hidden">
                                            {item.image ? (
                                                <Image src={item.image} alt={item.name} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
                                            ) : (
                                                <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-zinc-600">No Image</div>
                                            )}

                                            {/* Badge */}
                                            <div className="absolute top-2 right-2 flex flex-col items-end">
                                                {item.diff > 0 ? (
                                                    <span className="bg-green-500/90 text-black text-[10px] font-black px-2 py-0.5 rounded shadow-sm uppercase tracking-wide flex items-center gap-1">
                                                        <TrendingUp className="w-3 h-3" /> Underrated
                                                    </span>
                                                ) : (
                                                    <span className="bg-red-500/90 text-white text-[10px] font-black px-2 py-0.5 rounded shadow-sm uppercase tracking-wide flex items-center gap-1">
                                                        <TrendingDown className="w-3 h-3" /> Overrated
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Content */}
                                        <div className="p-4 flex flex-col gap-2 relative">
                                            {/* Edge indicator */}
                                            <div className={`absolute top-0 left-0 right-0 h-0.5 ${item.diff > 0 ? 'bg-green-500' : 'bg-red-500'}`} />

                                            <h4 className="font-bold text-sm text-zinc-100 truncate" title={item.name}>{item.name}</h4>

                                            <div className="flex items-center justify-between text-xs mt-1">
                                                <div className="flex flex-col">
                                                    <span className="text-zinc-500 text-[10px] uppercase tracking-wider">You Ranked</span>
                                                    <span className="font-black text-white text-lg leading-none">{item.tier}</span>
                                                </div>
                                                <div className="h-6 w-px bg-white/10" />
                                                <div className="flex flex-col items-end">
                                                    <span className="text-zinc-500 text-[10px] uppercase tracking-wider">Elo Score</span>
                                                    <span className={`font-mono font-bold text-lg leading-none ${item.diff > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                        {Math.round(item.elo)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {controversial.length === 0 && (
                                    <div className="col-span-full py-12 text-center flex flex-col items-center gap-2 text-zinc-500">
                                        <Activity className="w-12 h-12 opacity-20" />
                                        <p>No significant anomalies found.</p>
                                        <p className="text-sm">Your manual rankings perfectly match the tournament results! (Or not enough data yet)</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                </div>
            </div>
        </div>
    )
}
