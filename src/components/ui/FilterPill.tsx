'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'

interface FilterPillProps {
    label: string
    type: 'director' | 'cast' | 'studio' | 'genre' | 'tag' | 'developer' | 'platform' | 'designer' | 'mechanic' | 'artist' | 'content_rating' | 'year' | 'writer' | 'production' | 'language'
    category?: string
    className?: string
}

/**
 * A clickable pill that links to the data browser with that filter applied.
 * Example: Clicking "Nolan" with type="director" links to /admin/data-browser?director=Nolan
 */
export function FilterPill({ label, type, category, className }: FilterPillProps) {
    // Build the URL with the filter parameter
    const params = new URLSearchParams()
    params.set(type, label)
    if (category) {
        params.set('category', category)
    }

    return (
        <Link
            href={`/admin/data-browser?${params.toString()}`}
            className={cn(
                "inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full",
                "bg-zinc-800 text-zinc-300 border border-zinc-700",
                "hover:bg-blue-900/70 hover:text-blue-100 hover:border-blue-800",
                "transition-colors duration-150 cursor-pointer",
                className
            )}
        >
            {label}
        </Link>
    )
}

/**
 * A list of FilterPills with optional limit
 */
export function FilterPillList({
    items,
    type,
    category,
    limit = 5
}: {
    items: string[] | null
    type: FilterPillProps['type']
    category?: string
    limit?: number
}) {
    if (!items || items.length === 0) return null

    return (
        <div className="flex flex-wrap gap-1.5">
            {items.slice(0, limit).map((item, i) => (
                <FilterPill key={i} label={item} type={type} category={category} />
            ))}
            {items.length > limit && (
                <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full bg-zinc-900 text-zinc-500 border border-zinc-800">
                    +{items.length - limit} more
                </span>
            )}
        </div>
    )
}
