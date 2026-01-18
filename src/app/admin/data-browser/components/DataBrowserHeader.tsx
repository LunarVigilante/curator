'use client'

import React from 'react'
import { LayoutGrid } from 'lucide-react'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import { formatCategoryLabel } from '@/lib/constants'
import { Stats } from '../types'

interface DataBrowserHeaderProps {
    tileSize: number
    setTileSize: (val: number) => void
    stats: Stats
    activeFilters: Record<string, string>
    onRemoveFilter: (key: string) => void
    onClearFilters: () => void
}

export function DataBrowserHeader({
    tileSize,
    setTileSize,
    stats,
    activeFilters,
    onRemoveFilter,
    onClearFilters
}: DataBrowserHeaderProps) {
    const hasActiveFilters = Object.keys(activeFilters).length > 0

    return (
        <div className="mb-6">
            {/* Title & Slider Row */}
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h1 className="text-3xl font-serif font-bold text-white mb-2">Data Browser</h1>
                    <p className="text-zinc-400">Manage and curate your content database</p>
                </div>

                <div className="flex items-center gap-3">
                    <LayoutGrid className="w-4 h-4 text-zinc-400" />
                    <Slider
                        value={[tileSize]}
                        onValueChange={(v) => setTileSize(v[0])}
                        min={0}
                        max={100}
                        step={5}
                        className="w-32"
                    />
                </div>
            </div>

            {/* Stats Bar */}
            <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-4 mb-6 backdrop-blur-md">
                <div className="flex flex-wrap gap-6 items-center">
                    <div className="text-lg font-semibold">
                        Total Items: <span className="text-cyan-400">{stats.total.toLocaleString()}</span>
                    </div>
                    <div className="h-6 w-px bg-zinc-800 hidden md:block" />

                    <div className="flex flex-wrap gap-4 items-center">
                        {Object.entries(stats.byCategory)
                            .sort((a, b) => {
                                // Push 'null' (Uncategorized) to the end
                                if (a[0] === 'null') return 1
                                if (b[0] === 'null') return -1
                                // Then sort by count descending
                                return b[1] - a[1]
                            })
                            .slice(0, 12)
                            .map(([cat, count]) => {
                                const label = formatCategoryLabel(cat)
                                const isNull = cat === 'null'
                                return (
                                    <div key={cat} className="text-sm text-zinc-400 flex items-center gap-1.5">
                                        <span className={isNull ? "text-red-400 font-medium" : "text-zinc-300"}>
                                            {label}:
                                        </span>
                                        <span className="text-white font-mono">{count.toLocaleString()}</span>
                                    </div>
                                )
                            })}
                    </div>
                </div>
            </div>

            {/* Active URL Filters */}
            {hasActiveFilters && (
                <div className="bg-red-950/20 border border-red-900/30 rounded-lg p-3 mb-6 flex flex-wrap items-center gap-2">
                    <span className="text-sm text-red-300 font-medium mr-2">Active Filters:</span>
                    {Object.entries(activeFilters).map(([key, value]) => (
                        <Badge
                            key={key}
                            className="bg-red-900/50 text-red-200 border-red-800 cursor-pointer hover:bg-red-800/50 transition-colors pl-2 pr-1 py-0.5"
                            onClick={() => onRemoveFilter(key)}
                        >
                            <span className="text-red-400 mr-1 capitalize">{key.replace(/_/g, ' ')}:</span>
                            {value}
                            <X className="w-3 h-3 ml-1.5 opacity-60 hover:opacity-100" />
                        </Badge>
                    ))}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClearFilters}
                        className="text-red-400 hover:text-red-300 hover:bg-red-900/30 ml-auto h-7 px-3 text-xs"
                    >
                        Clear All
                    </Button>
                </div>
            )}
        </div>
    )
}
