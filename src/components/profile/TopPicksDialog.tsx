'use client'

import { useState, useEffect, useTransition } from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Trophy, Search, Plus, Loader2 } from 'lucide-react'
import Image from 'next/image'
import { getMyItemsForTopPicks, addTopPick } from '@/lib/actions/profile'
import { toast } from 'sonner'

interface TopPickItem {
    id: string
    name: string
    image: string | null
    tier: string | null
    categoryName: string | null
}

interface TopPicksDialogProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

export function TopPicksDialog({ isOpen, onOpenChange, onSuccess }: TopPicksDialogProps) {
    const [items, setItems] = useState<TopPickItem[]>([])
    const [filteredItems, setFilteredItems] = useState<TopPickItem[]>([])
    const [search, setSearch] = useState('')
    const [isLoading, setIsLoading] = useState(true)
    const [isPending, startTransition] = useTransition()

    useEffect(() => {
        if (isOpen) {
            setIsLoading(true)
            getMyItemsForTopPicks().then((data) => {
                const safeData: TopPickItem[] = data.map(item => ({
                    ...item,
                    name: item.name || 'Untitled Item'
                }))
                setItems(safeData)
                setFilteredItems(safeData)
                setIsLoading(false)
            })
        }
    }, [isOpen])

    useEffect(() => {
        if (search.trim()) {
            setFilteredItems(
                items.filter(item =>
                    item.name.toLowerCase().includes(search.toLowerCase()) ||
                    item.categoryName?.toLowerCase().includes(search.toLowerCase())
                )
            )
        } else {
            setFilteredItems(items)
        }
    }, [search, items])

    const handleAddPick = (itemId: string) => {
        startTransition(async () => {
            const result = await addTopPick(itemId)
            if (result.success) {
                toast.success('Added to Top 3 Picks!')
                onOpenChange(false)
                onSuccess?.()
            } else {
                toast.error(result.error || 'Failed to add pick')
            }
        })
    }

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="bg-zinc-900 border-zinc-800 max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-yellow-500" />
                        Add to Top 3 Picks
                    </DialogTitle>
                </DialogHeader>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <Input
                        placeholder="Search your items..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-10 bg-zinc-800 border-zinc-700"
                    />
                </div>

                {/* Items List */}
                <div className="flex-1 overflow-y-auto space-y-2 min-h-[300px]">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <div className="text-center py-12 text-zinc-500">
                            <Trophy className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p>{items.length === 0 ? 'No items to add' : 'No matching items'}</p>
                            {items.length === 0 && (
                                <p className="text-sm mt-1">Rank some items first!</p>
                            )}
                        </div>
                    ) : (
                        filteredItems.map((item) => (
                            <div
                                key={item.id}
                                className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50 hover:border-zinc-600 transition-colors"
                            >
                                {/* Image */}
                                {item.image ? (
                                    <Image
                                        src={item.image}
                                        alt={item.name}
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
                                    <div className="font-medium text-white truncate">{item.name}</div>
                                    <div className="text-sm text-zinc-500 flex items-center gap-2">
                                        {item.tier && (
                                            <span className="text-yellow-500 font-bold">{item.tier}</span>
                                        )}
                                        {item.categoryName && (
                                            <span className="truncate">{item.categoryName}</span>
                                        )}
                                    </div>
                                </div>

                                {/* Add Button */}
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleAddPick(item.id)}
                                    disabled={isPending}
                                    className="text-yellow-500 hover:text-yellow-400 hover:bg-yellow-500/10"
                                >
                                    {isPending ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Plus className="w-4 h-4" />
                                    )}
                                </Button>
                            </div>
                        ))
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
