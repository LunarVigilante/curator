'use client'

import { useState, useMemo } from 'react'
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
import { LayoutGrid, List, Search, ArrowUpDown } from 'lucide-react'
import ItemGrid from '@/components/items/ItemGrid'
import { useRouter } from 'next/navigation'
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

export default function ItemsPageClient({ items, initialQuery }: { items: Item[], initialQuery?: string }) {
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid')
    const router = useRouter()
    const [query, setQuery] = useState(initialQuery || '')
    const [sortBy, setSortBy] = useState<'newest' | 'name' | 'rating'>('newest')

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        router.push(`/items?q=${encodeURIComponent(query)}`)
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
        <div className="container mx-auto py-10">
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
                <div className="text-center py-20 border rounded-lg bg-muted/10">
                    <p className="text-muted-foreground">No items found.</p>
                    {query && (
                        <Button variant="link" onClick={() => {
                            setQuery('')
                            router.push('/items')
                        }}>
                            Clear search
                        </Button>
                    )}
                </div>
            ) : (
                viewMode === 'grid' ? (
                    <ItemGrid items={sortedItems} />
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
                                            {item.ratings[0] ? (
                                                <Badge variant={item.ratings[0].type === 'TIER' ? 'default' : 'secondary'}>
                                                    {item.ratings[0].type === 'TIER' ? `Tier ${item.ratings[0].tier}` : item.ratings[0].value}
                                                </Badge>
                                            ) : (
                                                <span className="text-muted-foreground text-xs">Unranked</span>
                                            )}
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
                )
            )}
        </div>
    )
}
