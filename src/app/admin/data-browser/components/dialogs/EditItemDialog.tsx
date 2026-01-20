'use client'

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import {
    Loader2, Wand2, Crop, Trash2, Search, ImageIcon, Save, RefreshCw
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import TagSelector from '@/components/tags/TagSelector'
import ImageCropper from '@/components/ImageCropper'
import { CATEGORY_LABELS } from '@/lib/constants'
import { GlobalItem } from '@/app/admin/data-browser/types'
import { parseCachedTags } from '@/app/admin/data-browser/utils'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface EditItemDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    item: GlobalItem | null
    onSave: (items: Partial<GlobalItem>) => Promise<void>
    onDelete: (id: string) => void
    loading: boolean
}

export function EditItemDialog({
    open,
    onOpenChange,
    item,
    onSave,
    onDelete,
    loading
}: EditItemDialogProps) {
    // Local form state
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [image, setImage] = useState('')
    const [categoryType, setCategoryType] = useState<string | null>(null)
    const [tags, setTags] = useState<string[]>([])
    const [metadata, setMetadata] = useState('')

    // Helpers
    const [isGeneratingDescription, setIsGeneratingDescription] = useState(false)
    const [isGeneratingTags, setIsGeneratingTags] = useState(false)
    const [mediaResults, setMediaResults] = useState<any[]>([])
    const [imageToCrop, setImageToCrop] = useState<string | null>(null)
    const [imageUploadMode, setImageUploadMode] = useState<'url' | 'upload'>('url')

    const supabase = createClient()

    // Initialize from item
    useEffect(() => {
        if (item && open) {
            setTitle(item.title)
            setDescription(item.description || '')
            setImage(item.image_url || '')
            setCategoryType(item.category_type)
            setTags(parseCachedTags(item.cached_tags).map(t => t.id))
            setMetadata(item.metadata ? JSON.stringify(item.metadata) : '')
        }
    }, [item, open])

    // Reset loop
    useEffect(() => {
        if (!open) {
            setMediaResults([])
            setImageToCrop(null)
        }
    }, [open])

    const handleSave = async () => {
        if (!item) return

        // Resolve tags to objects for cache
        let resolvedTags: { id: string; name: string }[] = []
        if (tags.length > 0) {
            const { data } = await (supabase.from('tags') as any).select('id, name').in('id', tags)
            resolvedTags = data || []
        }

        await onSave({
            id: item.id,
            title,
            description,
            image_url: image,
            category_type: categoryType || '',
            metadata: metadata ? JSON.parse(metadata) : item.metadata,
            cached_tags: resolvedTags
        })
    }

    const doSearch = async () => {
        if (!title) return
        try {
            const { data } = await fetch(`/api/search/metadata?q=${encodeURIComponent(title)}&type=${categoryType || ''}`).then(r => r.json())
            setMediaResults(data || [])
        } catch (_e) {
            toast.error('Search failed')
        }
    }

    const handleMetadataMatch = (result: any) => {
        setTitle(result.title)
        setDescription(result.description || description)
        if (result.imageUrl) setImage(result.imageUrl)
        if (result.releaseDate) {
            // Try to extract year and put into metadata or release_year if exposed
        }
        setMediaResults([])
        toast.success(`Autofilled from ${result.source}`)
    }

    const handleAutoFill = async () => {
        if (!title) return
        setIsGeneratingDescription(true)
        try {
            const response = await fetch('/api/ai/regenerate-description', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemId: item?.id, title, type: categoryType, preview: true })
            })
            const data = await response.json()
            if (data.description) setDescription(data.description)
        } catch (_e) {
            toast.error('Failed to generate description')
        } finally {
            setIsGeneratingDescription(false)
        }
    }

    const handleAutoTag = async () => {
        if (!title) return
        setIsGeneratingTags(true)
        try {
            const { generateTagsAction } = await import('@/lib/actions/ai')
            const data = await generateTagsAction({
                title: title,
                type: categoryType || '',
                description: description || ''
            })

            if (data.tags && data.tags.length > 0) {
                const { createTagsBatch } = await import('@/lib/actions/tags')
                const validTags = await createTagsBatch(data.tags)
                setTags(prev => Array.from(new Set([...prev, ...validTags.map(t => t.id)])))
                toast.success(`Generated ${validTags.length} tags`)
            }
        } catch (_e) {
            toast.error('Failed to generate tags')
        } finally {
            setIsGeneratingTags(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-zinc-950 border-zinc-800 sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
                <DialogHeader className="pb-2">
                    <DialogTitle className="font-serif text-xl">Edit Item</DialogTitle>
                </DialogHeader>

                <div className="grid gap-6 py-4">
                    {/* Title Row */}
                    <div className="grid gap-2">
                        <div className="flex justify-between items-center">
                            <label className="text-sm font-medium text-zinc-300 uppercase tracking-wider">Name</label>
                        </div>
                        <div className="flex gap-2">
                            <Input
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="bg-zinc-900/50 border-zinc-800 font-medium"
                                placeholder="Item Title"
                            />
                            <Button
                                variant="secondary"
                                onClick={doSearch}
                                disabled={!title}
                                className="shrink-0 bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                            >
                                <Search className="w-4 h-4 mr-2" />
                                Search
                            </Button>
                        </div>

                        {/* Search Results */}
                        {mediaResults.length > 0 && (
                            <div className="mt-2 grid grid-cols-1 gap-1 bg-zinc-900 border border-zinc-800 rounded-md p-2 max-h-[200px] overflow-y-auto">
                                <div className="flex justify-between items-center px-1 pb-2">
                                    <span className="text-xs text-zinc-500">Select to auto-fill:</span>
                                    <Button variant="ghost" size="sm" className="h-5 text-[10px]" onClick={() => setMediaResults([])}>Clear</Button>
                                </div>
                                {mediaResults.map((result, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handleMetadataMatch(result)}
                                        className="flex items-start gap-3 p-2 hover:bg-zinc-800 rounded text-left transition-colors group"
                                    >
                                        <div className="w-8 h-12 bg-zinc-800 rounded overflow-hidden shrink-0 relative">
                                            {result.imageUrl ? <Image src={result.imageUrl} alt="" fill className="object-cover" /> : null}
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-zinc-300 group-hover:text-cyan-400">{result.title}</div>
                                            <div className="text-xs text-zinc-500 line-clamp-1">{result.description}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Category */}
                    <div className="grid gap-2">
                        <label className="text-sm font-medium text-zinc-300 uppercase tracking-wider">Category</label>
                        <Select value={categoryType || 'null'} onValueChange={(val) => setCategoryType(val === 'null' ? null : val)}>
                            <SelectTrigger className="bg-zinc-900/50 border-zinc-800">
                                <SelectValue placeholder="Select a category" />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-300">
                                <SelectItem value="null">Uncategorized</SelectItem>
                                {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                                    <SelectItem key={key} value={key}>{label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Description */}
                    <div className="grid gap-2">
                        <div className="flex justify-between items-center">
                            <label className="text-sm font-medium text-zinc-300 uppercase tracking-wider">Description</label>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-xs text-cyan-500 hover:text-cyan-400 hover:bg-cyan-950/30"
                                onClick={handleAutoFill}
                                disabled={isGeneratingDescription || !title}
                            >
                                {isGeneratingDescription ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Wand2 className="w-3 h-3 mr-1" />}
                                Auto-Fill
                            </Button>
                        </div>
                        <Textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={6}
                            className={`bg-zinc-900/50 border-zinc-800 text-sm leading-relaxed text-zinc-300 resize-none ${isGeneratingDescription ? 'animate-pulse' : ''}`}
                        />
                    </div>

                    {/* Bottom Row: Image & Tags */}
                    <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-6">
                        {/* Image Column */}
                        <div className="space-y-3">
                            <label className="text-sm font-medium text-zinc-300 uppercase tracking-wider block">Image</label>
                            <div className="aspect-[2/3] bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 relative group">
                                {image ? (
                                    <>
                                        <Image src={image} alt="Preview" fill className="object-cover" />
                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                                            <Button size="sm" variant="secondary" className="w-full h-7 text-xs" onClick={() => setImageToCrop(image)}>
                                                <Crop className="w-3 h-3 mr-1" /> Crop
                                            </Button>
                                            <Button size="sm" variant="destructive" className="w-full h-7 text-xs" onClick={() => setImage('')}>
                                                <Trash2 className="w-3 h-3 mr-1" /> Remove
                                            </Button>
                                        </div>
                                    </>
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 gap-2 p-4 text-center">
                                        <ImageIcon className="w-6 h-6" />
                                        <span className="text-[10px]">No Image</span>
                                    </div>
                                )}
                            </div>

                            {!image && (
                                <div className="grid grid-cols-2 gap-2">
                                    <Button variant={imageUploadMode === 'url' ? 'secondary' : 'outline'} size="sm" onClick={() => setImageUploadMode('url')} className="text-xs h-7">URL</Button>
                                    <Button variant={imageUploadMode === 'upload' ? 'secondary' : 'outline'} size="sm" onClick={() => setImageUploadMode('upload')} className="text-xs h-7">Up</Button>
                                </div>
                            )}

                            {image ? null : imageUploadMode === 'url' ? (
                                <Input value={image} onChange={e => setImage(e.target.value)} className="h-8 text-xs bg-zinc-900 border-zinc-800" placeholder="https://..." />
                            ) : (
                                <Input
                                    type="file"
                                    className="h-8 text-xs bg-zinc-900 border-zinc-800 file:text-zinc-400"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0]
                                        if (file) {
                                            const reader = new FileReader()
                                            reader.onload = () => setImageToCrop(reader.result as string)
                                            reader.readAsDataURL(file)
                                        }
                                    }}
                                />
                            )}
                        </div>

                        {/* Tags Column */}
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <label className="text-sm font-medium text-zinc-300 uppercase tracking-wider">Tags</label>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-xs text-purple-400 hover:text-purple-300 hover:bg-purple-950/30"
                                    onClick={handleAutoTag}
                                    disabled={isGeneratingTags || !title}
                                >
                                    {isGeneratingTags ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Wand2 className="w-3 h-3 mr-1" />}
                                    Auto-Tag
                                </Button>
                            </div>
                            <div className="min-h-[200px] bg-zinc-900/30 border border-zinc-800 rounded-lg p-2">
                                <TagSelector
                                    selectedTags={tags}
                                    onTagsChange={setTags}
                                    isLoading={isGeneratingTags}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className="border-t border-zinc-800/50 pt-4 flex justify-between sm:justify-between items-center">
                    <Button
                        variant="destructive"
                        onClick={() => {
                            if (item) onDelete(item.id)
                        }}
                        className="bg-red-950/50 text-white hover:bg-red-900/50 border border-red-900/50"
                    >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Item
                    </Button>
                    <div className="flex gap-2">
                        <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button onClick={handleSave} disabled={loading} className="bg-cyan-600 hover:bg-cyan-700 text-white">
                            {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            Save Changes
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>

            {/* Image Cropper Modal Layered */}
            {imageToCrop && (
                <ImageCropper
                    imageSrc={imageToCrop}
                    aspectRatio={2 / 3}
                    onCropComplete={async (croppedImage) => {
                        const response = await fetch(croppedImage)
                        const blob = await response.blob()
                        const fileFormData = new FormData()
                        fileFormData.append('file', blob, 'cropped.jpg')
                        const { uploadImage: uploadAction } = await import('@/lib/actions/upload')
                        const url = await uploadAction(fileFormData)
                        if (url) setImage(url)
                        setImageToCrop(null)
                    }}
                    onCancel={() => setImageToCrop(null)}
                />
            )}
        </Dialog>
    )
}
