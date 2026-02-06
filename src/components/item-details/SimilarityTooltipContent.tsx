'use client'

import React from 'react'
import ReactMarkdown from 'react-markdown'
import { Check, Clock, Star, AlertTriangle, Loader2 } from 'lucide-react'
import { getCategoryIcon } from './utils'
import type { SimilarityExplanation } from '@/lib/actions/similarity-explanations'

interface SimilarityTooltipContentProps {
    title: string
    releaseYear?: number | null
    runtime?: number | null  // in minutes
    voteAverage?: number | null
    categoryType?: string | null
    similarity: number
    sharedTraits?: string[]
    explanation?: SimilarityExplanation | null
    isLoading?: boolean
}

/**
 * Format runtime from minutes to "Xh Ym" format
 */
function formatRuntime(minutes: number | null | undefined): string | null {
    if (!minutes) return null
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours === 0) return `${mins}m`
    if (mins === 0) return `${hours}h`
    return `${hours}h ${mins}m`
}

/**
 * Glanceable Comparison Card tooltip for similar items
 * Designed for quick scanning rather than reading paragraphs
 */
export function SimilarityTooltipContent({
    title,
    releaseYear,
    runtime,
    voteAverage,
    categoryType,
    similarity,
    sharedTraits = [],
    explanation,
    isLoading = false
}: SimilarityTooltipContentProps) {
    const CategoryIcon = getCategoryIcon(categoryType ?? null)
    const formattedRuntime = formatRuntime(runtime)
    const matchPercent = Math.round(similarity * 100)

    // Helper to extract tag name from string or JSON object
    const extractTagName = (tag: unknown): string | null => {
        if (typeof tag === 'string') {
            // Check if it's a JSON string that needs parsing
            if (tag.startsWith('{') && tag.includes('"name"')) {
                try {
                    const parsed = JSON.parse(tag)
                    return parsed?.name || null
                } catch {
                    return tag
                }
            }
            return tag
        }
        if (typeof tag === 'object' && tag !== null && 'name' in tag) {
            return (tag as { name: string }).name
        }
        return null
    }

    // Build shared DNA from explanation or fallback to genres/tags
    const rawDNA = explanation?.sharedDNA?.length
        ? explanation.sharedDNA
        : sharedTraits.slice(0, 3)

    const sharedDNA = rawDNA
        .map(extractTagName)
        .filter((name): name is string => name !== null && name.length > 0)

    return (
        <div className="w-80 space-y-3">
            {/* Header: Title + Category Icon */}
            <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-white text-sm leading-tight truncate">
                        {title}
                    </h4>
                    {/* Metadata row: Year · Runtime · Rating */}
                    <div className="flex items-center gap-2 text-xs text-zinc-400 mt-0.5">
                        {releaseYear && <span>{releaseYear}</span>}
                        {formattedRuntime && (
                            <>
                                {releaseYear && <span className="text-zinc-600">·</span>}
                                <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {formattedRuntime}
                                </span>
                            </>
                        )}
                        {voteAverage && voteAverage > 0 && (
                            <>
                                {(releaseYear || formattedRuntime) && <span className="text-zinc-600">·</span>}
                                <span className="flex items-center gap-1">
                                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                    {voteAverage.toFixed(1)}
                                </span>
                            </>
                        )}
                    </div>
                </div>
                <CategoryIcon className="w-5 h-5 text-zinc-500 shrink-0" />
            </div>

            {/* Match Percentage with Visual Bar */}
            <div className="space-y-1">
                <div className="flex items-baseline justify-between">
                    <span className="text-lg font-bold text-cyan-400">{matchPercent}%</span>
                    <span className="text-xs text-zinc-500">Match</span>
                </div>
                <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full transition-all"
                        style={{ width: `${matchPercent}%` }}
                    />
                </div>
            </div>

            {/* Shared DNA Pills */}
            {sharedDNA.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {sharedDNA.slice(0, 3).map((tag, i) => (
                        <span
                            key={i}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                        >
                            <Check className="w-3 h-3" />
                            {tag}
                        </span>
                    ))}
                </div>
            )}

            {/* Loading State */}
            {isLoading && (
                <div className="flex items-center gap-2 text-xs text-zinc-500 py-1">
                    <Loader2 className="h-3 w-3 animate-spin text-cyan-500" />
                    <span>Analyzing similarity...</span>
                </div>
            )}

            {/* The "Why" Summary with markdown support */}
            {explanation?.summary && (
                <div className="text-xs text-zinc-300 leading-relaxed prose prose-invert prose-xs max-w-none prose-strong:text-cyan-300 prose-strong:font-semibold prose-p:m-0">
                    <ReactMarkdown>{explanation.summary}</ReactMarkdown>
                </div>
            )}

            {/* Key Difference Alert Box with markdown support */}
            {explanation?.keyDifference && (
                <div className="flex items-start gap-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/20">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-[11px] text-amber-200/80 leading-relaxed prose prose-invert prose-xs max-w-none prose-strong:text-amber-300 prose-strong:font-semibold prose-p:m-0">
                        <ReactMarkdown>{explanation.keyDifference}</ReactMarkdown>
                    </div>
                </div>
            )}
        </div>
    )
}
