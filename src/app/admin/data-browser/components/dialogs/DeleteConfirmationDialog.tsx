'use client'

import React from 'react'
import { RefreshCw } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export type DeleteConfirmType = {
    type: 'single' | 'selected' | 'source'
    id?: string
    source?: string
} | null

interface DeleteConfirmationDialogProps {
    config: DeleteConfirmType
    onClose: () => void
    onConfirm: () => void
    loading: boolean
    confirmText: string
    setConfirmText: (text: string) => void
    count: number
}

export function DeleteConfirmationDialog({
    config,
    onClose,
    onConfirm,
    loading,
    confirmText,
    setConfirmText,
    count
}: DeleteConfirmationDialogProps) {
    if (!config) return null

    return (
        <Dialog open={!!config} onOpenChange={(open) => { if (!open && !loading) onClose() }}>
            <DialogContent className="bg-zinc-950 border-zinc-800">
                <DialogHeader>
                    <DialogTitle className="text-red-500">
                        {config.type === 'source' ? 'CRITICAL WARNING' : 'Confirm Deletion'}
                    </DialogTitle>
                    <DialogDescription className="text-zinc-300">
                        {config.type === 'selected'
                            ? `Are you sure you want to delete ${count} selected items?`
                            : config.type === 'single'
                                ? 'Are you sure you want to delete this item? This action cannot be undone.'
                                : <>
                                    You are about to delete <span className="font-bold text-white">ALL</span> items from <span className="font-bold text-white">{(config.source || '').replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>.
                                    <br /><br />
                                    This action cannot be undone. All associated data will be lost forever.
                                </>
                        }
                    </DialogDescription>
                </DialogHeader>

                {config.type === 'source' && (
                    <div className="py-2">
                        <label className="text-xs text-zinc-500 mb-1 block">Type <strong>DELETE</strong> to confirm:</label>
                        <Input
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            className="bg-red-950/20 border-red-900/50 text-red-200 placeholder:text-red-900/50 font-mono"
                            placeholder="DELETE"
                        />
                    </div>
                )}

                <DialogFooter>
                    <Button variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
                    <Button
                        variant="destructive"
                        onClick={onConfirm}
                        disabled={loading || (config.type === 'source' && confirmText !== 'DELETE')}
                    >
                        {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Confirm Delete'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
