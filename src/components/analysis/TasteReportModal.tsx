import { Button } from "@/components/ui/button"
import { createItem, applyItemEnhancement } from "@/lib/actions/items"
import { useState, useTransition } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TasteAnalysis } from "@/lib/actions/analysis"
import { Brain, ThumbsUp, ThumbsDown, AlertTriangle, Palette, BookOpen, Tag, Plus, Check, Compass } from "lucide-react"
import ReactMarkdown from "react-markdown"

interface TasteReportModalProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    data: TasteAnalysis | null
    categoryId?: string
}

export function TasteReportModal({ isOpen, onOpenChange, data, categoryId }: TasteReportModalProps) {
    const [isAdding, startTransition] = useTransition()
    const [addedItems, setAddedItems] = useState<Set<string>>(new Set())

    if (!data) return null

    const handleAddItem = (rec: { name: string, reason: string, category?: string }) => {
        startTransition(async () => {
            await createItem({
                name: rec.name,
                description: rec.reason,
                categoryId: categoryId || '',
                image: ''
            })
            setAddedItems(prev => new Set(prev).add(rec.name))
        })
    }

    // Determine archetype placeholder (could be moved to backend later)
    const archetype = data.profile.top_genres[0] ? `The ${data.profile.top_genres[0]} Connoisseur` : "The Eclectic Curator"

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden bg-zinc-950 border-zinc-800">
                <div className="p-6 border-b border-white/10 bg-zinc-900/50 backdrop-blur-xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl flex items-center gap-2 font-serif italic text-white/90">
                            <Brain className="w-6 h-6 text-blue-500" />
                            Taste Report Card
                        </DialogTitle>
                        <DialogDescription className="text-zinc-400">
                            A deep dive into your unique preferences and ranking habits.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <Tabs defaultValue="profile" className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    <div className="px-6 pt-2 border-b border-white/5 shrink-0">
                        <TabsList className="w-full justify-start bg-transparent p-0 gap-6 h-auto">
                            <TabsTrigger
                                value="profile"
                                className="rounded-none border-b-2 border-transparent px-2 py-3 font-medium text-zinc-500 hover:text-zinc-300 data-[state=active]:border-blue-500 data-[state=active]:text-blue-400 data-[state=active]:bg-blue-500/10 transition-all duration-200"
                            >
                                Profile
                            </TabsTrigger>
                            <TabsTrigger
                                value="analysis"
                                className="rounded-none border-b-2 border-transparent px-2 py-3 font-medium text-zinc-500 hover:text-zinc-300 data-[state=active]:border-blue-500 data-[state=active]:text-blue-400 data-[state=active]:bg-blue-500/10 transition-all duration-200"
                            >
                                Analysis
                            </TabsTrigger>
                            <TabsTrigger
                                value="recommendations"
                                className="rounded-none border-b-2 border-transparent px-2 py-3 font-medium text-zinc-500 hover:text-zinc-300 data-[state=active]:border-blue-500 data-[state=active]:text-blue-400 data-[state=active]:bg-blue-500/10 transition-all duration-200"
                            >
                                Recommendations
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-black/20">
                        {/* Profile Tab */}
                        <TabsContent value="profile" className="flex-1 overflow-y-auto p-6 pb-12 focus-visible:outline-none data-[state=inactive]:hidden">
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                <div className="space-y-4">
                                    <h2 className="text-4xl md:text-5xl font-serif font-bold italic bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent pb-1">
                                        {archetype}
                                    </h2>
                                    <div className="text-lg md:text-xl leading-relaxed font-serif text-zinc-300/90 max-w-3xl">
                                        <ReactMarkdown
                                            components={{
                                                strong: ({ ...props }) => <strong className="text-sky-400 font-bold" {...props} />,
                                                p: ({ ...props }) => <p className="mb-4 text-zinc-300/90 leading-relaxed" {...props} />,
                                                ul: ({ ...props }) => <ul className="list-disc pl-5 space-y-2 mb-4" {...props} />,
                                                li: ({ ...props }) => <li className="text-zinc-300/90" {...props} />
                                            }}
                                        >
                                            {data.profile.summary}
                                        </ReactMarkdown>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Top Genres */}
                                    <Card className="bg-white/5 border-white/10 hover:bg-white/[0.07] transition-colors flex flex-col justify-center">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm font-medium uppercase tracking-wider text-zinc-500 flex items-center gap-2 font-sans">
                                                <Tag className="w-4 h-4" />
                                                Top Genres
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-6 pt-0 flex flex-wrap gap-2">
                                            {data.profile.top_genres.map((genre, i) => (
                                                <Badge
                                                    key={i}
                                                    variant="secondary"
                                                    className="bg-blue-500/15 text-blue-300 hover:bg-blue-500/25 border-none px-3 py-1 text-sm transition-colors"
                                                >
                                                    {genre}
                                                </Badge>
                                            ))}
                                        </CardContent>
                                    </Card>

                                    {/* Visual Style */}
                                    <Card className="bg-white/5 border-white/10 hover:bg-white/[0.07] transition-colors flex flex-col justify-center">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm font-medium uppercase tracking-wider text-zinc-500 flex items-center gap-2 font-sans">
                                                <Palette className="w-4 h-4" />
                                                Visual Style
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-6 pt-0">
                                            <p className="text-sm text-zinc-300 leading-relaxed font-sans">{data.profile.visual_style}</p>
                                        </CardContent>
                                    </Card>

                                    {/* Narrative Preference */}
                                    <Card className="md:col-span-2 bg-white/5 border-white/10 hover:bg-white/[0.07] transition-colors flex flex-col justify-center">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm font-medium uppercase tracking-wider text-zinc-500 flex items-center gap-2 font-sans">
                                                <BookOpen className="w-4 h-4" />
                                                Narrative Preference
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-6 pt-0">
                                            <p className="text-sm text-zinc-300 leading-relaxed font-sans">{data.profile.narrative_preference}</p>
                                        </CardContent>
                                    </Card>
                                </div>
                            </div>
                        </TabsContent>

                        {/* Analysis Tab */}
                        <TabsContent value="analysis" className="flex-1 overflow-y-auto p-6 pb-12 focus-visible:outline-none data-[state=inactive]:hidden">
                            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <Card className="bg-white/5 border-white/10">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2 text-base">
                                            <ThumbsUp className="w-5 h-5 text-emerald-500" />
                                            High-Rated Patterns
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-muted-foreground text-sm">
                                            <ReactMarkdown
                                                components={{
                                                    strong: ({ ...props }) => <strong className="text-white font-bold" {...props} />,
                                                    p: ({ ...props }) => <p className="mb-3 last:mb-0" {...props} />,
                                                    ul: ({ ...props }) => <ul className="list-disc pl-5 space-y-1 mb-3" {...props} />
                                                }}
                                            >
                                                {data.analysis.high_rated_patterns}
                                            </ReactMarkdown>
                                        </div>
                                    </CardContent>
                                </Card>

                                {data.analysis.unexplored_themes ? (
                                    <Card className="bg-white/5 border-white/10">
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2 text-base text-sky-400">
                                                <Compass className="w-5 h-5 text-sky-400" />
                                                Room for Growth (Unexplored Themes)
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-muted-foreground text-sm">
                                                <ReactMarkdown
                                                    components={{
                                                        strong: ({ ...props }) => <strong className="text-white font-bold" {...props} />,
                                                        p: ({ ...props }) => <p className="mb-3 last:mb-0" {...props} />,
                                                        ul: ({ ...props }) => <ul className="list-disc pl-5 space-y-1 mb-3" {...props} />
                                                    }}
                                                >
                                                    {data.analysis.unexplored_themes}
                                                </ReactMarkdown>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    <Card className="bg-white/5 border-white/10">
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2 text-base">
                                                <ThumbsDown className="w-5 h-5 text-rose-500" />
                                                Low-Rated Patterns
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-muted-foreground text-sm">
                                                <ReactMarkdown
                                                    components={{
                                                        strong: ({ ...props }) => <strong className="text-white font-bold" {...props} />,
                                                        p: ({ ...props }) => <p className="mb-3 last:mb-0" {...props} />,
                                                        ul: ({ ...props }) => <ul className="list-disc pl-5 space-y-1 mb-3" {...props} />
                                                    }}
                                                >
                                                    {data.analysis.low_rated_patterns}
                                                </ReactMarkdown>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}

                                <Card className="bg-white/5 border-white/10">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2 text-base">
                                            <AlertTriangle className="w-5 h-5 text-amber-500" />
                                            Outliers & Contradictions
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-muted-foreground text-sm">
                                            <ReactMarkdown
                                                components={{
                                                    strong: ({ ...props }) => <strong className="text-white font-bold" {...props} />,
                                                    p: ({ ...props }) => <p className="mb-3 last:mb-0" {...props} />,
                                                    ul: ({ ...props }) => <ul className="list-disc pl-5 space-y-1 mb-3" {...props} />
                                                }}
                                            >
                                                {data.analysis.outliers}
                                            </ReactMarkdown>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </TabsContent>

                        {/* Recommendations Tab */}
                        <TabsContent value="recommendations" className="flex-1 overflow-y-auto p-6 pb-16 focus-visible:outline-none data-[state=inactive]:hidden">
                            <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                {/* Positive Recommendations */}
                                <div className="flex flex-col gap-4">
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
                                            onAdd={categoryId ? () => handleAddItem({ name: rec.name, reason: rec.reason }) : undefined}
                                            isAdding={isAdding}
                                        />
                                    ))}
                                </div>

                                {/* Anti-Recommendations */}
                                {data.anti_recommendations.length > 0 && (
                                    <div className="border-t border-white/10 pt-8">
                                        <h3 className="text-xl font-sans font-bold text-rose-500 mb-6 flex items-center gap-2">
                                            <AlertTriangle className="w-5 h-5" />
                                            Anti-Recommendations (Avoid)
                                        </h3>
                                        <div className="flex flex-col gap-4">
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
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </TabsContent>
                    </div>
                </Tabs>
            </DialogContent>
        </Dialog>
    )
}

