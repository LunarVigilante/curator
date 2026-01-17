'use client'

import React from 'react'
import { RefreshCw, ImageIcon } from 'lucide-react'
import { GlobalItem } from '../types'
// Import direct component, assuming DataBrowserItemCard is created
import { DataBrowserItemCard } from './DataBrowserItemCard'

interface DataBrowserGridProps {
    items: GlobalItem[]
    loading: boolean
    selectedIds: Set<string>
    tileSize: number
    // Actions are passed down
    onItemClick: (id: string, e: React.MouseEvent) => void
    onItemDoubleClick: (item: GlobalItem) => void
    onItemEdit: (item: GlobalItem) => void
    onItemRegenerate: (item: GlobalItem) => void
    onItemGenerateTags: (item: GlobalItem) => void
    onItemRefreshMetadata: (item: GlobalItem) => void
    onItemViewRaw: (item: GlobalItem) => void
    onItemFlag: (item: GlobalItem) => void
    onItemDelete: (id: string) => void
    onItemViewDetails: (item: GlobalItem) => void
    // Loading Sets
    regeneratingDescriptionIds: Set<string>
    refreshingMetadataIds: Set<string>
    regeneratingTagIds: Set<string>
}

export function DataBrowserGrid({
    items,
    loading,
    selectedIds,
    tileSize,
    onItemClick,
    onItemDoubleClick,
    onItemEdit,
    onItemRegenerate,
    onItemGenerateTags,
    onItemRefreshMetadata,
    onItemViewRaw,
    onItemFlag,
    onItemDelete,
    onItemViewDetails,
    regeneratingDescriptionIds,
    refreshingMetadataIds,
    regeneratingTagIds
}: DataBrowserGridProps) {

    // Helper to calculate grid columns class based on tile size
    const getGridCols = () => {
        if (tileSize <= 15) return 'grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12'
        if (tileSize <= 30) return 'grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10'
        if (tileSize <= 50) return 'grid-cols-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8'
        if (tileSize <= 70) return 'grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
        if (tileSize <= 85) return 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
        return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
    }

    if (loading && items.length === 0) {
        return (
            <div className="flex items-center justify-center w-full h-[60vh]">
                <div className="flex flex-col items-center gap-4">
                    <RefreshCw className="w-8 h-8 animate-spin text-cyan-500" />
                    <p className="text-zinc-500 text-sm font-medium">Loading items...</p>
                </div>
            </div>
        )
    }

    if (!loading && items.length === 0) {
        return (
            <div className="flex items-center justify-center w-full h-[60vh] border-2 border-dashed border-zinc-800 rounded-xl bg-zinc-900/20">
                <div className="flex flex-col items-center gap-4 text-zinc-500">
                    <ImageIcon className="w-12 h-12 opacity-50" />
                    <p className="font-medium">No items found</p>
                    <p className="text-xs max-w-xs text-center">Try adjusting your filters or search query.</p>
                </div>
            </div>
        )
    }

    return (
        <div className={`grid gap-4 ${getGridCols()} pb-20`}>
            {items.map(item => (
                <DataBrowserItemCard
                    key={item.id}
                    item={item}
                    isSelected={selectedIds.has(item.id)}
                    onClick={(e) => onItemClick(item.id, e)}
                    onDoubleClick={() => onItemDoubleClick(item)}
                    onEdit={() => onItemEdit(item)}
                    onRegenerate={() => onItemRegenerate(item)}
                    onGenerateTags={() => onItemGenerateTags(item)}
                    onRefreshMetadata={() => onItemRefreshMetadata(item)}
                    onViewRaw={() => onItemViewRaw(item)}
                    onFlag={() => onItemFlag(item)}
                    onDelete={() => onItemDelete(item.id)}
                    onViewDetails={() => onItemViewDetails(item)}
                    isRegenerating={regeneratingDescriptionIds.has(item.id)}
                    isRefreshing={refreshingMetadataIds.has(item.id)}
                    isTagging={regeneratingTagIds.has(item.id)}
                />
            ))}
        </div>
    )
}
