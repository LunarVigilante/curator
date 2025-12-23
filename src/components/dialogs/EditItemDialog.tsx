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
import { Trash2, Search, X, Image as ImageIcon, Loader2 } from 'lucide-react'
import ImageCropper from '@/components/ImageCropper'
import { toast } from 'sonner'
import { MediaResult } from '@/lib/services/media/types'

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
    const [imageToCrop, setImageToCrop] = useState<string | null>(null)
    const [mediaResults, setMediaResults] = useState<MediaResult[]>([])

    // Automation States
    const [isGeneratingDescription, setIsGeneratingDescription] = useState(false)
    const [isGeneratingTags, setIsGeneratingTags] = useState(false)

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
                            <div className="flex gap-2">
                                <Input
                                    id="name"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    title="Search & Auto-fill"
                                    disabled={!formData.name || isPending}
                                    onClick={async () => {
                                        if (!formData.name) return
                                        const category = categories.find(c => c.id === formData.categoryId)
                                        const catName = category?.name || ''

                                        const { searchMediaAction } = await import('@/lib/actions/media')
                                        toast.promise(searchMediaAction(formData.name, catName), {
                                            loading: 'Searching...',
                                            success: (results) => {
                                                if (results && results.length > 0) {
                                                    setMediaResults(results)
                                                    return `Found ${results.length} results`
                                                }
                                                return 'No results found'
                                            },
                                            error: 'Search failed'
                                        })
                                    }}
                                >
                                    <Search className="h-4 w-4" />
                                </Button>
                            </div>

                            {/* Media Results Selection */}
                            {mediaResults.length > 0 && (
                                <div className="mt-2 grid grid-cols-1 gap-2 p-2 bg-zinc-900/50 rounded-lg border border-white/5">
                                    <div className="flex items-center justify-between px-2">
                                        <span className="text-xs font-medium text-muted-foreground">Select to Auto-fill:</span>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 text-[10px]"
                                            onClick={() => setMediaResults([])}
                                        >
                                            <X className="h-3 w-3 mr-1" /> Clear
                                        </Button>
                                    </div>
                                    <div className="max-h-[200px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                        {mediaResults.map((result, idx) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={async () => {
                                                    // 1. Immediate Updates
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        name: result.title,
                                                        image: result.imageUrl || prev.image,
                                                        imageUploadMode: result.imageUrl ? 'url' : prev.imageUploadMode,
                                                        description: '✨ Generating description...' // Loading state
                                                    }))
                                                    setMediaResults([]) // Clear after selection

                                                    const category = categories.find(c => c.id === formData.categoryId)
                                                    const catName = category?.name || ''

                                                    // 2. Async Description Generation
                                                    setIsGeneratingDescription(true)
                                                    const { generateDescription, generateTags } = await import('@/lib/actions/ai')

                                                    const descriptionPromise = generateDescription(result.title, catName)
                                                        .then(desc => {
                                                            if (desc) {
                                                                setFormData(prev => ({ ...prev, description: desc }))
                                                            } else {
                                                                setFormData(prev => ({ ...prev, description: result.description || '' }))
                                                            }
                                                        })
                                                        .catch(() => {
                                                            setFormData(prev => ({ ...prev, description: result.description || '' }))
                                                        })
                                                        .finally(() => setIsGeneratingDescription(false))

                                                    // 3. Async Tag Generation
                                                    setIsGeneratingTags(true)
                                                    const tagsPromise = generateTags(result.title, result.description || '', catName)
                                                        .then(tags => {
                                                            if (tags.length > 0) {
                                                                setFormData(prev => {
                                                                    const newTagIds = tags.map(t => t.id)
                                                                    const uniqueTags = Array.from(new Set([...prev.tags, ...newTagIds]))
                                                                    return { ...prev, tags: uniqueTags }
                                                                })
                                                            }
                                                        })
                                                        .finally(() => setIsGeneratingTags(false))

                                                    await Promise.all([descriptionPromise, tagsPromise])
                                                }}
                                                className="flex gap-3 w-full p-2 hover:bg-white/10 rounded overflow-hidden text-left transition-colors group"
                                            >
                                                {result.imageUrl ? (
                                                    <div className="w-10 h-14 shrink-0 rounded bg-zinc-800 overflow-hidden">
                                                        <img src={result.imageUrl} alt="" className="w-full h-full object-cover" />
                                                    </div>
                                                ) : (
                                                    <div className="w-10 h-14 shrink-0 rounded bg-zinc-800 flex items-center justify-center">
                                                        <ImageIcon className="w-4 h-4 text-zinc-600" />
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0 py-0.5">
                                                    <div className="flex items-baseline justify-between gap-2">
                                                        <span className="font-medium text-sm truncate text-zinc-200 group-hover:text-blue-400 transition-colors">{result.title}</span>
                                                        {result.year && <span className="text-[10px] text-zinc-500 font-mono">{result.year}</span>}
                                                    </div>
                                                    <p className="text-[10px] text-zinc-400 line-clamp-2 mt-0.5 leading-relaxed">{result.description}</p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                rows={5}
                                placeholder="Item description"
                                className={`flex-1 ${isGeneratingDescription ? 'animate-pulse text-muted-foreground' : ''}`}
                                disabled={isGeneratingDescription}
                            />
                        </div>

                        <div className={`${formData.image ? 'flex gap-6 items-start' : 'grid gap-4'}`}>
                            {/* Image Section */}
                            <div className="grid gap-2">
                                <Label>Image</Label>
                                {formData.image ? (
                                    <div className="relative group aspect-[2/3] w-32 rounded-xl overflow-hidden border border-white/10 bg-white/[0.03]">
                                        <img
                                            src={formData.image}
                                            alt="Preview"
                                            className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                            onError={(e) => {
                                                e.currentTarget.src = 'https://placehold.co/200x300?text=Invalid+Image'
                                            }}
                                        />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="secondary"
                                                className="w-full h-8 shadow-lg text-xs"
                                                onClick={async () => {
                                                    const response = await fetch(formData.image)
                                                    const blob = await response.blob()
                                                    const reader = new FileReader()
                                                    reader.onload = () => {
                                                        setImageToCrop(reader.result as string)
                                                    }
                                                    reader.readAsDataURL(blob)
                                                }}
                                            >
                                                Crop
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="destructive"
                                                className="w-full h-8 shadow-lg text-xs"
                                                onClick={() => setFormData({ ...formData, image: '' })}
                                            >
                                                Remove Image
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
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
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0]
                                                    if (file) {
                                                        const reader = new FileReader()
                                                        reader.onload = () => {
                                                            setImageToCrop(reader.result as string)
                                                        }
                                                        reader.readAsDataURL(file)
                                                    }
                                                }}
                                            />
                                        )}
                                    </>
                                )}
                            </div>

                            {/* Tags Section */}
                            <div className={`grid gap-2 ${formData.image ? 'flex-1 pt-0' : 'mb-6'}`}>
                                <div className="flex items-center justify-between">
                                    <Label>Tags</Label>
                                    {isGeneratingTags && (
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                            <span>Generating tags...</span>
                                        </div>
                                    )}
                                </div>
                                <div className="min-h-[120px] bg-zinc-900/30 rounded-lg border border-zinc-800/50 p-1">
                                    <TagSelector
                                        selectedTags={formData.tags}
                                        onTagsChange={(tags) => setFormData({ ...formData, tags })}
                                    />
                                </div>
                            </div>
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
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isPending}>
                                {isPending ? 'Saving...' : 'Save Changes'}
                            </Button>
                        </div>
                    </DialogFooter>
                </form>
            </DialogContent>

            {imageToCrop && (
                <ImageCropper
                    imageSrc={imageToCrop}
                    aspectRatio={2 / 3}
                    onCropComplete={async (croppedImage) => {
                        // Convert base64 to blob
                        const response = await fetch(croppedImage)
                        const blob = await response.blob()

                        // Upload the cropped image
                        const fileFormData = new FormData()
                        fileFormData.append('file', blob, 'cropped-image.jpg')
                        const { uploadImage } = await import('@/lib/actions/upload')
                        const url = await uploadImage(fileFormData)

                        if (url) {
                            setFormData({ ...formData, image: url })
                        }
                        setImageToCrop(null)
                    }}
                    onCancel={() => setImageToCrop(null)}
                />
            )}
        </Dialog>
    )
}
