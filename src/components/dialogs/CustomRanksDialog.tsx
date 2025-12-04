'use client'

import { useState, useTransition } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ThumbsUp, ThumbsDown, Minus, Trash2, Plus, Sparkles } from 'lucide-react'
import { getCustomRanks, createCustomRank, deleteCustomRank, analyzeSentiment } from '@/lib/actions/customRanks'
import { toast } from 'sonner'

type CustomRank = {
    id: string
    name: string
    sentiment: 'positive' | 'neutral' | 'negative'
    color: string | null
    sortOrder: number
}

const SENTIMENT_ICONS = {
    positive: { icon: ThumbsUp, className: 'text-green-500', label: 'Positive' },
    neutral: { icon: Minus, className: 'text-gray-500', label: 'Neutral' },
    negative: { icon: ThumbsDown, className: 'text-red-500', label: 'Negative' }
}

export default function CustomRanksDialog({
    categoryId,
    open,
    onOpenChange,
    initialRanks = []
}: {
    categoryId: string
    open: boolean
    onOpenChange: (open: boolean) => void
    initialRanks?: CustomRank[]
}) {
    const [ranks, setRanks] = useState<CustomRank[]>(initialRanks)
    const [isAdding, setIsAdding] = useState(false)
    const [newRankName, setNewRankName] = useState('')
    const [newRankSentiment, setNewRankSentiment] = useState<'positive' | 'neutral' | 'negative'>('neutral')
    const [analyzing, setAnalyzing] = useState(false)
    const [isPending, startTransition] = useTransition()

    const handleAnalyzeSentiment = async () => {
        if (!newRankName.trim()) {
            toast.error('Please enter a rank name first')
            return
        }

        setAnalyzing(true)
        try {
            const sentiment = await analyzeSentiment(newRankName)
            setNewRankSentiment(sentiment)
            toast.success(`Analyzed as ${sentiment}`)
        } catch (error) {
            toast.error('Failed to analyze sentiment')
        } finally {
            setAnalyzing(false)
        }
    }

    const handleAddRank = async () => {
        if (!newRankName.trim()) {
            toast.error('Please enter a rank name')
            return
        }

        startTransition(async () => {
            try {
                const newRank = await createCustomRank(categoryId, {
                    name: newRankName,
                    sentiment: newRankSentiment
                })

                setRanks([...ranks, newRank as CustomRank])
                setNewRankName('')
                setNewRankSentiment('neutral')
                setIsAdding(false)
                toast.success(`Added "${newRank.name}" rank`)
            } catch (error) {
                toast.error('Failed to create custom rank')
            }
        })
    }

    const handleDeleteRank = async (id: string, name: string) => {
        if (!confirm(`Delete "${name}" rank? Items with this rank will become unranked.`)) {
            return
        }

        startTransition(async () => {
            try {
                await deleteCustomRank(id)
                setRanks(ranks.filter(r => r.id !== id))
                toast.success(`Deleted "${name}" rank`)
            } catch (error) {
                toast.error('Failed to delete rank')
            }
        })
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Manage Custom Ranks</DialogTitle>
                    <DialogDescription>
                        Create category-specific ranks like "Haven't Finished" or "Currently Watching". AI analyzes sentiment automatically.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto space-y-4">
                    {/* Existing Ranks */}
                    {ranks.length > 0 && (
                        <div className="space-y-2">
                            <h4 className="font-semibold text-sm text-muted-foreground">Custom Ranks</h4>
                            {ranks.map((rank) => {
                                const SentimentIcon = SENTIMENT_ICONS[rank.sentiment].icon
                                return (
                                    <div
                                        key={rank.id}
                                        className="flex items-center justify-between p-3 border rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="w-8 h-8 rounded flex items-center justify-center"
                                                style={{ backgroundColor: rank.color || '#6b7280' }}
                                            >
                                                <span className="text-xs text-white font-bold">
                                                    {rank.name.charAt(0).toUpperCase()}
                                                </span>
                                            </div>
                                            <div>
                                                <p className="font-semibold">{rank.name}</p>
                                                <div className="flex items-center gap-1 text-xs">
                                                    <SentimentIcon className={`w-3 h-3 ${SENTIMENT_ICONS[rank.sentiment].className}`} />
                                                    <span className="text-muted-foreground">{SENTIMENT_ICONS[rank.sentiment].label}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDeleteRank(rank.id, rank.name)}
                                            disabled={isPending}
                                        >
                                            <Trash2 className="w-4 h-4 text-destructive" />
                                        </Button>
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {/* Add New Rank */}
                    {!isAdding ? (
                        <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => setIsAdding(true)}
                            disabled={isPending}
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Add Custom Rank
                        </Button>
                    ) : (
                        <div className="border rounded-lg p-4 space-y-4 bg-muted/20">
                            <div className="grid gap-2">
                                <Label htmlFor="rank-name">Rank Name</Label>
                                <Input
                                    id="rank-name"
                                    value={newRankName}
                                    onChange={(e) => setNewRankName(e.target.value)}
                                    placeholder="e.g., Haven't Finished, Currently Watching"
                                />
                            </div>

                            <div className="grid gap-2">
                                <div className="flex items-center justify-between">
                                    <Label>Sentiment</Label>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleAnalyzeSentiment}
                                        disabled={!newRankName.trim() || analyzing}
                                        className="h-7 text-xs"
                                    >
                                        <Sparkles className="w-3 h-3 mr-1" />
                                        {analyzing ? 'Analyzing...' : 'Auto-Detect'}
                                    </Button>
                                </div>
                                <Select value={newRankSentiment} onValueChange={(v: any) => setNewRankSentiment(v)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="positive">
                                            <div className="flex items-center gap-2">
                                                <ThumbsUp className="w-4 h-4 text-green-500" />
                                                <span>Positive</span>
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="neutral">
                                            <div className="flex items-center gap-2">
                                                <Minus className="w-4 h-4 text-gray-500" />
                                                <span>Neutral</span>
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="negative">
                                            <div className="flex items-center gap-2">
                                                <ThumbsDown className="w-4 h-4 text-red-500" />
                                                <span>Negative</span>
                                            </div>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                    {newRankSentiment === 'positive' && 'Boosts item ratings (+10-20 points)'}
                                    {newRankSentiment === 'negative' && 'Decreases item ratings (-10-20 points)'}
                                    {newRankSentiment === 'neutral' && 'No rating adjustment'}
                                </p>
                            </div>

                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => {
                                        setIsAdding(false)
                                        setNewRankName('')
                                        setNewRankSentiment('neutral')
                                    }}
                                    disabled={isPending}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    className="flex-1"
                                    onClick={handleAddRank}
                                    disabled={!newRankName.trim() || isPending}
                                >
                                    {isPending ? 'Adding...' : 'Add Rank'}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
