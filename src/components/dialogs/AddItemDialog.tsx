'use client'

import { useState, useTransition } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createItem } from '@/lib/actions/items'
import { Plus, Search, X, Image as ImageIcon, Loader2 } from 'lucide-react'
import TagSelector from '@/components/tags/TagSelector'
import ImageCropper from '@/components/ImageCropper'
import { toast } from 'sonner'
import { MediaResult } from '@/lib/services/media/types'

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
    const [imageToCrop, setImageToCrop] = useState<string | null>(null)
    const [mediaResults, setMediaResults] = useState<MediaResult[]>([])

    // Automation States
    const [isGeneratingDescription, setIsGeneratingDescription] = useState(false)
    const [isGeneratingTags, setIsGeneratingTags] = useState(false)

    const initialFormData = {
        name: '',
        description: '',
        image: '',
        imageUploadMode: 'url' as 'url' | 'upload',
        tags: [] as string[],
        metadata: '' as string
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
            formDataObj.append('metadata', formData.metadata)

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
                        <DialogTitle className="font-serif text-2xl">Add New {categoryName} Item</DialogTitle>
                        <DialogDescription className="font-sans">
                            Create a new item in this category.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name" className="font-sans">Name</Label>
                            <div className="flex gap-2">
                                <Input
                                    id="name"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                    placeholder="Item name"
                                    className="font-sans"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    title="Search & Auto-fill"
                                    disabled={!formData.name || isPending}
                                    onClick={async () => {
                                        if (!formData.name) return
                                        const { searchMediaAction } = await import('@/lib/actions/media')
                                        toast.promise(searchMediaAction(formData.name, categoryName), {
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
                                                    // 1. Immediate Updates (Optimistic)
                                                    const apiTags = result.tags || []

                                                    // Get existing tag IDs for these names (we need to create them if they don't exist)
                                                    // For immediate feedback, we'll try to resolve these in the background
                                                    // but set them as names for now if the TagSelector supports it, 
                                                    // or just wait for them to be created.
                                                    // Actually, let's just trigger the create actions in parallel.

                                                    setFormData(prev => ({
                                                        ...prev,
                                                        name: result.title,
                                                        image: result.imageUrl || prev.image,
                                                        imageUploadMode: result.imageUrl ? 'url' : prev.imageUploadMode,
                                                        description: '✨ Generating description...',
                                                        metadata: JSON.stringify({
                                                            externalId: result.id,
                                                            year: result.year,
                                                            type: result.type
                                                        })
                                                    }))
                                                    setMediaResults([])

                                                    // 2. Parallel Generation
                                                    setIsGeneratingDescription(true)
                                                    setIsGeneratingTags(true)

                                                    const { generateDescription, generateTags } = await import('@/lib/actions/ai')
                                                    const { createTag } = await import('@/lib/actions/tags')

                                                    // A. Resolve API Tags immediately (create them if needed)
                                                    const resolveApiTags = Promise.all(apiTags.map(tagName => createTag(tagName).catch(() => null)))
                                                        .then(tags => {
                                                            const validTags = tags.filter((t): t is { id: string, name: string } => t !== null)
                                                            setFormData(prev => {
                                                                const newTagIds = validTags.map(t => t.id)
                                                                const uniqueTags = Array.from(new Set([...prev.tags, ...newTagIds]))
                                                                return { ...prev, tags: uniqueTags }
                                                            })
                                                        })

                                                    // B. Parallel Description Generation
                                                    const descriptionPromise = generateDescription(result.title, categoryName)
                                                        .then(desc => {
                                                            setFormData(prev => ({ ...prev, description: desc || result.description || '' }))
                                                        })
                                                        .catch(() => {
                                                            setFormData(prev => ({ ...prev, description: result.description || '' }))
                                                        })
                                                        .finally(() => setIsGeneratingDescription(false))

                                                    // C. Parallel AI Tag Generation (Vibe Tags)
                                                    const tagsPromise = generateTags(result.title, result.description || '', categoryName)
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

                                                    // We don't necessarily need to await all of them before finishing the click handler
                                                    // as the state updates will happen as they resolve.
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
                            <Label htmlFor="description" className="font-sans">Description</Label>
                            <div className="flex gap-2">
                                <Textarea
                                    id="description"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    rows={5}
                                    placeholder="Item description"
                                    className={`flex-1 font-sans ${isGeneratingDescription ? 'animate-pulse text-muted-foreground' : ''}`}
                                    disabled={isGeneratingDescription}
                                />
                            </div>
                        </div>

                        {/* Split Layout: Image & Tags */}
                        <div className="grid grid-cols-2 gap-6">
                            {/* Left Column: Image */}
                            <div className="grid gap-2 content-start">
                                <Label className="font-sans">Image</Label>
                                <div className="flex gap-2 mb-1">
                                    <Button
                                        type="button"
                                        variant={formData.imageUploadMode === 'url' ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setFormData({ ...formData, imageUploadMode: 'url' })}
                                        className="flex-1"
                                    >
                                        URL
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={formData.imageUploadMode === 'upload' ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setFormData({ ...formData, imageUploadMode: 'upload' })}
                                        className="flex-1"
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
                                    <div className="mt-2 relative group w-full aspect-[2/3] rounded-lg overflow-hidden border border-zinc-800 bg-zinc-900/50">
                                        <img
                                            src={formData.image}
                                            alt="Preview"
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                                e.currentTarget.src = 'https://placehold.co/200x300?text=Invalid+Image'
                                            }}
                                        />
                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="secondary"
                                                className="h-8 text-xs"
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
                                                className="h-8 text-xs"
                                                onClick={() => setFormData({ ...formData, image: '' })}
                                            >
                                                Remove
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Right Column: Tags */}
                            <div className="grid gap-2 content-start">
                                <div className="flex items-center justify-between">
                                    <Label className="font-sans">Tags</Label>
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

                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isPending}>
                            {isPending ? 'Adding...' : 'Add Item'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
            {
                imageToCrop && (
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
                )
            }
        </Dialog >
    )
}
