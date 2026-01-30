'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createItem } from '@/lib/actions/items'
import { Plus, X, Image as ImageIcon, Loader2, Search, Sparkles } from 'lucide-react'
import Image from 'next/image'
import TagSelector from '@/components/tags/TagSelector'
import ImageCropper from '@/components/ImageCropper'
import { toast } from 'sonner'
import { MediaResult } from '@/lib/services/media/types'
import { useDebounce } from '@/hooks/useDebounce'
import { SearchResultItem, SearchResultsContainer } from './add-item/SearchResultComponents'

export default function AddItemDialog({
    categoryId,
    categoryName,
    categoryMetadata,
    trigger
}: {
    categoryId: string
    categoryName: string
    categoryMetadata?: string | null
    trigger?: React.ReactNode
}) {
    const [open, setOpen] = useState(false)
    const [isPending, startTransition] = useTransition()
    const [imageToCrop, setImageToCrop] = useState<string | null>(null)
    const [mediaResults, setMediaResults] = useState<MediaResult[]>([])
    const [searchMode, setSearchMode] = useState<'title' | 'describe'>('title')
    const [isVectorSearching, setIsVectorSearching] = useState(false)
    const [vectorResults, setVectorResults] = useState<Array<{ id: string; title: string; posterUrl: string | null; similarity: number }>>([]);

    // Parse Metadata to get Type (handle both string and object)
    const categoryType = (() => {
        if (!categoryMetadata) return undefined
        if (typeof categoryMetadata === 'string') {
            try {
                return JSON.parse(categoryMetadata).type
            } catch {
                return undefined
            }
        }
        // If it's already an object
        return (categoryMetadata as any).type
    })()

    // Automation States
    const [isGeneratingDescription, setIsGeneratingDescription] = useState(false)
    const [isGeneratingTags, setIsGeneratingTags] = useState(false)

    // Image URL validation helper
    const isValidImageUrl = (url: string): boolean => {
        if (!url) return true // Empty is valid (optional field)
        // Accept http/https URLs
        if (url.startsWith('http://') || url.startsWith('https://')) return true
        // Accept local /uploads/ paths
        if (url.startsWith('/uploads/')) return true
        // Accept data URLs (for cropped images)
        if (url.startsWith('data:image/')) return true
        return false
    }

    const initialFormData = {
        name: '',
        description: '',
        image: '',
        imageUploadMode: 'url' as 'url' | 'upload',
        tags: [] as string[],
        metadata: '' as string
    }

    const [formData, setFormData] = useState(initialFormData)
    const [imageError, setImageError] = useState<string | null>(null)

    // Track if user has selected a result (to prevent re-search)
    const hasSelectedRef = useRef(false)
    // Skip auto-search after selecting a result
    const skipNextSearchRef = useRef(false)
    const debouncedName = useDebounce(formData.name, 500)

    // Manual search function
    const handleManualSearch = async () => {
        if (!formData.name || formData.name.length < 3) {
            toast.error('Enter at least 3 characters to search')
            return
        }
        hasSelectedRef.current = false // Allow new selection
        const { searchMediaAction } = await import('@/lib/actions/media')
        startTransition(async () => {
            const response = await searchMediaAction(formData.name, categoryName, categoryType || null, categoryId)
            if (response.success) {
                setMediaResults(response.data)
            } else {
                setMediaResults([])
            }
        })
    }

    // Vector search function (Describe It mode)
    const handleVectorSearch = async () => {
        if (!formData.name || formData.name.length < 5) {
            toast.error('Enter at least 5 characters to describe what you\'re looking for')
            return
        }
        setIsVectorSearching(true)
        setVectorResults([])
        try {
            const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/search-global-items`
            console.log('[VectorSearch] Calling:', url)
            console.log('[VectorSearch] Query:', formData.name, '| Category:', categoryType || 'all')

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}`,
                },
                body: JSON.stringify({
                    query: formData.name,
                    matchThreshold: 0.3,  // Lowered from 0.5 for better recall
                    matchCount: 10,
                    categoryFilter: categoryType ? categoryType.toUpperCase() : null  // Normalize to uppercase
                })
            })

            console.log('[VectorSearch] Response status:', response.status)

            if (!response.ok) {
                const errorText = await response.text()
                console.error('[VectorSearch] Error response:', errorText)
                throw new Error('Search failed')
            }

            const data = await response.json()
            console.log('[VectorSearch] Results:', data)

            setVectorResults(data.results || [])
            if (data.results?.length === 0) {
                toast.info('No matches found. Try switching to Title Search.')
            }
        } catch (error) {
            console.error('Vector search error:', error)
            toast.error('Smart search failed. Please try again.')
        } finally {
            setIsVectorSearching(false)
        }
    }

    // Auto-search when name changes (debounced) - only for title mode
    useEffect(() => {
        const search = async () => {
            // Skip auto-search in describe mode (vector search requires explicit button click)
            if (searchMode === 'describe') {
                return
            }
            // Skip search if we just selected a result OR if user has already selected
            if (skipNextSearchRef.current || hasSelectedRef.current) {
                skipNextSearchRef.current = false
                return
            }
            if (!debouncedName || debouncedName.length < 3) {
                setMediaResults([])
                return
            }

            const { searchMediaAction } = await import('@/lib/actions/media')

            startTransition(async () => {
                const response = await searchMediaAction(debouncedName, categoryName, categoryType || null, categoryId)
                if (response.success) {
                    setMediaResults(response.data)
                } else {
                    setMediaResults([])
                }
            })
        }
        search()
    }, [debouncedName, categoryName, categoryType, categoryId, searchMode])

    // Track which result is currently selected (for visual highlight)
    const [selectedResultId, setSelectedResultId] = useState<string | null>(null)

    // Function to select a result and fill the form
    const selectResult = async (result: MediaResult, keepResultsVisible: boolean = false) => {
        const providerDescription = result.description || ''

        // Mark selection
        hasSelectedRef.current = true
        skipNextSearchRef.current = true
        setSelectedResultId(result.id)

        // 1. Fill form immediately
        setFormData(prev => ({
            ...prev,
            name: result.title,
            image: result.imageUrl || prev.image,
            imageUploadMode: result.imageUrl ? 'url' : prev.imageUploadMode,
            description: '✨ Generating AI curated description...',
            tags: [],
            metadata: JSON.stringify({
                externalId: result.id,
                year: result.year,
                type: result.type
            })
        }))

        // Only clear results if not keeping them visible
        if (!keepResultsVisible) {
            setMediaResults([])
        }

        // 2. Download image locally (async)
        if (result.imageUrl && result.imageUrl.startsWith('http')) {
            const { downloadImageFromUrl } = await import('@/lib/actions/upload')
            downloadImageFromUrl(result.imageUrl)
                .then(localUrl => {
                    if (localUrl) {
                        setFormData(prev => ({ ...prev, image: localUrl }))
                    }
                })
                .catch(err => console.warn('Failed to download image:', err))
        }

        // 3. Generate description and tags
        setIsGeneratingDescription(true)
        setIsGeneratingTags(true)

        const { generateDescriptionAction, generateTagsAction } = await import('@/lib/actions/ai')
        const aiType = categoryName || categoryType || 'media'

        // Description
        generateDescriptionAction({ title: result.title, type: aiType, context: providerDescription })
            .then(data => {
                if (data.error) throw new Error(data.error)
                setFormData(prev => ({ ...prev, description: data.description || '' }))
            })
            .catch(error => {
                console.error('Description generation failed:', error)
                toast.error(error instanceof Error ? error.message : 'Description generation failed')
                setFormData(prev => ({ ...prev, description: providerDescription }))
            })
            .finally(() => setIsGeneratingDescription(false))

        // Tags: Use provider tags first (instant), only fall back to AI if none
        const applyProviderTags = async () => {
            if (result.tags && result.tags.length > 0) {
                // Provider already gave us tags - use batch create (fast path!)
                const { createTagsBatch } = await import('@/lib/actions/tags')
                const validTags = await createTagsBatch(result.tags.slice(0, 8))
                setFormData(prev => ({ ...prev, tags: validTags.map(t => t.id) }))
                toast.success(`Applied ${validTags.length} tags`)
                setIsGeneratingTags(false)
            } else {
                // No provider tags - fall back to AI generation (slow path)
                generateTagsAction({ title: result.title, type: aiType, description: providerDescription })
                    .then(async (data: any) => {
                        if (data.error) throw new Error(data.error)
                        if (data.tags) {
                            let rawTags: string[] = []
                            if (Array.isArray(data.tags)) {
                                rawTags = data.tags
                            } else if (typeof data.tags === 'string') {
                                rawTags = data.tags.split(',').map((t: string) => t.trim())
                            }
                            const cleanTags = rawTags.map(t => t.trim()).filter(t => t.length > 0)
                            const uniqueTags = [...new Set(cleanTags)]

                            if (uniqueTags.length > 0) {
                                const { createTag } = await import('@/lib/actions/tags')
                                const tagPromises = uniqueTags.map((tagName: string) => createTag(tagName).catch(() => null))
                                const createdTags: ({ id: string, name: string } | null)[] = await Promise.all(tagPromises)
                                const validTags = createdTags.filter((t): t is { id: string, name: string } => t !== null)
                                setFormData(prev => ({ ...prev, tags: validTags.map(t => t.id) }))
                                toast.success(`Generated ${validTags.length} tags`)
                            }
                        }
                    })
                    .catch(error => {
                        console.error('Tag generation failed:', error)
                        toast.error('Tag generation failed')
                    })
                    .finally(() => setIsGeneratingTags(false))
            }
        }
        applyProviderTags()
    }

    // Auto-select first result when search completes (only in title mode)
    useEffect(() => {
        // Skip auto-select in describe mode - user is typing a semantic query
        if (searchMode === 'describe') return

        if (mediaResults.length > 0 && !hasSelectedRef.current) {
            // Auto-select first result but keep results visible for alternative selection
            selectResult(mediaResults[0], true)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- selectResult changes too often, we only want to react to new results
    }, [mediaResults, searchMode])

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()

        // Validate image URL before submission
        if (formData.image && !isValidImageUrl(formData.image)) {
            setImageError('Must be a valid URL (http/https) or local path (/uploads/...)')
            toast.error('Invalid image URL')
            return
        }

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
            // Prevent search from triggering on form reset
            skipNextSearchRef.current = true
            hasSelectedRef.current = true
            setFormData(initialFormData) // Reset form
            setMediaResults([])
            setSelectedResultId(null)
            setImageError(null)
        })
    }

    return (
        <Dialog open={open} onOpenChange={(isOpen) => {
            setOpen(isOpen)
            if (isOpen) {
                // Reset selection state when dialog opens
                hasSelectedRef.current = false
                skipNextSearchRef.current = false
            }
        }}>
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
                            <Label htmlFor="name" className="font-sans">{searchMode === 'title' ? 'Name' : 'Describe what you\'re looking for'}</Label>

                            {/* Search Mode Toggle */}
                            <div className="flex gap-1 mb-2">
                                <Button
                                    type="button"
                                    variant={searchMode === 'title' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => { setSearchMode('title'); setVectorResults([]); }}
                                    className="flex-1 gap-1.5 text-xs"
                                >
                                    <Search className="h-3.5 w-3.5" />
                                    Title Search
                                </Button>
                                <Button
                                    type="button"
                                    variant={searchMode === 'describe' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => { setSearchMode('describe'); setMediaResults([]); }}
                                    className="flex-1 gap-1.5 text-xs"
                                >
                                    <Sparkles className="h-3.5 w-3.5" />
                                    Describe It
                                </Button>
                            </div>
                            <div className="flex gap-2">
                                <Input
                                    id="name"
                                    value={formData.name}
                                    onChange={(e) => {
                                        // If user is editing the name (not just selecting), reset selection state
                                        if (hasSelectedRef.current && e.target.value !== formData.name) {
                                            // Only reset if they're actually typing different text
                                            if (e.target.value.length < formData.name.length - 3) {
                                                hasSelectedRef.current = false
                                            }
                                        }
                                        setFormData({ ...formData, name: e.target.value })
                                    }}
                                    required
                                    placeholder="Type to search..."
                                    className="font-sans flex-1"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={searchMode === 'title' ? handleManualSearch : handleVectorSearch}
                                    disabled={(searchMode === 'title' ? isPending : isVectorSearching) || formData.name.length < (searchMode === 'title' ? 3 : 5)}
                                    className="shrink-0"
                                    title={searchMode === 'title' ? 'Search providers' : 'Smart search'}
                                >
                                    {(searchMode === 'title' ? isPending : isVectorSearching) ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : searchMode === 'title' ? (
                                        <Search className="h-4 w-4" />
                                    ) : (
                                        <Sparkles className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>
                            {/* Search Status */}
                            {isPending && searchMode === 'title' && formData.name.length >= 3 && (
                                <div className="text-xs text-muted-foreground animate-pulse">Searching...</div>
                            )}
                            {isVectorSearching && (
                                <div className="text-xs text-muted-foreground animate-pulse flex items-center gap-1.5">
                                    <Sparkles className="h-3 w-3" /> Finding AI matches...
                                </div>
                            )}

                            {/* Media Results Selection */}
                            {mediaResults.length > 0 && (
                                <SearchResultsContainer
                                    title="Select to Auto-fill:"
                                    variant="media"
                                    onClear={() => setMediaResults([])}
                                >
                                    {mediaResults.map((result, idx) => (
                                        <SearchResultItem
                                            key={idx}
                                            title={result.title}
                                            imageUrl={result.imageUrl}
                                            year={result.year}
                                            description={result.description}
                                            isSelected={selectedResultId === result.id}
                                            variant="media"
                                            onClick={() => selectResult(result, true)}
                                        />
                                    ))}
                                </SearchResultsContainer>
                            )}

                            {/* Vector Search Results (Describe It mode) */}
                            {vectorResults.length > 0 && (
                                <SearchResultsContainer
                                    title="AI Matches"
                                    variant="vector"
                                    onClear={() => setVectorResults([])}
                                >
                                    {vectorResults.map((result, idx) => (
                                        <SearchResultItem
                                            key={idx}
                                            title={result.title}
                                            imageUrl={result.posterUrl}
                                            similarity={result.similarity}
                                            variant="vector"
                                            onClick={() => {
                                                setFormData(prev => ({
                                                    ...prev,
                                                    name: result.title,
                                                    image: result.posterUrl || prev.image,
                                                }))
                                                setVectorResults([])
                                                toast.success(`Selected: ${result.title}`)
                                            }}
                                        />
                                    ))}
                                </SearchResultsContainer>
                            )}

                            {/* No Vector Results Message */}
                            {searchMode === 'describe' && vectorResults.length === 0 && !isVectorSearching && formData.name.length >= 5 && (
                                <p className="text-xs text-muted-foreground mt-1">
                                    No matches found in our database. Try switching to &apos;Title Search&apos; to find it from the global catalog.
                                </p>
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
                                    <div className="space-y-1">
                                        <Input
                                            key="url-input"
                                            id="image"
                                            type="text"
                                            placeholder="https://example.com/image.jpg or /uploads/..."
                                            value={formData.image}
                                            onChange={(e) => {
                                                const value = e.target.value
                                                setFormData({ ...formData, image: value })
                                                if (value && !isValidImageUrl(value)) {
                                                    setImageError('Must be a valid URL (http/https) or local path (/uploads/...)')
                                                } else {
                                                    setImageError(null)
                                                }
                                            }}
                                            className={imageError ? 'border-red-500/50' : ''}
                                        />
                                        {imageError && (
                                            <p className="text-[10px] text-red-500">{imageError}</p>
                                        )}
                                    </div>
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
                                                    setImageError(null)
                                                }
                                            }
                                        }}
                                    />
                                )}

                                {formData.image && (
                                    <div className="mt-2 relative group w-32 h-40 rounded-lg overflow-hidden border border-zinc-800 bg-zinc-900/50">
                                        <Image
                                            src={formData.image}
                                            alt="Preview"
                                            fill
                                            className="object-cover"
                                            unoptimized={formData.image.startsWith('https://placehold.co')}
                                            onError={() => setFormData({ ...formData, image: 'https://placehold.co/200x300?text=Invalid+Image' })}
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
                                        isLoading={isGeneratingTags}
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
