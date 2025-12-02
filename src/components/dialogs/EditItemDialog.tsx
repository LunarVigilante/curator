'use client'

import { useState, useTransition, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { updateItem, deleteItem } from '@/lib/actions/items'
import { getCategories } from '@/lib/actions/categories'
import TagSelector from '@/components/tags/TagSelector'
import { Trash2 } from 'lucide-react'

type Item = {
    id: string
    name: string
    description: string | null
    image: string | null
    categoryId: string | null
    metadata: string | null
    tags: { id: string; name: string }[]
}

type Category = {
    id: string
    name: string
    metadata: string | null
}

export default function EditItemDialog({
    item,
    open,
    onOpenChange,
    categoryId
}: {
    item: Item
    open: boolean
    onOpenChange: (open: boolean) => void
    categoryId: string
}) {
    const [isPending, startTransition] = useTransition()
    const [categories, setCategories] = useState<Category[]>([])

    const [formData, setFormData] = useState({
        name: item.name,
        description: item.description || '',
        image: item.image || '',
        imageUploadMode: 'url' as 'url' | 'upload',
        categoryId: item.categoryId || categoryId,
        tags: item.tags.map(t => t.id)
    })

    // Fetch all categories
    useEffect(() => {
        if (open) {
            getCategories().then(cats => {
                setCategories(cats.map(c => ({
                    id: c.id,
                    name: c.name,
                    metadata: c.metadata
                })))
            })
        }
    }, [open])

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        startTransition(async () => {
            const formDataObj = new FormData()
            formDataObj.append('name', formData.name)
            formDataObj.append('description', formData.description)
            formDataObj.append('image', formData.image)
            formDataObj.append('category', formData.categoryId)
            formDataObj.append('tags', JSON.stringify(formData.tags))

            await updateItem(item.id, formDataObj)
            onOpenChange(false)
        })
    }

    const handleDelete = async () => {
        if (confirm('Are you sure you want to delete this item? This action cannot be undone.')) {
            startTransition(async () => {
                await deleteItem(item.id)
                onOpenChange(false)
            })
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Edit Item</DialogTitle>
                        <DialogDescription>
                            Update item details and tags.
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
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="category">Category</Label>
                            <Select
                                value={formData.categoryId}
                                onValueChange={(value) => setFormData({ ...formData, categoryId: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a category" />
                                </SelectTrigger>
                                <SelectContent>
                                    {categories.map((category) => (
                                        <SelectItem key={category.id} value={category.id}>
                                            {category.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="description">Description</Label>
                            <div className="flex gap-2">
                                <Textarea
                                    id="description"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    rows={3}
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
                                        const category = categories.find(c => c.id === formData.categoryId)
                                        const catName = category?.name || ''
                                        const description = await generateDescription(formData.name, catName)
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
                                        const category = categories.find(c => c.id === formData.categoryId)
                                        const catName = category?.name || ''
                                        const tags = await generateTags(formData.name, formData.description, catName)
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

                    <DialogFooter className="flex justify-between sm:justify-between">
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={isPending}
                        >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Item
                        </Button>
                        <div className="flex gap-2">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isPending}>
                                {isPending ? 'Saving...' : 'Save Changes'}
                            </Button>
                        </div>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
