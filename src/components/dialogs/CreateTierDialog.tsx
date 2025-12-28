'use client'

import { useState, useTransition } from 'react'
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createCustomRank, updateCustomRank } from "@/lib/actions/customRanks"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { toast } from "sonner"

interface CreateTierDialogProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    categoryId: string
    onCreated?: (rank: any) => void
    existingRank?: {
        id: string
        name: string
        color: string | null
        sortOrder: number
        type?: 'RANKED' | 'UTILITY'
    }
}

const PRESET_COLORS = [
    '#ef4444', // red-500
    '#f97316', // orange-500
    '#eab308', // yellow-500
    '#22c55e', // green-500
    '#3b82f6', // blue-500 (Updated from purple)
    '#ec4899', // pink-500
    '#64748b', // slate-500
]

export function CreateTierDialog({ isOpen, onOpenChange, categoryId, onCreated, existingRank }: CreateTierDialogProps) {
    const [name, setName] = useState("")
    const [color, setColor] = useState("")
    const [type, setType] = useState<'RANKED' | 'UTILITY'>('RANKED')
    const [isPending, startTransition] = useTransition()

    useEffect(() => {
        if (isOpen) {
            // Only update if values are different to avoid redundant updates/loops
            const targetName = existingRank?.name || ""
            const targetColor = existingRank?.color || ""
            const targetType = existingRank?.type || 'RANKED'

            if (name !== targetName) setName(targetName)
            if (color !== targetColor) setColor(targetColor)
            if (type !== targetType) setType(targetType)
        }
        // ESLint warning is suppressed because we only want to sync on open/change of prop
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, existingRank])

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        startTransition(async () => {
            try {
                if (existingRank) {
                    await updateCustomRank(existingRank.id, {
                        name,
                        color: color || undefined,
                        type
                    })
                    toast.success("Tier updated")
                } else {
                    const newRank = await createCustomRank(categoryId, {
                        name,
                        color: color || undefined,
                        type
                    })
                    toast.success("Tier created")
                    onCreated?.(newRank)
                }
                onOpenChange(false)
            } catch (error) {
                toast.error("Failed to save tier")
            }
        })
    }

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{existingRank ? 'Edit Tier' : 'Create New Tier'}</DialogTitle>
                    <DialogDescription>
                        Add a custom tier to your ranking board.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="name">Tier Name</Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. God Tier, Trash, Watchlist"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Tier Type</Label>
                        <div className="flex gap-4">
                            <div
                                className={`flex items-center space-x-2 border rounded-md p-3 flex-1 cursor-pointer transition-colors ${type === 'RANKED' ? 'border-primary bg-primary/5' : 'hover:bg-accent/50'}`}
                                onClick={() => setType('RANKED')}
                            >
                                <div className={`w-4 h-4 rounded-full border border-primary ${type === 'RANKED' ? 'bg-primary' : 'bg-transparent'}`} />
                                <div className="grid gap-1.5 leading-none">
                                    <Label className="cursor-pointer font-semibold">Ranked</Label>
                                    <p className="text-xs text-muted-foreground">Standard tier (S, A, B). Affects scoring.</p>
                                </div>
                            </div>
                            <div
                                className={`flex items-center space-x-2 border rounded-md p-3 flex-1 cursor-pointer transition-colors ${type === 'UTILITY' ? 'border-primary bg-primary/5' : 'hover:bg-accent/50'}`}
                                onClick={() => setType('UTILITY')}
                            >
                                <div className={`w-4 h-4 rounded-full border border-primary ${type === 'UTILITY' ? 'bg-primary' : 'bg-transparent'}`} />
                                <div className="grid gap-1.5 leading-none">
                                    <Label className="cursor-pointer font-semibold">Utility</Label>
                                    <p className="text-xs text-muted-foreground">Status (Watchlist, Plan to Watch). Ignored by score.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Color (Optional)</Label>
                        <div className="flex flex-wrap gap-2 mb-2">
                            {PRESET_COLORS.map((c) => (
                                <button
                                    key={c}
                                    type="button"
                                    className={`w-8 h-8 rounded-full border-2 transition-all ${color === c ? 'border-primary ring-2 ring-primary/50 scale-110' : 'border-transparent hover:scale-110'
                                        }`}
                                    style={{ backgroundColor: c }}
                                    onClick={() => setColor(c)}
                                />
                            ))}
                        </div>
                        <div className="flex gap-2 items-center">
                            <div
                                className="w-10 h-10 rounded border"
                                style={{ backgroundColor: color || 'transparent' }}
                            />
                            <Input
                                value={color}
                                onChange={(e) => setColor(e.target.value)}
                                placeholder="#000000"
                                className="font-mono"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isPending}>
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {existingRank ? 'Save Changes' : 'Create Tier'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
