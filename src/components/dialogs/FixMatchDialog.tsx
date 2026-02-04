'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Loader2, Search, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { useDebounce } from '@/hooks/useDebounce'
import { searchMediaAction } from '@/lib/actions/media'
import { fixItemMatch } from '@/lib/actions/fix-match'
import { MediaResult } from '@/lib/services/media/types'
import { SearchResultItem, SearchResultsContainer } from './add-item/SearchResultComponents'
import { GlobalItem } from '@/components/item-details/types'

interface FixMatchDialogProps {
    item: GlobalItem
    isOpen: boolean
    onClose: () => void
    onSuccess: (updatedItem: GlobalItem) => void
}

export default function FixMatchDialog({ item, isOpen, onClose, onSuccess }: FixMatchDialogProps) {
    const router = useRouter()
    const [query, setQuery] = useState('')
    const [isSearching, setIsSearching] = useState(false)
    const [isFixing, setIsFixing] = useState(false)
    const [results, setResults] = useState<MediaResult[]>([])
    const [selectedResult, setSelectedResult] = useState<MediaResult | null>(null)

    // Debounce the query value
    const debouncedQuery = useDebounce(query, 500)

    // Search when debounced query changes
    useEffect(() => {
        const performSearch = async () => {
            if (!debouncedQuery.trim() || debouncedQuery.trim().length < 2) {
                setResults([])
                return
            }

            setIsSearching(true)
            setSelectedResult(null)

            try {
                const typeArg = item.category_type
                const result = await searchMediaAction(debouncedQuery, null, typeArg)

                if (result.success && result.data) {
                    setResults(result.data)
                } else {
                    setResults([])
                    if (result.error) toast.error(result.error)
                }
            } catch (error) {
                console.error('Search failed:', error)
                toast.error('Search failed')
            } finally {
                setIsSearching(false)
            }
        }

        performSearch()
    }, [debouncedQuery, item.category_type])

    const handleFixMatch = async () => {
        if (!selectedResult) return

        setIsFixing(true)
        try {
            // Provider source is inferred from item type - for movies/tv it's always TMDB
            // Access provider from metadata if available, otherwise default based on type
            const providerSource = (selectedResult.metadata?.provider as string) || 'TMDB'
            const providerId = selectedResult.id

            if (!providerId) {
                toast.error('Selected result missing ID')
                return
            }

            const result = await fixItemMatch(item.id, providerId, providerSource)

            if (result.success) {
                toast.success('Match fixed! Metadata refreshed.')
                // Pass the actual updated item from server
                if (result.updatedItem) {
                    onSuccess(result.updatedItem as GlobalItem)
                } else {
                    onSuccess(item)
                }
                // Refresh the page data to update the data browser
                router.refresh()
                onClose()
            } else {
                toast.error(result.error || 'Failed to fix match')
            }
        } catch (error) {
            console.error('Fix match failed:', error)
            toast.error('Failed to fix match')
        } finally {
            setIsFixing(false)
        }
    }

    // Confirmation view when a result is selected
    if (selectedResult) {
        return (
            <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
                <DialogContent className="sm:max-w-md bg-zinc-950 border-zinc-800 text-zinc-100">
                    <DialogHeader>
                        <DialogTitle>Confirm New Match</DialogTitle>
                        <DialogDescription>
                            This will replace metadata for <span className="text-white font-medium">{item.title}</span> with:
                        </DialogDescription>
                    </DialogHeader>

                    <div className="my-4 p-4 border border-zinc-800 rounded-lg bg-zinc-900/50 flex gap-4">
                        {selectedResult.imageUrl ? (
                            <img
                                src={selectedResult.imageUrl}
                                alt={selectedResult.title}
                                className="w-16 h-24 object-cover rounded bg-zinc-800"
                            />
                        ) : (
                            <div className="w-16 h-24 bg-zinc-800 rounded flex items-center justify-center text-xs text-zinc-500">
                                No Img
                            </div>
                        )}
                        <div>
                            <h3 className="font-bold text-lg">{selectedResult.title}</h3>
                            <div className="text-sm text-zinc-400">
                                {selectedResult.year} • {selectedResult.type}
                            </div>
                            <p className="text-xs text-zinc-500 mt-2 line-clamp-2">
                                {selectedResult.description}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-md text-amber-500 text-sm mb-2">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>Existing metadata will be overwritten.</span>
                    </div>

                    <div className="flex justify-end gap-2 mt-2">
                        <Button
                            variant="ghost"
                            onClick={() => setSelectedResult(null)}
                            disabled={isFixing}
                        >
                            Back
                        </Button>
                        <Button
                            onClick={handleFixMatch}
                            disabled={isFixing}
                            className="bg-blue-600 hover:bg-blue-500"
                        >
                            {isFixing ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Fixing...
                                </>
                            ) : (
                                'Confirm Fix'
                            )}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        )
    }

    // Search view
    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-2xl bg-zinc-950 border-zinc-800 text-zinc-100 max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Fix Match</DialogTitle>
                    <DialogDescription>
                        Search for the correct item to replace metadata for {item.title}.
                    </DialogDescription>
                </DialogHeader>

                <div className="relative mt-2">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder={`Search ${item.category_type?.toLowerCase()}s...`}
                        className="pl-9 bg-zinc-900/50 border-zinc-800 focus:bg-zinc-900"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        autoFocus
                    />
                    {isSearching && (
                        <div className="absolute right-3 top-2.5">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto min-h-[300px] mt-2 -mx-6 px-6">
                    {results.length > 0 ? (
                        <SearchResultsContainer
                            title="Search Results"
                            onClear={() => {
                                setQuery('')
                                setResults([])
                            }}
                        >
                            {results.map((result) => (
                                <SearchResultItem
                                    key={result.id}
                                    title={result.title}
                                    imageUrl={result.imageUrl}
                                    year={result.year}
                                    description={result.description}
                                    onClick={() => setSelectedResult(result)}
                                />
                            ))}
                        </SearchResultsContainer>
                    ) : (
                        query.length >= 2 && !isSearching && (
                            <div className="text-center py-12 text-zinc-500">
                                No results found. Try a different search term.
                            </div>
                        )
                    )}

                    {!query && (
                        <div className="text-center py-12 text-zinc-600">
                            Search for the correct title to find matches.
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
