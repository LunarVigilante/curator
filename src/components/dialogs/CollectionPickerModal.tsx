'use client'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Folder, ChevronRight } from 'lucide-react'
import Image from 'next/image'
import { cn } from '@/lib/utils'

export interface CollectionOption {
    id: string
    name: string
    image?: string | null
    itemCount: number
}

interface CollectionPickerModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    collections: CollectionOption[]
    onSelect: (collection: CollectionOption) => void
    title?: string
    description?: string
}

export default function CollectionPickerModal({
    open,
    onOpenChange,
    collections,
    onSelect,
    title = 'Select a Collection',
    description = 'Choose which collection you want to add items to.'
}: CollectionPickerModalProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>

                <div className="grid gap-2 py-4 max-h-[400px] overflow-y-auto">
                    {collections.map((collection) => (
                        <Button
                            key={collection.id}
                            variant="ghost"
                            className={cn(
                                "w-full justify-start h-auto p-3 hover:bg-zinc-800/50",
                                "border border-transparent hover:border-white/10"
                            )}
                            onClick={() => {
                                onSelect(collection)
                                onOpenChange(false)
                            }}
                        >
                            <div className="flex items-center gap-3 w-full">
                                {collection.image ? (
                                    <div className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0">
                                        <Image
                                            src={collection.image}
                                            alt={collection.name}
                                            fill
                                            className="object-cover"
                                        />
                                    </div>
                                ) : (
                                    <div className="w-12 h-12 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
                                        <Folder className="w-5 h-5 text-zinc-500" />
                                    </div>
                                )}
                                <div className="flex-1 text-left">
                                    <p className="font-medium text-white">{collection.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {collection.itemCount} {collection.itemCount === 1 ? 'item' : 'items'}
                                    </p>
                                </div>
                                <ChevronRight className="w-4 h-4 text-zinc-500" />
                            </div>
                        </Button>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    )
}
