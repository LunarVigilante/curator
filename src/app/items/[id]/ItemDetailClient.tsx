'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import Link from 'next/link'
import { ArrowLeft, Trash2, Save, Upload, Wand2, Crop, Search, Loader2 } from 'lucide-react'
import { updateItem, deleteItem } from '@/lib/actions/items'
import { rateItem } from '@/lib/actions/ratings'
import TierSelector from '@/components/rating/TierSelector'
import ImageCropper from '@/components/ImageCropper'
import { Badge } from '@/components/ui/badge'
import TagSelector from '@/components/tags/TagSelector'
import { toast } from 'sonner'

type Item = {
    id: string
    name: string
    description: string | null
    image: string | null
    categoryId: string | null
    ratings: any[]
    category: any
    tags: { id: string; name: string }[]
    updatedAt: Date
}

export default function ItemDetailClient({ item }: { item: Item }) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [imageToCrop, setImageToCrop] = useState<string | null>(null)
    const [imageUploadMode, setImageUploadMode] = useState<'url' | 'upload'>('url')

    // Metadata search state
    const [metadataQuery, setMetadataQuery] = useState('')
    const [metadataResults, setMetadataResults] = useState<any[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [isGeneratingDescription, setIsGeneratingDescription] = useState(false)
    const [isGeneratingTags, setIsGeneratingTags] = useState(false)

    // Initial user rating for this item (if any)
    const initialRating = item.ratings[0]
    const [activeTier, setActiveTier] = useState<string>(initialRating?.tier || '')

    const [formData, setFormData] = useState({
        name: item.name,
        description: item.description || '',
        image: item.image || '',
        tags: item.tags.map(t => t.id)
    })

    // Metadata search function
    const handleMetadataSearch = async () => {
        if (!metadataQuery.trim()) return
        setIsSearching(true)
        try {
            const { searchMediaAction } = await import('@/lib/actions/media')
            const response = await searchMediaAction(
                metadataQuery,
                item.category?.name || 'general',
                null,
                item.categoryId || undefined
            )

            if (response.success) {
                setMetadataResults(response.data)
            } else {
                toast.error(response.error || 'Search failed')
            }
        } catch (error) {
            console.error('Metadata search failed:', error)
            toast.error('Search failed')
        } finally {
            setIsSearching(false)
        }
    }

    // Handle metadata match selection
    const handleMetadataMatch = async (result: any) => {
        const providerDescription = result.description || ''

        // 1. Immediate updates
        setFormData(prev => ({
            ...prev,
            name: result.title,
            image: result.imageUrl || prev.image,
            description: '✨ Generating AI curated description...',
            tags: []
        }))
        setMetadataResults([])
        setMetadataQuery('')

        // 2. Set loading states
        setIsGeneratingDescription(true)
        setIsGeneratingTags(true)

        // 3. Call separate AI endpoints in parallel
        const descriptionPromise = fetch('/api/ai/generate-description', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: result.title,
                type: item.category?.name || 'general',
                context: providerDescription
            })
        }).then(res => res.json())

        const tagsPromise = fetch('/api/ai/generate-tags', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: result.title,
                type: item.category?.name || 'general',
                description: providerDescription
            })
        }).then(res => res.json())

        // Handle description
        descriptionPromise
            .then(data => {
                if (data.error) throw new Error(data.error)
                setFormData(prev => ({ ...prev, description: data.description || '' }))
            })
            .catch(error => {
                console.error('Description generation failed:', error)
                toast.error('Description generation failed')
                setFormData(prev => ({ ...prev, description: providerDescription }))
            })
            .finally(() => setIsGeneratingDescription(false))

        // Handle tags
        tagsPromise
            .then(async data => {
                if (data.error) throw new Error(data.error)
                if (data.tags && data.tags.length > 0) {
                    const { createTag } = await import('@/lib/actions/tags')
                    const tagPromises = data.tags.map((tagName: string) =>
                        createTag(tagName).catch(() => null)
                    )
                    const createdTags = await Promise.all(tagPromises)
                    const validTags = createdTags.filter((t): t is { id: string, name: string } => t !== null)
                    setFormData(prev => ({ ...prev, tags: validTags.map(t => t.id) }))
                    toast.success(`Generated ${validTags.length} tags`)
                }
            })
            .catch(error => {
                console.error('Tag generation failed:', error)
                toast.error('Tag generation failed')
            })
            .finally(() => setIsGeneratingTags(false))
    }

    const handleSave = () => {
        startTransition(async () => {
            // Debug: Log what's being saved
            console.log('Saving item with data:', {
                name: formData.name,
                description: formData.description?.substring(0, 50) + '...',
                image: formData.image?.substring(0, 50) + '...',
                tags: formData.tags
            })

            const formDataObj = new FormData()
            formDataObj.append('name', formData.name)
            formDataObj.append('description', formData.description)
            formDataObj.append('image', formData.image)
            formDataObj.append('category', item.categoryId || '')
            formDataObj.append('tags', JSON.stringify(formData.tags))

            // 1. Update item details
            await updateItem(item.id, formDataObj)

            // 2. Submit rating if a tier is selected
            if (activeTier) {
                await rateItem(item.id, 0, 'TIER', activeTier)
            }

            toast.success('Item saved successfully')
            router.refresh()
        })
    }

    const handleDelete = async () => {
        if (confirm('Are you sure you want to delete this item? This action cannot be undone.')) {
            startTransition(async () => {
                await deleteItem(item.id)
                router.push('/items')
            })
        }
    }

    const handleAutoFill = async () => {
        const { generateDescription } = await import('@/lib/actions/ai')
        const description = await generateDescription(formData.name, item.category?.name || '')
        if (description) {
            setFormData(prev => ({ ...prev, description }))
        }
    }

    const handleAutoTag = async () => {
        const { generateTags } = await import('@/lib/actions/ai')
        const tags = await generateTags(formData.name, formData.description, item.category?.name || '')
        if (tags.length > 0) {
            const newTagIds = tags.map(t => t.id)
            const uniqueTags = Array.from(new Set([...formData.tags, ...newTagIds]))
            setFormData(prev => ({ ...prev, tags: uniqueTags }))
        }
    }

    return (
        <div className="container mx-auto py-10 max-w-5xl">
            {/* Header / Toolbar */}
            <div className="mb-8 flex justify-between items-center">
                <Link href="/items">
                    <Button variant="ghost" className="gap-2 text-muted-foreground hover:text-white transition-colors">
                        <ArrowLeft className="h-4 w-4" />
                        Back to Items
                    </Button>
                </Link>

                <div className="flex gap-3">
                    <Button
                        size="lg"
                        className="gap-2 min-w-[140px]"
                        onClick={handleSave}
                        disabled={isPending}
                    >
                        {isPending ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/20 border-t-white" /> : <Save className="h-4 w-4" />}
                        {isPending ? 'Saving...' : 'Save Item'}
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Essential Details */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Sync with Metadata Source Card */}
                    <Card className="border-blue-500/20 bg-blue-500/5 backdrop-blur-sm">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Search className="h-4 w-4 text-blue-400" />
                                Sync with Metadata Source
                            </CardTitle>
                            <CardDescription>Match this item with TMDB, RAWG, or other databases to auto-fill details.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex gap-2">
                                <Input
                                    placeholder={`Search for "${formData.name}" or enter a different title...`}
                                    value={metadataQuery}
                                    onChange={e => setMetadataQuery(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleMetadataSearch()}
                                    className="bg-white/[0.03] border-white/10"
                                />
                                <Button
                                    variant="secondary"
                                    onClick={handleMetadataSearch}
                                    disabled={isSearching || !metadataQuery.trim()}
                                    className="shrink-0"
                                >
                                    {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                    Search
                                </Button>
                            </div>

                            {/* Search Results */}
                            {metadataResults.length > 0 && (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto p-1">
                                    {metadataResults.map((result, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => handleMetadataMatch(result)}
                                            disabled={isGeneratingDescription || isGeneratingTags}
                                            className="group relative aspect-[2/3] rounded-lg overflow-hidden border border-white/10 hover:border-blue-500/50 transition-all bg-zinc-900"
                                        >
                                            {result.imageUrl ? (
                                                <img src={result.imageUrl} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">No Image</div>
                                            )}
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                                                <span className="text-xs font-medium text-white line-clamp-2">{result.title}</span>
                                                {result.year && <span className="text-[10px] text-zinc-400">{result.year}</span>}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Loading States */}
                            {(isGeneratingDescription || isGeneratingTags) && (
                                <div className="flex items-center gap-2 text-sm text-blue-400 py-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span>
                                        {isGeneratingDescription && isGeneratingTags
                                            ? 'Generating description and tags...'
                                            : isGeneratingDescription
                                                ? 'Generating description...'
                                                : 'Generating tags...'}
                                    </span>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="border-white/[0.08] bg-black/40 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle className="text-2xl font-serif">Essential Details</CardTitle>
                            <CardDescription>Update the core identity of this item.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Name & Category Row */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Item Name</Label>
                                    <Input
                                        id="name"
                                        value={formData.name}
                                        onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                        className="bg-white/[0.03] border-white/10 focus:border-blue-500/50 transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Category</Label>
                                    <div className="flex h-10 items-center px-3 rounded-md bg-white/[0.03] border border-white/10 text-muted-foreground cursor-not-allowed select-none">
                                        {item.category?.name || 'Uncategorized'}
                                    </div>
                                    <p className="text-[10px] text-muted-foreground/40 font-mono truncate px-1">
                                        ID: {item.id}
                                    </p>
                                </div>
                            </div>

                            {/* Description */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <Label htmlFor="description">Description</Label>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs gap-1.5 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                                        onClick={handleAutoFill}
                                        disabled={isPending || !formData.name}
                                    >
                                        <Wand2 className="h-3 w-3" />
                                        Auto-Fill
                                    </Button>
                                </div>
                                <Textarea
                                    id="description"
                                    rows={4}
                                    value={formData.description}
                                    onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                    className="bg-white/[0.03] border-white/10 focus:border-blue-500/50 transition-all resize-none"
                                />
                            </div>

                            {/* Image Section */}
                            <div className="space-y-4 pt-2">
                                <Label>Media Representation</Label>
                                <div className="flex flex-col md:flex-row gap-6">
                                    {/* Preview Box */}
                                    <div className="relative group w-full md:w-48 aspect-[2/3] rounded-xl overflow-hidden border border-white/10 bg-white/[0.03] flex items-center justify-center shrink-0">
                                        {formData.image ? (
                                            <>
                                                <img
                                                    src={formData.image}
                                                    alt="Item preview"
                                                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                                />
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="secondary"
                                                        className="h-8 w-8 p-0 rounded-full"
                                                        onClick={() => setImageToCrop(formData.image)}
                                                    >
                                                        <Crop className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="text-muted-foreground/20 italic text-xs">No image</div>
                                        )}
                                    </div>

                                    {/* Inputs Column */}
                                    <div className="flex-1 space-y-4">
                                        <div className="flex gap-2">
                                            <Button
                                                variant={imageUploadMode === 'url' ? 'secondary' : 'ghost'}
                                                size="sm"
                                                onClick={() => setImageUploadMode('url')}
                                                className="h-8 px-4"
                                            >
                                                URL
                                            </Button>
                                            <Button
                                                variant={imageUploadMode === 'upload' ? 'secondary' : 'ghost'}
                                                size="sm"
                                                onClick={() => setImageUploadMode('upload')}
                                                className="h-8 px-4"
                                            >
                                                Upload
                                            </Button>
                                        </div>

                                        {imageUploadMode === 'url' ? (
                                            <Input
                                                placeholder="https://..."
                                                value={formData.image}
                                                onChange={e => setFormData(prev => ({ ...prev, image: e.target.value }))}
                                                className="bg-white/[0.03] border-white/10"
                                            />
                                        ) : (
                                            <div className="relative">
                                                <Input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={async (e) => {
                                                        const file = e.target.files?.[0]
                                                        if (file) {
                                                            const reader = new FileReader()
                                                            reader.onload = () => setImageToCrop(reader.result as string)
                                                            reader.readAsDataURL(file)
                                                        }
                                                    }}
                                                    className="bg-white/[0.03] border-white/10 file:mr-4 file:py-1 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-white/10 file:text-white hover:file:bg-white/20"
                                                />
                                            </div>
                                        )}
                                        <p className="text-[10px] text-muted-foreground">
                                            Clear, high-quality images make for a better ranking experience.
                                        </p>
                                    </div>
                                </div>
                            </div>
                            {/* Tags Section */}
                            <div className="space-y-4 pt-2">
                                <div className="flex justify-between items-center">
                                    <Label>Tags</Label>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs gap-1.5 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                                        onClick={handleAutoTag}
                                        disabled={isPending || !formData.name}
                                    >
                                        <Wand2 className="h-3 w-3" />
                                        Auto-Tag
                                    </Button>
                                </div>
                                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10">
                                    <TagSelector
                                        selectedTags={formData.tags}
                                        onTagsChange={(tags) => setFormData(prev => ({ ...prev, tags }))}
                                    />
                                    <p className="mt-3 text-[10px] text-muted-foreground">
                                        Tags help you organize and discover items across different categories.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Safe Area / Danger Zone */}
                    <div className="flex justify-start">
                        <Button
                            variant="ghost"
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10 gap-2 border border-transparent hover:border-red-500/20 px-4"
                            onClick={handleDelete}
                            disabled={isPending}
                        >
                            <Trash2 className="h-4 w-4" />
                            Delete Item
                        </Button>
                    </div>
                </div>

                {/* Right Column: Scoring & Stats */}
                <div className="space-y-8">
                    <Card className="border-white/[0.08] bg-black/40 backdrop-blur-sm shadow-2xl">
                        <CardHeader>
                            <CardTitle className="text-2xl font-serif">Assessment</CardTitle>
                            <CardDescription>Assign a rank based on {item.category?.name || 'universal'} standards.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-8">
                            <TierSelector
                                customRanks={item.category?.customRanks}
                                activeTier={activeTier}
                                onTierChange={setActiveTier}
                            />

                            <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10">
                                <h4 className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-3">Ranking Insight</h4>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground">Historical Rank</span>
                                        <Badge variant="outline" className="font-mono border-white/10">
                                            {initialRating?.tier || 'Unrated'}
                                        </Badge>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground">Last Updated</span>
                                        <span className="text-muted-foreground/60 text-xs">
                                            {new Date(item.updatedAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Cropper Modal */}
            {imageToCrop && (
                <ImageCropper
                    imageSrc={imageToCrop}
                    aspectRatio={2 / 3}
                    onCropComplete={async (croppedImage) => {
                        const response = await fetch(croppedImage)
                        const blob = await response.blob()
                        const fileFormData = new FormData()
                        fileFormData.append('file', blob, 'cropped.jpg')

                        const { uploadImage } = await import('@/lib/actions/upload')
                        const url = await uploadImage(fileFormData)
                        if (url) {
                            setFormData(prev => ({ ...prev, image: url }))
                        }
                        setImageToCrop(null)
                    }}
                    onCancel={() => setImageToCrop(null)}
                />
            )}
        </div>
    )
}
