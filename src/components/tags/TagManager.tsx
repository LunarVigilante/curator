'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createTag, deleteTag } from '@/lib/actions/tags'
import { Trash2, Tag as TagIcon } from 'lucide-react'
import EmptyState from '@/components/EmptyState'

type Tag = {
    id: string
    name: string
}

export default function TagManager({ initialTags }: { initialTags: Tag[] }) {
    const [tags, setTags] = useState(initialTags)
    const [newTag, setNewTag] = useState('')
    const [isPending, startTransition] = useTransition()

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newTag.trim()) return

        startTransition(async () => {
            try {
                await createTag(newTag)
                setNewTag('')
                // Optimistic update or wait for revalidation (we'll rely on revalidation for now, but could update local state)
            } catch (error) {
                console.error('Failed to create tag:', error)
                alert('Failed to create tag. It might already exist.')
            }
        })
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this tag?')) return

        startTransition(async () => {
            await deleteTag(id)
        })
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <form onSubmit={handleCreate} className="flex gap-4 flex-1 max-w-md">
                    <Input
                        placeholder="New tag name..."
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        disabled={isPending}
                    />
                    <Button type="submit" disabled={isPending || !newTag.trim()}>
                        <TagIcon className="mr-2 h-4 w-4" />
                        Add Tag
                    </Button>
                </form>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {initialTags.map((tag) => (
                    <div
                        key={tag.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card text-card-foreground shadow-sm"
                    >
                        <span className="font-medium truncate" title={tag.name}>
                            {tag.name}
                        </span>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDelete(tag.id)}
                            disabled={isPending}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                ))}
                {initialTags.length === 0 && (
                    <div className="col-span-full">
                        <EmptyState
                            icon={TagIcon}
                            title="No tags created yet"
                            description="Create your first tag above to start organizing your items."
                        />
                    </div>
                )}
            </div>
        </div>
    )
}
