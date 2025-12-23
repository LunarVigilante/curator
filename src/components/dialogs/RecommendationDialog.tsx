'use client'

import { useState, useTransition } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Sparkles, Plus, RefreshCw, AlertTriangle } from 'lucide-react'
import { getRecommendation, RecommendationResult } from '@/lib/actions/recommendations'
import { createItem } from '@/lib/actions/items'

export default function RecommendationDialog({
    categoryId,
    categoryName
}: {
    categoryId: string
    categoryName: string
}) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [recommendation, setRecommendation] = useState<RecommendationResult | null>(null)
    const [isAdding, startTransition] = useTransition()
    const [addingIndex, setAddingIndex] = useState<number | null>(null)

    const fetchRecommendation = async () => {
        setLoading(true)
        setRecommendation(null)
        try {
            const result = await getRecommendation(categoryId)
            setRecommendation(result)
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    const handleOpen = () => {
        setOpen(true)
        if (!recommendation) {
            fetchRecommendation()
        }
    }

    const handleAdd = (index: number) => {
        if (!recommendation) return
        const item = recommendation.recommendations[index]

        setAddingIndex(index)
        startTransition(async () => {
            await createItem({
                name: item.name,
                description: item.description,
                categoryId: categoryId,
                image: ''
            })
            setAddingIndex(null)
        })
    }

    return (
        <>
            <Button onClick={handleOpen} variant="default" className="bg-gradient-to-r from-blue-700 to-blue-800 hover:from-blue-600 hover:to-blue-700 text-white border-0">
                <Sparkles className="h-4 w-4 mr-2" />
                Recommend New Items
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-blue-500" />
                            AI Recommendations
                        </DialogTitle>
                        <DialogDescription>
                            Based on your favorites in {categoryName}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-6 space-y-4 max-h-[60vh] overflow-y-auto">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-8 space-y-4">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                                <p className="text-sm text-muted-foreground">Analyzing your taste...</p>
                            </div>
                        ) : recommendation ? (
                            <div className="space-y-6">
                                {/* Recommendations */}
                                <div>
                                    <h4 className="font-semibold mb-3 text-green-600 dark:text-green-400">✨ You Might Love These:</h4>
                                    <div className="space-y-3">
                                        {recommendation.recommendations.map((rec, index) => (
                                            <div key={index} className="p-4 border border-green-200 dark:border-green-800 rounded-lg bg-green-50/50 dark:bg-green-900/10">
                                                <div className="flex justify-between items-start mb-2">
                                                    <h5 className="font-bold text-lg">{rec.name}</h5>
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleAdd(index)}
                                                        disabled={isAdding}
                                                        className="ml-2"
                                                    >
                                                        {addingIndex === index ? (
                                                            <>Adding...</>
                                                        ) : (
                                                            <>
                                                                <Plus className="h-4 w-4 mr-1" />
                                                                Add
                                                            </>
                                                        )}
                                                    </Button>
                                                </div>
                                                <p className="text-sm text-muted-foreground mb-2">{rec.description}</p>
                                                <p className="text-xs italic text-green-700 dark:text-green-300">{rec.reasoning}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Anti-Recommendation */}
                                <div>
                                    <h4 className="font-semibold mb-3 text-red-600 dark:text-red-400 flex items-center gap-2">
                                        <AlertTriangle className="h-4 w-4" />
                                        You Probably Won't Like This:
                                    </h4>
                                    <div className="p-4 border border-red-200 dark:border-red-800 rounded-lg bg-red-50/50 dark:bg-red-900/10">
                                        <h5 className="font-bold text-lg mb-2">{recommendation.antiRecommendation.name}</h5>
                                        <p className="text-sm text-muted-foreground mb-2">{recommendation.antiRecommendation.description}</p>
                                        <p className="text-xs italic text-red-700 dark:text-red-300">{recommendation.antiRecommendation.reasoning}</p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-8 text-muted-foreground">
                                <p>Click the button below to get new recommendations.</p>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={fetchRecommendation} disabled={loading}>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Get New Suggestions
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
