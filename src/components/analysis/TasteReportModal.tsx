import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TasteAnalysis } from "@/lib/actions/analysis"
import { Brain, ThumbsUp, ThumbsDown, Lightbulb, AlertTriangle, Plus, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createItem } from "@/lib/actions/items"
import { useState, useTransition } from "react"

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
                categoryId: categoryId || '', // If no categoryId provided, we might fail or need to handle it. 
                // Ideally we should ask user or use the category from recommendation if available and map it to an ID.
                // But for now, if called from category page, we have ID. If from home, we don't.
                // If from home, we can't easily create item without category.
                // Maybe we should disable adding if no categoryId? Or prompt?
                // For now let's assume if categoryId is missing, we can't add.
                image: ''
            })
            setAddedItems(prev => new Set(prev).add(rec.name))
        })
    }

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="text-2xl flex items-center gap-2">
                        <Brain className="w-6 h-6 text-primary" />
                        Your Taste Report Card
                    </DialogTitle>
                    <DialogDescription>
                        AI-powered analysis of your tier list and preferences.
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="profile" className="flex-1 flex flex-col overflow-hidden">
                    <div className="px-6">
                        <TabsList className="w-full justify-start overflow-x-auto">
                            <TabsTrigger value="profile">Profile</TabsTrigger>
                            <TabsTrigger value="analysis">Analysis</TabsTrigger>
                            <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
                            <TabsTrigger value="updates">Updates</TabsTrigger>
                        </TabsList>
                    </div>

                    <div className="flex-1 overflow-hidden">
                        <ScrollArea className="h-full">
                            <div className="p-6">

                                {/* PROFILE TAB */}
                                <TabsContent value="profile" className="space-y-4 mt-0">
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Taste Summary</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="text-lg leading-relaxed">{data.profile.summary}</p>
                                        </CardContent>
                                    </Card>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="text-base">Top Genres</CardTitle>
                                            </CardHeader>
                                            <CardContent className="flex flex-wrap gap-2">
                                                {data.profile.top_genres.map((genre, i) => (
                                                    <Badge key={i} variant="secondary">{genre}</Badge>
                                                ))}
                                            </CardContent>
                                        </Card>

                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="text-base">Visual Style</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <p className="text-sm text-muted-foreground">{data.profile.visual_style}</p>
                                            </CardContent>
                                        </Card>

                                        <Card className="md:col-span-2">
                                            <CardHeader>
                                                <CardTitle className="text-base">Narrative Preference</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <p className="text-sm text-muted-foreground">{data.profile.narrative_preference}</p>
                                            </CardContent>
                                        </Card>
                                    </div>
                                </TabsContent>

                                {/* ANALYSIS TAB */}
                                <TabsContent value="analysis" className="space-y-4 mt-0">
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2">
                                                <ThumbsUp className="w-5 h-5 text-green-500" />
                                                High-Rated Patterns
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <p>{data.analysis.high_rated_patterns}</p>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2">
                                                <ThumbsDown className="w-5 h-5 text-red-500" />
                                                Low-Rated Patterns
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <p>{data.analysis.low_rated_patterns}</p>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2">
                                                <AlertTriangle className="w-5 h-5 text-yellow-500" />
                                                Outliers & Contradictions
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <p>{data.analysis.outliers}</p>
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                {/* RECOMMENDATIONS TAB */}
                                <TabsContent value="recommendations" className="space-y-4 mt-0">
                                    <div className="grid gap-4">
                                        {data.recommendations.map((rec, i) => (
                                            <Card key={i} className="border-l-4 border-l-green-500">
                                                <CardHeader>
                                                    <CardTitle className="flex justify-between items-center">
                                                        <div className="flex flex-col">
                                                            <span>{rec.name}</span>
                                                            {rec.category && <span className="text-xs font-normal text-muted-foreground">{rec.category}</span>}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                                                {Math.round(rec.confidence * 100)}% Match
                                                            </Badge>
                                                            {categoryId && (
                                                                <Button
                                                                    size="sm"
                                                                    variant={addedItems.has(rec.name) ? "outline" : "default"}
                                                                    disabled={isAdding || addedItems.has(rec.name)}
                                                                    onClick={() => handleAddItem(rec)}
                                                                >
                                                                    {addedItems.has(rec.name) ? (
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
                                                <CardContent>
                                                    <p className="text-sm text-muted-foreground">{rec.reason}</p>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>

                                    <div className="my-6 border-t pt-6">
                                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                            <AlertTriangle className="w-5 h-5 text-red-500" />
                                            Anti-Recommendations (Avoid)
                                        </h3>
                                        <div className="grid gap-4">
                                            {data.anti_recommendations.map((rec, i) => (
                                                <Card key={i} className="border-l-4 border-l-red-500 bg-red-50/10">
                                                    <CardHeader>
                                                        <CardTitle>{rec.name}</CardTitle>
                                                    </CardHeader>
                                                    <CardContent>
                                                        <p className="text-sm text-muted-foreground">{rec.warning}</p>
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </div>
                                    </div>
                                </TabsContent>

                                {/* UPDATES TAB */}
                                <TabsContent value="updates" className="space-y-4 mt-0">
                                    <CardDescription className="mb-4">
                                        The AI suggests these updates to your existing items to better reflect their content.
                                    </CardDescription>
                                    <div className="grid gap-4">
                                        {data.suggested_metadata_updates.map((update, i) => (
                                            <Card key={i}>
                                                <CardHeader>
                                                    <CardTitle className="text-base">{update.item_name}</CardTitle>
                                                </CardHeader>
                                                <CardContent className="space-y-2">
                                                    <div>
                                                        <span className="font-semibold text-xs uppercase text-muted-foreground">Suggested Tags:</span>
                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                            {update.suggested_tags.map((tag, j) => (
                                                                <Badge key={j} variant="outline">{tag}</Badge>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <span className="font-semibold text-xs uppercase text-muted-foreground">Improved Description:</span>
                                                        <p className="text-sm mt-1">{update.suggested_description}</p>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                </TabsContent>
                            </div>
                        </ScrollArea>
                    </div>
                </Tabs>
            </DialogContent>
        </Dialog>
    )
}
