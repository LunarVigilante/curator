'use client'

import { useState, useEffect } from 'react'
import { Check, Filter, SortAsc, SortDesc, Search, ChevronRight, ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useSearchParams, useRouter } from 'next/navigation'

interface FilterOption {
    value: string
    count: number
}

interface AdvancedFilterBarProps {
    categoryType?: string
    onSortChange: (sort: string, order: 'asc' | 'desc') => void
    currentSort: string
    currentOrder: 'asc' | 'desc'
}

type FilterField =
    | 'genre' | 'director' | 'writer' | 'studio' | 'cast'
    | 'year' | 'content_rating' | 'country'
    | 'developer' | 'publisher' | 'platform'
    | 'designer' | 'mechanic' | 'artist' | 'category'

const FILTER_FIELDS: { label: string; field: FilterField | 'language' | 'production'; icon?: any }[] = [
    { label: 'Genre', field: 'genre' },
    { label: 'Year', field: 'year' },
    { label: 'Content Rating', field: 'content_rating' },
    { label: 'Studio', field: 'studio' },
    { label: 'Director', field: 'director' },
    { label: 'Writer', field: 'writer' },
    { label: 'Cast', field: 'cast' },
    { label: 'Country', field: 'country' },
    { label: 'Language', field: 'language' },
    { label: 'Production', field: 'production' },
    // Game specific
    { label: 'Developer', field: 'developer' },
    { label: 'Publisher', field: 'publisher' },
    { label: 'Platform', field: 'platform' },
    // Board Game specific
    { label: 'Designer', field: 'designer' },
    { label: 'Mechanic', field: 'mechanic' },
    { label: 'Artist', field: 'artist' },
    { label: 'Category', field: 'category' },
]

const SORT_OPTIONS = [
    { label: 'Date Added', value: 'created_at' },
    { label: 'Title', value: 'title' },
    { label: 'Release Date', value: 'release_year' },
    { label: 'Critic Rating', value: 'metacritic' },
    { label: 'Audience Rating', value: 'vote_average' },
    { label: 'Runtime', value: 'runtime' },
    { label: 'Last Updated', value: 'last_metadata_update' },
    { label: 'Reference ID', value: 'id' },
    { label: 'Director', value: 'director' },
    { label: 'Studio', value: 'studio' },
    { label: 'Writer', value: 'writer' },
    { label: 'Content Rating', value: 'content_rating' },
    { label: 'Language', value: 'original_language' },
]

