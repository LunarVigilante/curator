'use client'

import { useState, useTransition } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createItem } from '@/lib/actions/items'
import { Plus } from 'lucide-react'
import TagSelector from '@/components/tags/TagSelector'

export default function AddItemDialog({
    categoryId,
    categoryName,
    trigger
}: {
    categoryId: string
    categoryName: string
    trigger?: React.ReactNode
}) {
    const [open, setOpen] = useState(false)
    const [isPending, startTransition] = useTransition()

    const initialFormData = {
        name: '',
        description: '',
        image: '',
        imageUploadMode: 'url' as 'url' | 'upload',
        tags: [] as string[]
    }

    const [formData, setFormData] = useState(initialFormData)

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        startTransition(async () => {
            const formDataObj = new FormData()
            formDataObj.append('name', formData.name)
            formDataObj.append('description', formData.description)
            formDataObj.append('image', formData.image)
            formDataObj.append('category', categoryId)
            formDataObj.append('tags', JSON.stringify(formData.tags))

            await createItem(formDataObj)
            setOpen(false)
            setFormData(initialFormData) // Reset form
        })
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger ? trigger : (
                    <Button className="gap-2">
                        <Plus className="h-4 w-4" />
                        Add Item
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Add New {categoryName} Item</DialogTitle>
                        <DialogDescription>
                            Create a new item in this category.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Name</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                                placeholder="Item name"
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="description">Description</Label>
                            <div className="flex gap-2">
                                <Textarea
                                    id="description"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    rows={3}
                                    placeholder="Item description"
                                    className="flex-1"
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-auto text-xs"
                                    disabled={!formData.name || isPending}
                                    onClick={async () => {
                                        const { generateDescription } = await import('@/lib/actions/ai')
                                        const description = await generateDescription(formData.name, categoryName)
                                        if (description) {
                                            setFormData(prev => ({ ...prev, description }))
                                        }
                                    }}
                                >
                                    ✨ Auto-Fill
                                </Button>
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label>Image</Label>
                            <div className="flex gap-2 mb-2">
                                <Button
                                    type="button"
                                    variant={formData.imageUploadMode === 'url' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setFormData({ ...formData, imageUploadMode: 'url' })}
                                >
                                    URL
                                </Button>
                                <Button
                                    type="button"
                                    variant={formData.imageUploadMode === 'upload' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setFormData({ ...formData, imageUploadMode: 'upload' })}
                                >
                                    Upload
                                </Button>
                            </div>

                            {formData.imageUploadMode === 'url' ? (
                                <Input
                                    key="url-input"
                                    id="image"
                                    type="url"
                                    placeholder="https://example.com/image.jpg"
                                    value={formData.image}
                                    onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                                />
                            ) : (
                                <Input
                                    key="file-input"
                                    id="imageFile"
                                    type="file"
                                    accept="image/*"
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0]
                                        if (file) {
                                            const fileFormData = new FormData()
                                            fileFormData.append('file', file)
                                            const { uploadImage } = await import('@/lib/actions/upload')
                                            const url = await uploadImage(fileFormData)
                                            if (url) {
                                                setFormData({ ...formData, image: url })
                                            }
                                        }
                                    }}
                                />
                            )}

                            {formData.image && (
                                <div className="mt-2">
                                    <img
                                        src={formData.image}
                                        alt="Preview"
                                        className="h-32 w-32 object-cover rounded-md"
                                        onError={(e) => {
                                            e.currentTarget.src = 'https://placehold.co/100x100?text=Invalid'
                                        }}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="grid gap-2">
                            <div className="flex items-center justify-between">
                                <Label>Tags</Label>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-xs"
                                    disabled={!formData.name || isPending}
                                    onClick={async () => {
                                        const { generateTags } = await import('@/lib/actions/ai')
                                        const tags = await generateTags(formData.name, formData.description, categoryName)
                                        if (tags.length > 0) {
                                            const newTagIds = tags.map(t => t.id)
                                            const uniqueTags = Array.from(new Set([...formData.tags, ...newTagIds]))
                                            setFormData(prev => ({ ...prev, tags: uniqueTags }))
                                        }
                                    }}
                                >
                                    ✨ Auto-Tag
                                </Button>
                            </div>
                            <TagSelector
                                selectedTags={formData.tags}
                                onTagsChange={(tags) => setFormData({ ...formData, tags })}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isPending}>
                            {isPending ? 'Adding...' : 'Add Item'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
