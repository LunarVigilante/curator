'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Trophy, Plus, GripVertical, X } from 'lucide-react'
import Image from 'next/image'
import { motion, Reorder } from 'framer-motion'
import { useState } from 'react'
import { removeTopPick, reorderTopPicks } from '@/lib/actions/profile'
import { toast } from 'sonner'

interface TopPick {
    id: string
    name: string
    image: string | null
    tier: string | null
    categoryName?: string | null
}

interface TopPicksSectionProps {
    picks: TopPick[]
    isOwner: boolean
    onAddClick?: () => void
}

export function TopPicksSection({ picks, isOwner, onAddClick }: TopPicksSectionProps) {
    const [items, setItems] = useState(picks)
    const [isReordering, setIsReordering] = useState(false)

    const handleReorder = async (newOrder: TopPick[]) => {
        setItems(newOrder)
        const itemIds = newOrder.map(p => p.id)
        const result = await reorderTopPicks(itemIds)
        if (!result.success) {
            toast.error(result.error || 'Failed to reorder')
            setItems(picks) // Revert
        }
    }

    const handleRemove = async (itemId: string) => {
        const result = await removeTopPick(itemId)
        if (result.success) {
            setItems(prev => prev.filter(p => p.id !== itemId))
            toast.success('Removed from top picks')
        } else {
            toast.error(result.error || 'Failed to remove')
        }
    }

    return (
        <Card className="bg-zinc-900/50 border-white/10">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-zinc-100">
                    <Trophy className="w-5 h-5 text-yellow-500" />
                    Top 3 Picks
                </CardTitle>
                {isOwner && items.length < 3 && onAddClick && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onAddClick}
                        className="text-zinc-400 hover:text-white"
                    >
                        <Plus className="w-4 h-4 mr-1" />
                        Add
                    </Button>
                )}
            </CardHeader>
            <CardContent>
                {items.length === 0 ? (
                    <div className="text-center py-8 text-zinc-500">
                        <Trophy className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>No top picks yet</p>
                        {isOwner && (
                            <p className="text-sm mt-1">Pin your favorite items to show off your taste!</p>
                        )}
                    </div>
                ) : (
                    <Reorder.Group
                        axis="y"
                        values={items}
                        onReorder={handleReorder}
                        className="space-y-3"
                    >
                        {items.map((pick, index) => (
                            <Reorder.Item
                                key={pick.id}
                                value={pick}
                                className="cursor-grab active:cursor-grabbing"
                                whileDrag={{ scale: 1.02, boxShadow: '0 8px 30px rgba(0,0,0,0.3)' }}
                            >
                                <motion.div
                                    className="flex items-center gap-4 p-3 rounded-lg bg-zinc-800/50 border border-white/5 group"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.1 }}
                                >
                                    {/* Rank Badge */}
                                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 text-black font-bold text-sm">
                                        {index + 1}
                                    </div>

                                    {/* Image */}
                                    {pick.image ? (
                                        <Image
                                            src={pick.image}
                                            alt={pick.name}
                                            width={48}
                                            height={48}
                                            className="rounded object-cover w-12 h-12"
                                        />
                                    ) : (
                                        <div className="w-12 h-12 rounded bg-zinc-700 flex items-center justify-center">
                                            <Trophy className="w-5 h-5 text-zinc-500" />
                                        </div>
                                    )}

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-white truncate">{pick.name}</div>
                                        <div className="text-sm text-zinc-500 flex items-center gap-2">
                                            {pick.tier && (
                                                <span className="text-yellow-500 font-bold">{pick.tier}</span>
                                            )}
                                            {pick.categoryName && (
                                                <span className="truncate">{pick.categoryName}</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    {isOwner && (
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <GripVertical className="w-4 h-4 text-zinc-500" />
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="w-7 h-7 text-zinc-500 hover:text-red-400"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleRemove(pick.id)
                                                }}
                                            >
                                                <X className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    )}
                                </motion.div>
                            </Reorder.Item>
                        ))}
                    </Reorder.Group>
                )}
            </CardContent>
        </Card>
    )
}
