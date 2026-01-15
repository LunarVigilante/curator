'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sparkles, X, Loader2, Layers, ArrowRight } from 'lucide-react'
import type { CanvasItem } from './InfiniteCanvas'

interface ClusterSuggestion {
    name: string
    description: string
    itemIds: string[]
    confidence: number
}

interface AISidekickProps {
    items: CanvasItem[]
    selectedItemIds: string[]
    onClose: () => void
    onApplyClusters: (clusters: ClusterSuggestion[]) => void
}

export function AISidekick({
    items,
    selectedItemIds,
    onClose,
    onApplyClusters
}: AISidekickProps) {
    const [isAnalyzing, setIsAnalyzing] = useState(false)
    const [suggestions, setSuggestions] = useState<ClusterSuggestion[]>([])
    const [error, setError] = useState<string | null>(null)

    const handleAnalyze = async () => {
        setIsAnalyzing(true)
        setError(null)

        try {
            // In production, this would call an API endpoint that uses
            // the findSimilarItems RPC and agent orchestrator
            // For now, simulate with mock data
            await new Promise(resolve => setTimeout(resolve, 1500))

            // Mock suggestions based on items
            const mockSuggestions: ClusterSuggestion[] = [
                {
                    name: "High-Rated Classics",
                    description: "Items with S or A tier ratings that share similar themes",
                    itemIds: items.filter(i => i.tier === 'S' || i.tier === 'A').slice(0, 5).map(i => i.id),
                    confidence: 0.89
                },
                {
                    name: "Similar Genre",
                    description: "Items clustered by vector similarity",
                    itemIds: items.slice(0, 4).map(i => i.id),
                    confidence: 0.76
                },
                {
                    name: "Recent Additions",
                    description: "Newly added items that might relate",
                    itemIds: items.slice(-3).map(i => i.id),
                    confidence: 0.65
                }
            ].filter(s => s.itemIds.length > 1)

            setSuggestions(mockSuggestions)
        } catch (e) {
            setError('Failed to analyze items. Try again.')
        } finally {
            setIsAnalyzing(false)
        }
    }

    return (
        <motion.div
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 300 }}
            transition={{ type: 'spring', damping: 25 }}
            className="absolute right-4 top-4 bottom-4 w-80 z-50"
        >
            <Card className="h-full bg-black/90 backdrop-blur-xl border-white/10 flex flex-col">
                <CardHeader className="pb-3 flex-shrink-0">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-white flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-purple-400" />
                            AI Sidekick
                        </CardTitle>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onClose}
                            className="text-white/60 hover:text-white hover:bg-white/10"
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                    <p className="text-sm text-white/60 mt-1">
                        Auto-group items based on vector similarity
                    </p>
                </CardHeader>

                <CardContent className="flex-1 flex flex-col min-h-0">
                    {/* Context info */}
                    <div className="bg-white/5 rounded-lg p-3 mb-4">
                        <div className="text-xs text-white/50 mb-1">Analyzing</div>
                        <div className="text-sm text-white">
                            {selectedItemIds.length > 0
                                ? `${selectedItemIds.length} selected items`
                                : `${items.length} items on canvas`
                            }
                        </div>
                    </div>

                    {/* Analyze button */}
                    {suggestions.length === 0 && !isAnalyzing && (
                        <Button
                            onClick={handleAnalyze}
                            disabled={isAnalyzing}
                            className="w-full bg-purple-600 hover:bg-purple-700 text-white mb-4"
                        >
                            {isAnalyzing ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Analyzing...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-4 h-4 mr-2" />
                                    Find Clusters
                                </>
                            )}
                        </Button>
                    )}

                    {/* Loading state */}
                    {isAnalyzing && (
                        <div className="flex-1 flex flex-col items-center justify-center text-white/60">
                            <Loader2 className="w-8 h-8 animate-spin mb-3 text-purple-400" />
                            <p className="text-sm">Analyzing embeddings...</p>
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="bg-red-500/20 text-red-300 rounded-lg p-3 mb-4 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Suggestions */}
                    {suggestions.length > 0 && (
                        <ScrollArea className="flex-1">
                            <div className="space-y-3 pr-4">
                                {suggestions.map((suggestion, idx) => (
                                    <motion.div
                                        key={idx}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.1 }}
                                    >
                                        <Card className="bg-white/5 border-white/10 hover:border-purple-500/50 transition-colors cursor-pointer">
                                            <CardContent className="p-3">
                                                <div className="flex items-start justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <Layers className="w-4 h-4 text-purple-400" />
                                                        <span className="text-sm font-medium text-white">
                                                            {suggestion.name}
                                                        </span>
                                                    </div>
                                                    <Badge
                                                        variant="secondary"
                                                        className="bg-purple-500/20 text-purple-300 text-xs"
                                                    >
                                                        {Math.round(suggestion.confidence * 100)}%
                                                    </Badge>
                                                </div>
                                                <p className="text-xs text-white/50 mb-2">
                                                    {suggestion.description}
                                                </p>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs text-white/40">
                                                        {suggestion.itemIds.length} items
                                                    </span>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/20 h-7 px-2"
                                                        onClick={() => onApplyClusters([suggestion])}
                                                    >
                                                        Apply
                                                        <ArrowRight className="w-3 h-3 ml-1" />
                                                    </Button>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </motion.div>
                                ))}

                                {/* Apply all button */}
                                <Button
                                    onClick={() => onApplyClusters(suggestions)}
                                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white mt-2"
                                >
                                    Apply All Clusters
                                </Button>
                            </div>
                        </ScrollArea>
                    )}
                </CardContent>
            </Card>
        </motion.div>
    )
}
