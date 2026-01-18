'use client'

import React from 'react'
import type { GlobalItem } from '../types'
import { getCategoryIcon, cleanTitle } from '../utils'
import { RatingBadges } from './RatingBadges'

interface ItemDetailHeaderProps {
    item: GlobalItem
}

// Static component for rendering category icon - avoids dynamic component creation during render
function CategoryIconDisplay({ categoryType }: { categoryType: string | null }) {
    const Icon = getCategoryIcon(categoryType)
    // eslint-disable-next-line react-hooks/static-components
    return Icon ? <Icon className="w-3.5 h-3.5 mb-0.5" /> : null
}

export function ItemDetailHeader({ item }: ItemDetailHeaderProps) {
    return (
        <div className="space-y-4">
            {/* Category • Year • Rating */}
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-zinc-500">
                <CategoryIconDisplay categoryType={item.category_type} />
                <span>{item.category_type?.replace('_', ' ')}</span>
                <span className="text-zinc-800">•</span>
                <span>{item.release_year}</span>
                {item.content_rating && (
                    <>
                        <span className="text-zinc-800">•</span>
                        <span className="px-1.5 py-0.5 rounded border border-zinc-700 bg-zinc-800/50 text-zinc-400">
                            {item.content_rating}
                        </span>
                    </>
                )}
            </div>

            {/* Title */}
            <div>
                <h2 className="text-4xl md:text-5xl font-black text-white leading-[0.95] tracking-tight drop-shadow-lg">
                    {cleanTitle(item.title)}
                </h2>
                {item.original_title && item.original_title !== item.title && (
                    <p className="text-zinc-500 text-lg mt-1 font-medium">{item.original_title}</p>
                )}
                {item.romaji_title && (
                    <p className="text-zinc-500 text-lg mt-1 font-medium italic">{item.romaji_title}</p>
                )}

                {/* Artist Name for Albums */}
                {item.artist_names && item.artist_names.length > 0 && (
                    <p className="text-2xl text-zinc-400 mt-2 flex items-center gap-2">
                        <span className="text-zinc-600">by</span>
                        <span className="text-emerald-400 font-semibold hover:text-emerald-300 transition-colors cursor-pointer">
                            {item.artist_names[0]}
                        </span>
                    </p>
                )}
            </div>

            {/* Tagline */}
            {item.tagline && (
                <p className="text-xl text-zinc-400 font-light italic border-l-2 border-zinc-700 pl-4 py-1">
                    &ldquo;{item.tagline}&rdquo;
                </p>
            )}

            {/* Rating Badges */}
            <RatingBadges item={item} />
        </div>
    )
}