interface RecommendationCardProps {
    item: {
        name: string
        year?: string
        medium?: string
        description: string
        score: number
        category?: string
    }
    variant: 'success' | 'danger'
    isAdded?: boolean
    onAdd?: () => void
    isAdding?: boolean
}

function RecommendationCard({ item, variant, isAdded, onAdd, isAdding }: RecommendationCardProps) {
    const isSuccess = variant === 'success'
    const borderColor = isSuccess ? 'border-l-emerald-500' : 'border-l-rose-500'
    const badgeBg = isSuccess ? 'bg-emerald-500/10' : 'bg-rose-500/10'
    const badgeText = isSuccess ? 'text-emerald-400' : 'text-rose-400'
    const badgeBorder = isSuccess ? 'border-emerald-500/20' : 'border-rose-500/20'

    return (
        <Card className={`border-l-4 ${borderColor} bg-white/5 border-t-0 border-r-0 border-b-0`}>
            <CardHeader className="pb-2">
                <CardTitle className="flex justify-between items-start gap-4 text-base">
                    <div className="flex flex-col gap-0.5">
                        <span className="font-semibold text-lg leading-tight">{item.name}</span>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground font-normal">
                            {item.year && <span>{item.year}</span>}
                            {item.year && item.medium && <span>•</span>}
                            {item.medium && <span>{item.medium}</span>}
                        </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                        <Badge variant="outline" className={`${badgeBg} ${badgeText} ${badgeBorder}`}>
                            {item.score}% {isSuccess ? 'Match' : 'Mismatch'}
                        </Badge>
                        {onAdd && (
                            <Button
                                size="sm"
                                variant={isAdded ? "outline" : "secondary"}
                                disabled={isAdding || isAdded}
                                onClick={onAdd}
                                className={isAdded ? "text-emerald-500" : ""}
                            >
                                {isAdded ? (
                                    <>
                                        <Check className="w-4 h-4 mr-1" />
                                        Added
                                    </>
                                ) : (
                                    <>
                                        <Plus className="w-4 h-4 mr-1" />
                                        Add
                                    </>
                                )}
                            </Button>
                        )}
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
                <div className={`text-sm mt-0 ${isSuccess ? 'text-muted-foreground' : 'text-rose-300/80'}`}>
                    <ReactMarkdown
                        components={{
                            strong: ({ ...props }) => <strong className={isSuccess ? "text-white font-bold" : "text-rose-100 font-bold"} {...props} />,
                            p: ({ ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                            ul: ({ ...props }) => <ul className="list-disc pl-4 mb-2" {...props} />
                        }}
                    >
                        {item.description}
                    </ReactMarkdown>
                </div>
            </CardContent>
        </Card>
    )
}
