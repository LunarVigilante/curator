'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { RatingDisplay } from '@/components/rating/RatingDisplay'
import PageContainer from '@/components/PageContainer'
import EmptyState from '@/components/EmptyState'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Slider } from '@/components/ui/slider'
import { LayoutGrid, List, Search, ArrowUpDown, ChevronLeft, ChevronRight, Box, Eye, Settings2, Image as ImageIcon, Grid3X3, Rows } from 'lucide-react'
import ItemGrid from '@/components/items/ItemGrid'
import { useRouter, useSearchParams } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type Item = {
    id: string
    name: string
    description: string | null
    image: string | null
    categoryId: string | null
    category?: string
    tags: { id: string; name: string }[]
    ratings: { id: string; value: number; tier: string | null; type: string }[]
    createdAt: Date
}

export default function ItemsPageClient({
    items,
    initialQuery,
    totalPages,
    currentPage
}: {
    items: Item[]
    initialQuery?: string
    totalPages: number
    currentPage: number
}) {
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid')
    const router = useRouter()
    const searchParams = useSearchParams()
    const [query, setQuery] = useState(initialQuery || '')
    const [sortBy, setSortBy] = useState<'newest' | 'name' | 'rating'>('newest')

    // Smart Grid State
    const [cardMinWidth, setCardMinWidth] = useState(200) // 150-400px range
    const [targetRows, setTargetRows] = useState(4) // 3-12 range
    const [containerWidth, setContainerWidth] = useState(1200) // Default estimate
    const gridContainerRef = useRef<HTMLDivElement>(null)

    // Calculate columns and ideal limit
    const columns = Math.max(1, Math.floor(containerWidth / cardMinWidth))
    const idealLimit = columns * targetRows

    // Debounced resize handler
    useEffect(() => {
        if (!gridContainerRef.current) return

        let timeoutId: NodeJS.Timeout
        const observer = new ResizeObserver((entries) => {
            clearTimeout(timeoutId)
            timeoutId = setTimeout(() => {
                const width = entries[0]?.contentRect.width
                if (width && width !== containerWidth) {
                    setContainerWidth(width)
                }
            }, 300) // 300ms debounce
        })

        observer.observe(gridContainerRef.current)
        // Set initial width
        setContainerWidth(gridContainerRef.current.offsetWidth || 1200)

        return () => {
            clearTimeout(timeoutId)
            observer.disconnect()
        }
    }, [])

    // Refetch when idealLimit changes
    const currentLimit = Number(searchParams.get('limit')) || 20
    useEffect(() => {
        if (idealLimit !== currentLimit && idealLimit > 0) {
            const params = new URLSearchParams(searchParams.toString())
            params.set('limit', String(idealLimit))
            params.set('page', '1') // Reset to page 1 when limit changes
            router.push(`/items?${params.toString()}`)
        }
    }, [idealLimit])

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        router.push(`/items?q=${encodeURIComponent(query)}&page=1`)
    }

    const handlePageChange = (page: number) => {
        router.push(`/items?q=${encodeURIComponent(query)}&page=${page}`)
    }

    const sortedItems = useMemo(() => {
        return [...items].sort((a, b) => {
            if (sortBy === 'name') {
                return a.name.localeCompare(b.name)
            }
            if (sortBy === 'rating') {
                const getRatingValue = (item: Item) => {
                    const rating = item.ratings[0]
                    if (!rating) return -1
                    if (rating.type === 'TIER') {
                        const tiers = ['S', 'A', 'B', 'C', 'D', 'F']
                        return tiers.length - tiers.indexOf(rating.tier || 'F')
                    }
                    return rating.value
                }
                return getRatingValue(b) - getRatingValue(a)
            }
            // newest
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        })
    }, [items, sortBy])

    return (
        <PageContainer>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Items</h1>
                    <p className="text-muted-foreground">Manage and organize your ranked items.</p>
                </div>
                <Link href="/items/new">
                    <Button>Add New Item</Button>
                </Link>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
                <form onSubmit={handleSearch} className="flex w-full sm:max-w-sm gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            name="q"
                            placeholder="Search items..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                    <Button type="submit" variant="secondary">Search</Button>
                </form>

                <div className="flex items-center gap-2">
                    {viewMode === 'grid' && (
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" size="icon" className="shrink-0">
                                    <Eye className="h-4 w-4" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80" align="end">
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h4 className="font-medium leading-none">View Settings</h4>
                                        <Grid3X3 className="h-4 w-4 text-muted-foreground" />
                                    </div>

                                    {/* Card Size Slider */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                                            <span>Card Size</span>
                                            <span>{cardMinWidth}px min width</span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <ImageIcon className="h-4 w-4 text-muted-foreground" />
                                            <Slider
                                                value={[cardMinWidth]}
                                                min={150}
                                                max={400}
                                                step={25}
                                                onValueChange={([val]) => setCardMinWidth(val)}
                                                className="flex-1"
                                            />
                                            <ImageIcon className="h-5 w-5 text-foreground" />
                                        </div>
                                    </div>

                                    {/* Rows per Page Slider */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                                            <span>Rows per Page</span>
                                            <span>{targetRows} rows</span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <Rows className="h-4 w-4 text-muted-foreground" />
                                            <Slider
                                                value={[targetRows]}
                                                min={3}
                                                max={12}
                                                step={1}
                                                onValueChange={([val]) => setTargetRows(val)}
                                                className="flex-1"
                                            />
                                            <Rows className="h-5 w-5 text-foreground" />
                                        </div>
                                    </div>

                                    {/* Grid Info */}
                                    <div className="text-xs text-muted-foreground pt-2 border-t border-border">
                                        Showing {columns} cols × {targetRows} rows = {idealLimit} items
                                    </div>
                                </div>
                            </PopoverContent>
                        </Popover>
                    )}

                    <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                        <SelectTrigger className="w-[140px]">
                            <ArrowUpDown className="w-4 h-4 mr-2 text-muted-foreground" />
                            <SelectValue placeholder="Sort by" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="newest">Newest</SelectItem>
                            <SelectItem value="name">Name (A-Z)</SelectItem>
                            <SelectItem value="rating">Highest Rated</SelectItem>
                        </SelectContent>
                    </Select>

                    <div className="flex items-center border rounded-md bg-background">
                        <Button
                            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                            size="sm"
                            className="px-3 rounded-none rounded-l-md"
                            onClick={() => setViewMode('grid')}
                        >
                            <LayoutGrid className="h-4 w-4 mr-2" />
                            Grid
                        </Button>
                        <div className="w-[1px] h-4 bg-border" />
                        <Button
                            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                            size="sm"
                            className="px-3 rounded-none rounded-r-md"
                            onClick={() => setViewMode('list')}
                        >
                            <List className="h-4 w-4 mr-2" />
                            List
                        </Button>
                    </div>
                </div>
            </div>

            {sortedItems.length === 0 ? (
                <EmptyState
                    icon={Box}
                    title="No items found"
                    description={query ? "Try adjusting your search terms." : "Get started by adding your first item."}
                    action={query ? {
                        label: "Clear search",
                        onClick: () => {
                            setQuery('')
                            router.push('/items')
                        }
                    } : {
                        label: "Add New Item",
                        onClick: () => router.push('/items/new')
                    }}
                />
            ) : (
                <>
                    {viewMode === 'grid' ? (
                        <ItemGrid items={sortedItems} cardMinWidth={cardMinWidth} ref={gridContainerRef} />
                    ) : (
                        <div className="border rounded-md">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Category</TableHead>
                                        <TableHead>Rating</TableHead>
                                        <TableHead>Tags</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sortedItems.map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell className="font-medium">
                                                <Link href={`/items/${item.id}`} className="hover:underline flex items-center gap-2">
                                                    {item.name}
                                                </Link>
                                            </TableCell>
                                            <TableCell>{item.category || '-'}</TableCell>
                                            <TableCell>
                                                <RatingDisplay rating={item.ratings[0]} />
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex gap-1 flex-wrap">
                                                    {item.tags.map((tag) => (
                                                        <Badge key={tag.id} variant="outline" className="text-xs">{tag.name}</Badge>
                                                    ))}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Link href={`/items/${item.id}`}>
                                                    <Button variant="ghost" size="sm">View</Button>
                                                </Link>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 mt-8">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage <= 1}
                            >
                                <ChevronLeft className="h-4 w-4" />
                                Previous
                            </Button>
                            <div className="text-sm text-muted-foreground">
                                Page {currentPage} of {totalPages}
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={currentPage >= totalPages}
                            >
                                Next
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                </>
            )}
        </PageContainer>
    )
}
