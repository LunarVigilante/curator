'use client'

import { useState, useTransition } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Sparkles, Plus, RefreshCw } from 'lucide-react'
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

    const handleAdd = () => {
        if (!recommendation) return

        startTransition(async () => {
            await createItem({
                name: recommendation.name,
                description: recommendation.description,
                categoryId: categoryId,
                image: '' // No image for now
            })
            setOpen(false)
            // Reset for next time
            setRecommendation(null)
        })
    }

    return (
        <>
            <Button onClick={handleOpen} variant="default" className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0">
                <Sparkles className="h-4 w-4 mr-2" />
                Recommend New Item
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-purple-500" />
                            AI Recommendation
                        </DialogTitle>
                        <DialogDescription>
                            Based on your favorites in {categoryName}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-6 space-y-4">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-8 space-y-4">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
                                <p className="text-muted-foreground animate-pulse">Consulting the oracle...</p>
                            </div>
                        ) : recommendation ? (
                            <div className="space-y-4">
                                <div className="p-4 bg-muted/50 rounded-lg border border-purple-100 dark:border-purple-900">
                                    <h3 className="text-xl font-bold text-purple-700 dark:text-purple-300 mb-2">
                                        {recommendation.name}
                                    </h3>
                                    <p className="text-sm text-muted-foreground mb-3">
                                        {recommendation.description}
                                    </p>
                                    <div className="text-sm bg-background p-3 rounded border italic">
                                        &quot;{recommendation.reasoning}&quot;
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-8 text-muted-foreground">
                                Failed to get recommendation. Please try again.
                            </div>
                        )}
                    </div>

                    <DialogFooter className="flex gap-2 sm:justify-between">
                        <Button variant="ghost" onClick={fetchRecommendation} disabled={loading}>
                            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                            Try Another
                        </Button>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setOpen(false)}>
                                Close
                            </Button>
                            {recommendation && (
                                <Button onClick={handleAdd} disabled={isAdding}>
                                    <Plus className="h-4 w-4 mr-2" />
                                    {isAdding ? 'Adding...' : 'Add to List'}
                                </Button>
                            )}
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
