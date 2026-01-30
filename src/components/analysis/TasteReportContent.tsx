'use client'

import React, { useState, useTransition } from "react"
import { createItemInternal } from "@/lib/actions/items"
import { TasteAnalysis } from "@/lib/types/analysis"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ThumbsUp, AlertTriangle, Palette, BookOpen, Compass, Sparkles } from "lucide-react"
import ReactMarkdown from "react-markdown"
import { Button } from "@/components/ui/button"
import { BenchmarksContent } from "./BenchmarksContent"
import { RecommendationCard } from "./RecommendationCard"
import { ProfileHighlightCard } from "./ProfileHighlightCard"

export interface TasteReportContentProps {
    data: TasteAnalysis
    categoryId?: string
    canEdit?: boolean
}

export function TasteReportContent({ data, categoryId, canEdit }: TasteReportContentProps) {
    const [, startTransition] = useTransition()
    const [addingItemName, setAddingItemName] = useState<string | null>(null)
    const [addedItems, setAddedItems] = useState<Set<string>>(new Set())

    const handleAddItem = (rec: { name: string, reason: string, medium?: string }) => {
        setAddingItemName(rec.name)
        startTransition(async () => {
            try {
                // 1. Search provider for this recommendation
                const { searchMediaAction } = await import('@/lib/actions/media')
                const searchQuery = rec.name
                const response = await searchMediaAction(searchQuery, rec.medium || 'anime', rec.medium || null, categoryId || '')

                let image = ''
                let metadata = ''
                let description = rec.reason
                let tagIds: string[] = []

                if (response.success && response.data.length > 0) {
                    const match = response.data[0]
                    image = match.imageUrl || ''
                    metadata = JSON.stringify({
                        externalId: match.id,
                        year: match.year,
                        type: match.type
                    })

                    // 2. Download image locally in background
                    if (image && image.startsWith('http')) {
                        const { downloadImageFromUrl } = await import('@/lib/actions/upload')
                        const localUrl = await downloadImageFromUrl(image).catch(() => null)
                        if (localUrl) image = localUrl
                    }

                    // 3. Use provider tags (fast) or fall back to AI (slow)
                    const { generateDescriptionAction, generateTagsAction } = await import('@/lib/actions/ai')
                    const aiType = rec.medium || 'anime'
                    const providerDescription = match.description || ''

                    // Start description generation
                    const descPromise = generateDescriptionAction({ title: match.title, type: aiType, context: providerDescription })
                        .catch(() => ({ description: rec.reason }))

                    // Use provider tags if available (fast path), otherwise AI (slow path)
                    if (match.tags && match.tags.length > 0) {
                        // Fast path: use provider tags directly with batch create
                        const { createTagsBatch } = await import('@/lib/actions/tags')
                        const validTags = await createTagsBatch(match.tags.slice(0, 8))
                        tagIds = validTags.map(t => t.id)
                    } else {
                        // Slow path: generate with AI
                        const tagsResult = await generateTagsAction({ title: match.title, type: aiType, description: providerDescription }).catch(() => ({ tags: [] }))
                        if (tagsResult.tags) {
                            const { createTagsBatch } = await import('@/lib/actions/tags')
                            const rawTags = Array.isArray(tagsResult.tags)
                                ? tagsResult.tags
                                : String(tagsResult.tags).split(',').map(t => t.trim())
                            const validTags = await createTagsBatch(rawTags.slice(0, 8))
                            tagIds = validTags.map(t => t.id)
                        }
                    }

                    // Wait for description
                    const descResult = await descPromise
                    if (descResult.description) {
                        description = descResult.description
                    }
                }

                // 4. Create the item with full metadata
                await createItemInternal({
                    name: rec.name,
                    description,
                    categoryId: categoryId || '',
                    image,
                    tags: tagIds,
                    metadata
                })
                setAddedItems(prev => new Set(prev).add(rec.name))
            } finally {
                setAddingItemName(null)
            }
        })
    }

    const archetype = data?.profile?.top_genres?.[0] ? `The ${data.profile.top_genres[0]} Connoisseur` : "The Eclectic Curator"

    // Generic Markdown Components
    const MarkdownComponents = {
        strong: ({ ...props }: any) => <span className="font-semibold text-white" {...props} />,
        ul: ({ ...props }: any) => <ul className="list-disc pl-5 space-y-1 my-2 text-zinc-200/90" {...props} />,
        ol: ({ ...props }: any) => <ol className="list-decimal pl-5 space-y-1 my-2 text-zinc-200/90" {...props} />,
        li: ({ ...props }: any) => <li className="pl-1" {...props} />,
        p: ({ ...props }: any) => <p className="mb-3 last:mb-0 leading-relaxed text-zinc-100 text-base" {...props} />
    }

    return (
        <Tabs defaultValue="profile" className="w-full flex flex-col h-full">
            <div className="px-6 pt-2 border-b border-white/5 shrink-0 bg-zinc-900/30">
                <TabsList className="w-full justify-start bg-transparent p-0 gap-8 h-auto">
                    <TabsTrigger
                        value="profile"
                        className="rounded-none border-b-2 border-transparent px-2 py-3 font-medium text-zinc-400 hover:text-zinc-200 data-[state=active]:border-blue-500 data-[state=active]:text-blue-400 data-[state=active]:bg-blue-500/5 transition-all duration-200"
                    >
                        Curator Profile
                    </TabsTrigger>
                    <TabsTrigger
                        value="analysis"
                        className="rounded-none border-b-2 border-transparent px-2 py-3 font-medium text-zinc-400 hover:text-zinc-200 data-[state=active]:border-blue-500 data-[state=active]:text-blue-400 data-[state=active]:bg-blue-500/5 transition-all duration-200"
                    >
                        Deep Analysis
                    </TabsTrigger>
                    <TabsTrigger
                        value="recommendations"
                        className="rounded-none border-b-2 border-transparent px-2 py-3 font-medium text-zinc-400 hover:text-zinc-200 data-[state=active]:border-blue-500 data-[state=active]:text-blue-400 data-[state=active]:bg-blue-500/5 transition-all duration-200"
                    >
                        Recommendations
                    </TabsTrigger>
                    <TabsTrigger
                        value="benchmarks"
                        className="rounded-none border-b-2 border-transparent px-2 py-3 font-medium text-zinc-400 hover:text-zinc-200 data-[state=active]:border-blue-500 data-[state=active]:text-blue-400 data-[state=active]:bg-blue-500/5 transition-all duration-200"
                    >
                        Benchmarks
                    </TabsTrigger>
                </TabsList>
            </div>

            <ScrollArea className="flex-1 bg-black/40">
                {/* Profile Tab */}
                <TabsContent value="profile" className="p-8 focus-visible:outline-none data-[state=inactive]:hidden m-0">
                    <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className="text-center space-y-4 py-8">
                            <h2 className="text-5xl md:text-6xl font-serif font-bold italic bg-gradient-to-br from-white via-blue-100 to-blue-300 bg-clip-text text-transparent pb-2">
                                {archetype}
                            </h2>
                            <div className="h-1 w-24 bg-blue-500 mx-auto rounded-full opacity-50" />
                        </div>

                        <div className="grid gap-8">
                            <div className="text-lg md:text-xl leading-relaxed font-serif text-zinc-200/90 text-center max-w-2xl mx-auto">
                                <ReactMarkdown components={{
                                    ...MarkdownComponents,
                                    p: ({ ...props }: any) => <p className="mb-4" {...props} />
                                }}>
                                    {data.profile.summary}
                                </ReactMarkdown>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-white/5">
                                <div className="space-y-4">
                                    <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider text-center">Top Genres</h3>
                                    <div className="flex flex-wrap justify-center gap-3">
                                        {data.profile.top_genres.map((genre, i) => (
                                            <Badge
                                                key={i}
                                                variant="outline"
                                                className="bg-zinc-900/50 text-zinc-400 border-zinc-700 px-4 py-1.5 text-sm uppercase tracking-wider font-medium"
                                            >
                                                {genre}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <ProfileHighlightCard data={data} />
                                </div>
                            </div>
                        </div>
                    </div>
                </TabsContent>

                {/* Analysis Tab (Refactored 3-Column Layout with Cards) */}
                <TabsContent value="analysis" className="p-8 focus-visible:outline-none data-[state=inactive]:hidden m-0">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300 max-w-7xl mx-auto">

                        {/* Column 1: High Rated Patterns */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                                <ThumbsUp className="w-5 h-5 text-emerald-500" />
                                <h3 className="font-serif text-lg text-emerald-100 italic">What You Love</h3>
                            </div>
                            <div className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
                                <h4 className="text-base font-medium text-emerald-400 mb-4">High-Rated Patterns</h4>
                                <div className="text-zinc-100 text-base">
                                    <ReactMarkdown components={{
                                        ...MarkdownComponents,
                                        strong: ({ ...props }: any) => <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-green-300" {...props} />
                                    }}>
                                        {data.analysis.high_rated_patterns}
                                    </ReactMarkdown>
                                </div>
                            </div>
                        </div>

                        {/* Column 2: Narrative DNA */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                                <BookOpen className="w-5 h-5 text-blue-400" />
                                <h3 className="font-serif text-lg text-blue-100 italic">Your DNA</h3>
                            </div>

                            <div className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm space-y-6">
                                <div>
                                    <h4 className="text-base font-medium text-blue-400 mb-4 flex items-center gap-2">
                                        <Palette className="w-4 h-4" /> Visual Style
                                    </h4>
                                    <div className="text-zinc-100 text-base">
                                        <ReactMarkdown
                                            components={{
                                                ...MarkdownComponents,
                                                strong: ({ ...props }: any) => <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400" {...props} />
                                            }}
                                        >
                                            {data.profile.visual_style}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                                <div className="pt-6 border-t border-white/5">
                                    <h4 className="text-base font-medium text-blue-400 mb-4 flex items-center gap-2">
                                        <BookOpen className="w-4 h-4" /> Narrative
                                    </h4>
                                    <div className="text-zinc-100 text-base">
                                        <ReactMarkdown components={{
                                            ...MarkdownComponents,
                                            strong: ({ ...props }: any) => <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400" {...props} />
                                        }}>
                                            {data.profile.narrative_preference}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Column 3: Blind Spots & Outliers */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Compass className="w-5 h-5 text-amber-400" />
                                <h3 className="font-serif text-lg text-amber-100 italic">Horizons</h3>
                            </div>

                            <div className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
                                {data.analysis.unexplored_themes && (
                                    <div>
                                        <h4 className="text-base font-medium text-amber-400 mb-4 flex items-center gap-2">
                                            <Compass className="w-4 h-4" /> Room for Growth
                                        </h4>
                                        <div className="text-zinc-100 text-base">
                                            <ReactMarkdown components={{
                                                ...MarkdownComponents,
                                                strong: ({ ...props }: any) => <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-yellow-200" {...props} />
                                            }}>
                                                {data.analysis.unexplored_themes}
                                            </ReactMarkdown>
                                        </div>
                                    </div>
                                )}
                                <div className="pt-6 border-t border-white/5">
                                    <h4 className="text-base font-medium text-zinc-400 mb-4 flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4" /> Outliers
                                    </h4>
                                    <div className="text-zinc-400 text-base">
                                        <ReactMarkdown components={MarkdownComponents}>
                                            {data.analysis.outliers}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </TabsContent>

                {/* Recommendations Tab (Vertical Stack) */}
                <TabsContent value="recommendations" className="p-8 pb-16 focus-visible:outline-none data-[state=inactive]:hidden m-0">
                    <div className="flex flex-col gap-12 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {/* Positive Recommendations */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-3 pb-2 border-b border-white/10">
                                <Sparkles className="w-5 h-5 text-emerald-400" />
                                <h3 className="font-serif text-xl text-emerald-100">Recommended for You</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {data.recommendations.map((rec, i) => (
                                    <RecommendationCard
                                        key={i}
                                        item={{
                                            name: rec.name,
                                            year: rec.releaseYear,
                                            medium: rec.medium,
                                            description: rec.reason,
                                            score: rec.matchScore
                                        }}
                                        variant="success"
                                        isAdded={addedItems.has(rec.name)}
                                        onAdd={categoryId && canEdit ? () => handleAddItem({ name: rec.name, reason: rec.reason, medium: rec.medium }) : undefined}
                                        isAdding={addingItemName === rec.name}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Anti-Recommendations */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-3 pb-2 border-b border-white/10">
                                <AlertTriangle className="w-5 h-5 text-rose-400" />
                                <h3 className="font-serif text-xl text-rose-100">Likely Misses</h3>
                            </div>
                            {data.anti_recommendations.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {data.anti_recommendations.map((rec, i) => (
                                        <RecommendationCard
                                            key={i}
                                            item={{
                                                name: rec.name,
                                                year: rec.releaseYear,
                                                medium: rec.medium,
                                                description: rec.warning,
                                                score: rec.matchScore
                                            }}
                                            variant="danger"
                                            isAdded={addedItems.has(rec.name)}
                                            onAdd={categoryId && canEdit ? () => handleAddItem({ name: rec.name, reason: rec.warning, medium: rec.medium }) : undefined}
                                            isAdding={addingItemName === rec.name}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="p-8 text-center text-zinc-500 italic bg-white/5 rounded-lg border border-white/5">
                                    Your taste is broad enough that we couldn't find any obvious "do not watch" items!
                                </div>
                            )}
                        </div>
                    </div>
                </TabsContent>

                {/* Benchmarks Tab */}
                <TabsContent value="benchmarks" className="p-0 focus-visible:outline-none data-[state=inactive]:hidden m-0">
                    <BenchmarksContent categoryId={categoryId} />
                </TabsContent>
            </ScrollArea>
        </Tabs>
    )
}

