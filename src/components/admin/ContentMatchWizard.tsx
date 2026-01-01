'use client'

import { useState } from 'react'
import { Search, Check, Loader2, Image as ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { adminSearchMedia, updateGlobalItem } from '@/lib/actions/admin'
import Image from 'next/image'

interface BrokenItem {
    id: string
    title: string
    description: string | null
    image_url: string | null
    release_year: number | null
    usersAffected: number
}

export function ContentMatchWizard({ items }: { items: BrokenItem[] }) {
    const [selectedItem, setSelectedItem] = useState<BrokenItem | null>(null)
    const [searchOpen, setSearchOpen] = useState(false)

    if (items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-zinc-400">
                <Check className="w-12 h-12 mb-4 text-green-500" />
                <h3 className="text-xl font-bold text-white">All Clear!</h3>
                <p>No broken items found.</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map(item => (
                    <BrokenItemCard
                        key={item.id}
                        item={item}
                        onMatch={() => {
                            setSelectedItem(item)
                            setSearchOpen(true)
                        }}
                    />
                ))}
            </div>

            <MatchDialog
                open={searchOpen}
                onOpenChange={setSearchOpen}
                targetItem={selectedItem}
                onSuccess={() => {
                    setSearchOpen(false)
                    setSelectedItem(null)
                    // Optimistic update handled by page refresh via server action
                }}
            />
        </div>
    )
}

function BrokenItemCard({ item, onMatch }: { item: BrokenItem, onMatch: () => void }) {
    return (
        <div className="bg-zinc-900 border border-white/10 rounded-xl p-4 flex flex-col gap-4 group hover:border-white/20 transition-colors">
            <div className="flex gap-4 items-start">
                <div className="w-16 h-24 bg-zinc-800 rounded-md flex items-center justify-center flex-shrink-0">
                    {item.image_url ? (
                        <Image src={item.image_url} alt={item.title} width={64} height={96} className="w-full h-full object-cover rounded-md" />
                    ) : (
                        <ImageIcon className="w-6 h-6 text-zinc-600" />
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-zinc-200 truncate" title={item.title}>{item.title}</h4>
                    <p className="text-xs text-zinc-500 mt-1">
                        {item.release_year || 'Unknown Year'} • {item.usersAffected} users
                    </p>
                    <div className="flex gap-2 mt-2">
                        {!item.image_url && <span className="bg-red-500/20 text-red-400 text-[10px] px-2 py-0.5 rounded">Missing Image</span>}
                        {!item.description && <span className="bg-orange-500/20 text-orange-400 text-[10px] px-2 py-0.5 rounded">Missing Desc</span>}
                    </div>
                </div>
            </div>
            <Button size="sm" onClick={onMatch} className="w-full bg-white text-black hover:bg-zinc-200">
                <Search className="w-3 h-3 mr-2" />
                Find Match
            </Button>
        </div>
    )
}

function MatchDialog({
    open,
    onOpenChange,
    targetItem,
    onSuccess
}: {
    open: boolean
    onOpenChange: (o: boolean) => void
    targetItem: BrokenItem | null
    onSuccess: () => void
}) {
    const [query, setQuery] = useState('')
    const [type, setType] = useState('multi')
    const [results, setResults] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)

    // Early return if no target item
    if (!targetItem) return null

    // Reset query when opening with a new item
    // Note: This is a render-time side effect, consider useEffect if it causes issues

    const handleSearch = async () => {
        if (!query.trim()) return
        setLoading(true)
        try {
            const res = await adminSearchMedia(query, type)
            if (res.success) {
                setResults(res.data)
            } else {
                toast.error(res.error || 'Search failed')
            }
        } catch {
            toast.error('Search failed')
        } finally {
            setLoading(false)
        }
    }

    const handleSelect = async (result: any) => {
        if (!targetItem) return
        setSaving(true)
        try {
            // Parse metadata if available
            let metadata = {}
            if (result.metadata) {
                try {
                    metadata = typeof result.metadata === 'string'
                        ? JSON.parse(result.metadata)
                        : result.metadata
                } catch { }
            }

            await updateGlobalItem(targetItem.id, {
                title: result.title,
                description: result.description,
                image_url: result.imageUrl,
                external_id: result.id, // e.g. 'tmdb-movie-123'
                release_year: result.year,
                metadata: metadata
            })

            toast.success('Item matched & updated!')
            onSuccess()
        } catch (err) {
            console.error(err)
            toast.error('Failed to update item')
        } finally {
            setSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl bg-zinc-950 border-white/10 text-white">
                <DialogHeader>
                    <DialogTitle>Match Content: {targetItem?.title}</DialogTitle>
                </DialogHeader>

                <div className="flex gap-2 mb-4">
                    <Input
                        placeholder="Search..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSearch()}
                        className="bg-black border-white/10"
                    />
                    <Select value={type} onValueChange={setType}>
                        <SelectTrigger className="w-32 bg-black border-white/10">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="multi">All</SelectItem>
                            <SelectItem value="movie">Movies</SelectItem>
                            <SelectItem value="tv">TV</SelectItem>
                            <SelectItem value="anime">Anime</SelectItem>
                            <SelectItem value="game">Games</SelectItem>
                            <SelectItem value="book">Books</SelectItem>
                            <SelectItem value="audiobook">Audiobooks</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button onClick={handleSearch} disabled={loading}>
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    </Button>
                </div>

                <div className="h-[400px] overflow-y-auto space-y-2 pr-2">
                    {results.map((result) => (
                        <div
                            key={result.id}
                            className="flex gap-4 p-3 rounded-lg border border-white/5 hover:border-white/20 hover:bg-white/5 cursor-pointer transition-all"
                            onClick={() => handleSelect(result)}
                        >
                            <div className="w-12 h-16 bg-zinc-900 rounded shrink-0 overflow-hidden relative">
                                {result.imageUrl ? (
                                    <Image src={result.imageUrl} alt={result.title} fill className="object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-xs text-zinc-600">No Img</div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-sm text-zinc-200">{result.title}</h4>
                                <p className="text-xs text-zinc-500">{result.year} • {result.type}</p>
                                <p className="text-xs text-zinc-400 line-clamp-2 mt-1">{result.description}</p>
                            </div>
                            {saving && <Loader2 className="w-4 h-4 animate-spin self-center" />}
                        </div>
                    ))}
                    {!loading && results.length === 0 && (
                        <div className="text-center text-zinc-500 py-12">Search to find matches</div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
