'use client';

import Image from 'next/image';
import { Image as ImageIcon, X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SearchResultItemProps {
    title: string;
    imageUrl?: string | null;
    year?: number | string | null;
    description?: string | null;
    similarity?: number;
    isSelected?: boolean;
    variant?: 'media' | 'vector';
    onClick: () => void;
}

/**
 * Reusable search result item with poster, title, year, and optional similarity score.
 */
export function SearchResultItem({
    title,
    imageUrl,
    year,
    description,
    similarity,
    isSelected = false,
    variant = 'media',
    onClick,
}: SearchResultItemProps) {
    const isVector = variant === 'vector';

    return (
        <button
            type="button"
            aria-label={`Select ${title}`}
            className={`flex items-start gap-3 p-2 rounded hover:bg-white/5 transition-colors text-left w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${isSelected ? 'bg-blue-500/10 ring-1 ring-blue-500/50' : ''
                }`}
            onClick={onClick}
        >
            {/* Poster thumbnail */}
            {imageUrl ? (
                <div className="w-10 h-14 shrink-0 rounded bg-zinc-800 overflow-hidden relative">
                    <Image src={imageUrl} alt={title} fill className="object-cover" />
                </div>
            ) : (
                <div className="w-10 h-14 shrink-0 rounded bg-zinc-800 flex items-center justify-center">
                    <ImageIcon className="w-4 h-4 text-zinc-600" />
                </div>
            )}

            {/* Content */}
            <div className="flex-1 min-w-0 py-0.5">
                <div className="flex items-baseline justify-between gap-2">
                    <span className={`font-medium text-sm truncate transition-colors ${isSelected ? 'text-blue-400' : 'text-zinc-200'
                        }`}>
                        {title}
                    </span>
                    {/* Right side: year or similarity */}
                    {isVector && similarity !== undefined ? (
                        <span className="text-[10px] text-purple-400 bg-purple-500/20 px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0">
                            <Sparkles className="h-2.5 w-2.5" />
                            {Math.round(similarity * 100)}%
                        </span>
                    ) : year ? (
                        <span className="text-[10px] text-zinc-500 font-mono">{year}</span>
                    ) : null}
                </div>
                {description && (
                    <p className="text-[10px] text-zinc-400 line-clamp-2 mt-0.5 leading-relaxed">
                        {description}
                    </p>
                )}
            </div>
        </button>
    );
}

interface SearchResultsContainerProps {
    title: string;
    variant?: 'media' | 'vector';
    onClear: () => void;
    children: React.ReactNode;
}

/**
 * Container for search results with header and scrollable content area.
 */
export function SearchResultsContainer({
    title,
    variant = 'media',
    onClear,
    children,
}: SearchResultsContainerProps) {
    const isVector = variant === 'vector';

    return (
        <div className={`mt-2 grid grid-cols-1 gap-2 p-2 rounded-lg border ${isVector
                ? 'bg-gradient-to-br from-purple-900/20 to-blue-900/20 border-purple-500/20'
                : 'bg-zinc-900/50 border-white/5'
            }`}>
            <div className="flex items-center justify-between px-2">
                <span className={`text-xs font-medium flex items-center gap-1.5 ${isVector ? 'text-purple-300' : 'text-muted-foreground'
                    }`}>
                    {isVector && <Sparkles className="h-3 w-3" />}
                    {title}
                </span>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px]"
                    onClick={onClear}
                    aria-label="Clear search results"
                >
                    <X className="h-3 w-3 mr-1" aria-hidden="true" /> Clear
                </Button>
            </div>
            <div className="max-h-[200px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {children}
            </div>
        </div>
    );
}
