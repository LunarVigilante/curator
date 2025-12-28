'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Loader2, MessageSquareQuote, Trash2 } from 'lucide-react'
import { upsertCuratorNote, deleteCuratorNote } from '@/lib/actions/notes'
import { toast } from 'sonner'
import type { CuratorNote } from '@/lib/actions/notes'

interface CuratorNoteEditorProps {
    itemId: string
    itemName: string
    existingNote?: CuratorNote | null
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

export function CuratorNoteEditor({
    itemId,
    itemName,
    existingNote,
    isOpen,
    onOpenChange,
    onSuccess
}: CuratorNoteEditorProps) {
    const [content, setContent] = useState(existingNote?.content || '')
    const [saving, setSaving] = useState(false)
    const [deleting, setDeleting] = useState(false)

    const handleSave = async () => {
        if (!content.trim()) {
            toast.error('Note cannot be empty')
            return
        }

        setSaving(true)
        try {
            const result = await upsertCuratorNote(itemId, content.trim())
            if (result.success) {
                toast.success(existingNote ? 'Note updated!' : 'Note added!')
                onOpenChange(false)
                onSuccess?.()
            } else {
                toast.error(result.error || 'Failed to save note')
            }
        } catch (error) {
            toast.error('Something went wrong')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async () => {
        if (!existingNote) return

        setDeleting(true)
        try {
            const result = await deleteCuratorNote(existingNote.id)
            if (result.success) {
                toast.success('Note deleted')
                onOpenChange(false)
                onSuccess?.()
            } else {
                toast.error(result.error || 'Failed to delete note')
            }
        } catch (error) {
            toast.error('Something went wrong')
        } finally {
            setDeleting(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="bg-zinc-900 border-white/10 max-w-lg">
                <DialogHeader>
                    <DialogTitle className="text-white flex items-center gap-2">
                        <MessageSquareQuote className="w-5 h-5 text-purple-400" />
                        {existingNote ? 'Edit Curator Note' : 'Add Curator Note'}
                    </DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        Add a personal note explaining your ranking of "{itemName}"
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <Textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="Share your thoughts on why this item is ranked where it is..."
                        rows={5}
                        className="bg-zinc-800 border-white/10 text-white resize-none"
                        maxLength={1000}
                    />
                    <div className="text-right text-xs text-zinc-500">{content.length}/1000</div>

                    <div className="flex gap-3">
                        {existingNote && (
                            <Button
                                variant="outline"
                                onClick={handleDelete}
                                disabled={deleting || saving}
                                className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                            >
                                {deleting ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <>
                                        <Trash2 className="w-4 h-4 mr-1" />
                                        Delete
                                    </>
                                )}
                            </Button>
                        )}
                        <div className="flex-1" />
                        <Button
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            className="border-white/10"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={saving || !content.trim()}
                            className="bg-gradient-to-r from-purple-600 to-blue-600"
                        >
                            {saving ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                'Save Note'
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