export function AdvancedFilterBar({ categoryType, onSortChange, currentSort, currentOrder }: AdvancedFilterBarProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const supabase = createClient()

    // State for Filter Popover
    const [openFilter, setOpenFilter] = useState(false)
    const [selectedField, setSelectedField] = useState<FilterField | 'language' | 'production' | null>(null)
    const [filterValues, setFilterValues] = useState<FilterOption[]>([])
    const [loadingValues, setLoadingValues] = useState(false)
    const [filterSearch, setFilterSearch] = useState('')

    // Helpers
    const getActiveFilterValue = (field: string) => searchParams.get(field)

    const handleApplyFilter = (field: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString())
        if (value) {
            params.set(field, value)
        } else {
            params.delete(field)
        }
        // Reset page on filter change
        params.delete('page')
        router.push(`/admin/data-browser?${params.toString()}`)
        setOpenFilter(false)
        setSelectedField(null)
    }

    // Fetch values when a field is selected
    useEffect(() => {
        if (!selectedField) return

        const fetchValues = async () => {
            setLoadingValues(true)
            try {
                // Map frontend field to DB column if needed (usually 1:1 map with RPC)
                let dbColumn = selectedField as string
                if (selectedField === 'genre') dbColumn = 'genres'
                if (selectedField === 'year') dbColumn = 'release_year'
                if (selectedField === 'country') dbColumn = 'origin_countries'
                if (selectedField === 'developer') dbColumn = 'developers'
                if (selectedField === 'publisher') dbColumn = 'publishers'
                if (selectedField === 'platform') dbColumn = 'platforms'
                if (selectedField === 'designer') dbColumn = 'designers'
                if (selectedField === 'mechanic') dbColumn = 'mechanics'
                if (selectedField === 'artist') dbColumn = 'artists'
                if (selectedField === 'category') dbColumn = 'categories' // board game categories
                if (selectedField === 'language') dbColumn = 'original_language'
                if (selectedField === 'production') dbColumn = 'production_companies'

                const { data, error } = await supabase.rpc('get_filter_values', {
                    p_column: dbColumn,
                    p_category: categoryType, // Filter by active category tab if any
                    p_search: filterSearch,
                    p_limit: 100
                } as any)

                if (error) {
                    console.error('Error fetching filter values:', error)
                    setFilterValues([])
                } else {
                    setFilterValues(data || [])
                }
            } catch (e) {
                console.error(e)
            } finally {
                setLoadingValues(false)
            }
        }

        const debounceTimer = setTimeout(fetchValues, 300)
        return () => clearTimeout(debounceTimer)
    }, [selectedField, filterSearch, categoryType, supabase])

    return (
        <div className="flex items-center gap-2 mb-4">
            {/* =======================
                SORT CONTROL
            ======================= */}
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 border-dashed border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800">
                        <ArrowUpDown className="mr-2 h-4 w-4" />
                        Sort
                        {currentSort && (
                            <>
                                <Separator orientation="vertical" className="mx-2 h-4" />
                                <Badge variant="secondary" className="rounded-sm px-1 font-normal bg-zinc-800 text-zinc-300">
                                    {SORT_OPTIONS.find(s => s.value === currentSort)?.label || currentSort}
                                </Badge>
                            </>
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0 bg-zinc-950 border-zinc-800" align="start">
                    <Command className="bg-transparent">
                        <CommandList>
                            <CommandGroup heading="Sort By">
                                {SORT_OPTIONS.map((option) => (
                                    <CommandItem
                                        key={option.value}
                                        onSelect={() => onSortChange(option.value, currentOrder)}
                                        className="text-zinc-300 aria-selected:bg-zinc-900 aria-selected:text-white cursor-pointer"
                                    >
                                        <div className={cn(
                                            "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-zinc-700",
                                            currentSort === option.value ? "bg-cyan-900 border-cyan-700 text-cyan-400" : "opacity-50 [&_svg]:invisible"
                                        )}>
                                            <Check className={cn("h-4 w-4")} />
                                        </div>
                                        {option.label}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                            <Separator className="bg-zinc-800" />
                            <CommandGroup heading="Direction">
                                <CommandItem
                                    onSelect={() => onSortChange(currentSort, 'asc')}
                                    className="text-zinc-300 aria-selected:bg-zinc-900 aria-selected:text-white cursor-pointer"
                                >
                                    <SortAsc className="mr-2 h-4 w-4" />
                                    Ascending
                                    {currentOrder === 'asc' && <Check className="ml-auto h-4 w-4" />}
                                </CommandItem>
                                <CommandItem
                                    onSelect={() => onSortChange(currentSort, 'desc')}
                                    className="text-zinc-300 aria-selected:bg-zinc-900 aria-selected:text-white cursor-pointer"
                                >
                                    <SortDesc className="mr-2 h-4 w-4" />
                                    Descending
                                    {currentOrder === 'desc' && <Check className="ml-auto h-4 w-4" />}
                                </CommandItem>
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>

            {/* =======================
                FILTER CONTROL
            ======================= */}
            <Popover open={openFilter} onOpenChange={(open) => {
                setOpenFilter(open)
                if (!open) {
                    setSelectedField(null)
                    setFilterSearch('')
                }
            }}>
                <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 border-dashed border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800">
                        <Filter className="mr-2 h-4 w-4" />
                        Filter
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[280px] p-0 bg-zinc-950 border-zinc-800" align="start">
                    {/* LEVEL 1: Select Field */}
                    {!selectedField && (
                        <Command className="bg-transparent">
                            <CommandInput placeholder="Filter by..." className="border-none focus:ring-0 text-zinc-300 placeholder:text-zinc-600" />
                            <CommandList>
                                <CommandEmpty>No filter found.</CommandEmpty>
                                <CommandGroup>
                                    <ScrollArea className="h-[300px]">
                                        {FILTER_FIELDS.map((f) => {
                                            const isActive = !!getActiveFilterValue(f.field)
                                            // Check if this filter is relevant to current category? 
                                            // For now show all, or maybe hide Game ones if not game?
                                            // Simple logic: Hide Game specific if category is Moive? 
                                            // Let's rely on user for now or use categoryType prop to filter list.

                                            return (
                                                <CommandItem
                                                    key={f.field}
                                                    onSelect={() => setSelectedField(f.field)}
                                                    className="justify-between text-zinc-300 aria-selected:bg-zinc-900 aria-selected:text-white cursor-pointer"
                                                >
                                                    <span className={isActive ? "text-cyan-400 font-medium" : ""}>
                                                        {f.label}
                                                    </span>
                                                    <ChevronRight className="h-4 w-4 opacity-50" />
                                                </CommandItem>
                                            )
                                        })}
                                    </ScrollArea>
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    )}

                    {/* LEVEL 2: Select Value */}
                    {selectedField && (
                        <div className="flex flex-col h-[350px]">
                            <div className="flex items-center gap-2 p-2 border-b border-zinc-800">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-zinc-400 hover:text-white"
                                    onClick={() => setSelectedField(null)}
                                >
                                    <ChevronRight className="h-4 w-4 rotate-180" />
                                </Button>
                                <span className="font-medium text-sm text-zinc-200">
                                    {FILTER_FIELDS.find(f => f.field === selectedField)?.label}
                                </span>
                            </div>

                            <div className="p-2 border-b border-zinc-800">
                                <div className="relative">
                                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                                    <input
                                        className="w-full bg-zinc-900 border border-zinc-700 rounded-md py-1.5 pl-8 pr-2 text-sm text-zinc-200 focus:outline-none focus:border-cyan-700"
                                        placeholder="Search..."
                                        value={filterSearch}
                                        onChange={(e) => setFilterSearch(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <ScrollArea className="flex-1">
                                <div className="p-1">
                                    {loadingValues ? (
                                        <div className="p-4 text-center text-xs text-zinc-500">Loading...</div>
                                    ) : filterValues.length === 0 ? (
                                        <div className="p-4 text-center text-xs text-zinc-500">No results found</div>
                                    ) : (
                                        filterValues.map((opt) => (
                                            <div
                                                key={opt.value}
                                                className="flex items-center justify-between p-2 rounded-sm hover:bg-zinc-900 cursor-pointer text-sm text-zinc-300 hover:text-white"
                                                onClick={() => handleApplyFilter(selectedField, opt.value)}
                                            >
                                                <span className="truncate mr-2">{opt.value}</span>
                                                <span className="text-xs text-zinc-600 font-mono">{opt.count}</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </ScrollArea>
                        </div>
                    )}
                </PopoverContent>
            </Popover>
        </div>
    )
}
