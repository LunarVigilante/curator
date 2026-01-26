'use client'

import { useEffect, Suspense, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

// Hooks
import { useDataBrowserState } from './hooks/useDataBrowserState'
import { useDataFetching } from './hooks/useDataFetching'
import { useItemActions } from './hooks/useItemActions'

// Components
import {
    DataBrowserHeader,
    DataBrowserSidebar,
    DataBrowserGrid,
    DataBrowserPagination,
    EditItemDialog,
    DeleteConfirmationDialog,
    MaintenanceDialog
} from './components'
import ItemDetailView from '@/components/item-details/ItemDetailView'
import ReportItemDialog from '@/components/dialogs/ReportItemDialog'

function DataBrowserContent() {
    // Core state management
    const state = useDataBrowserState()
    const { filters, ui, selection, modals } = state

    // Data fetching
    const data = useDataFetching(state)
    const { items, loading, stats, fetchItems, fetchStats, setItems } = data

    // Item actions (CRUD, AI generation, etc.)
    const actions = useItemActions(state, data)

    // Debounce search query
    useEffect(() => {
        const timer = setTimeout(() => {
            filters.setDebouncedSearchQuery(filters.searchQuery)
        }, 400)
        return () => clearTimeout(timer)
    }, [filters.searchQuery, filters.setDebouncedSearchQuery, filters])

    // Handle page input for pagination
    const handlePageInput = useCallback((e: React.FormEvent) => {
        e.preventDefault()
        const pageNum = typeof ui.inputPage === 'string' ? parseInt(ui.inputPage) : ui.inputPage
        if (pageNum >= 1 && pageNum <= ui.totalPages) {
            ui.setPage(pageNum)
        }
    }, [ui])

    return (
        <div className="min-h-screen text-white p-6 font-sans selection:bg-cyan-500/30">
            {/* Header with tile size control and stats */}
            <DataBrowserHeader
                stats={stats}
                tileSize={ui.tileSize}
                setTileSize={ui.setTileSize}
                activeFilters={filters.activeFilters}
                onRemoveFilter={filters.removeFilter}
                onClearFilters={filters.clearAllFilters}
                totalCount={ui.totalCount}
                itemsOnPage={items.length}
            />

            <div className="flex gap-6 items-start">
                {/* Sidebar Filters */}
                <DataBrowserSidebar
                    searchQuery={filters.searchQuery}
                    setSearchQuery={filters.setSearchQuery}
                    selectedCategories={filters.selectedCategories}
                    setSelectedCategories={filters.setSelectedCategories}
                    missingImage={filters.missingImage}
                    setMissingImage={filters.setMissingImage}
                    shortDesc={filters.shortDesc}
                    setShortDesc={filters.setShortDesc}
                    uncategorized={filters.uncategorized}
                    setUncategorized={filters.setUncategorized}
                    onOpenMaintenance={() => modals.setMaintenanceOpen(true)}
                />

                {/* Main Content */}
                <div className="flex-1 min-w-0">
                    <DataBrowserGrid
                        items={items}
                        loading={loading}
                        tileSize={ui.tileSize}
                        selectedIds={selection.selectedIds}
                        onItemClick={(id: string, e: React.MouseEvent) => selection.handleItemClick(id, items, e)}
                        onItemDoubleClick={(item) => modals.setViewItem(item)}
                        onItemEdit={(item) => modals.setEditItem(item)}
                        onItemRegenerate={actions.handleRegenerate}
                        onItemGenerateTags={actions.handleGenerateTagsForItem}
                        onItemRefreshMetadata={actions.handleRefreshMetadata}
                        onItemViewRaw={(item) => {
                            console.log('Raw data:', item)
                            toast.info('Raw data logged to console')
                        }}
                        onItemFlag={(item) => modals.setReportItem(item)}
                        onItemDelete={(id: string) => modals.setDeleteConfirm({ type: 'single', id })}
                        onItemViewDetails={(item) => modals.setViewItem(item)}
                        regeneratingDescriptionIds={actions.regeneratingDescriptionIds}
                        regeneratingTagIds={actions.regeneratingTagIds}
                        refreshingMetadataIds={actions.refreshingMetadataIds}
                    />

                    <DataBrowserPagination
                        page={ui.page}
                        totalPages={ui.totalPages}
                        setPage={ui.setPage}
                        inputPage={ui.inputPage}
                        setInputPage={ui.setInputPage}
                        handlePageInput={handlePageInput}
                    />
                </div>
            </div>

            {/* Dialogs */}
            <EditItemDialog
                open={!!modals.editItem}
                onOpenChange={(open) => !open && modals.setEditItem(null)}
                item={modals.editItem}
                onSave={async (updates) => {
                    if (modals.editItem) {
                        await actions.handleSaveEdit(modals.editItem, updates)
                        modals.setEditItem(null)
                        fetchItems()
                    }
                }}
                onDelete={(id: string) => modals.setDeleteConfirm({ type: 'single', id })}
                loading={actions.actionLoading}
            />

            <DeleteConfirmationDialog
                config={modals.deleteConfirm}
                onClose={() => {
                    modals.setDeleteConfirm(null)
                    modals.setConfirmText('')
                }}
                onConfirm={async () => {
                    if (modals.deleteConfirm) {
                        await actions.handleBulkDelete(modals.deleteConfirm, modals.confirmText)
                        modals.setDeleteConfirm(null)
                        modals.setConfirmText('')
                        fetchItems()
                        fetchStats()
                    }
                }}
                loading={actions.actionLoading}
                confirmText={modals.confirmText}
                setConfirmText={modals.setConfirmText}
                count={selection.selectedIds.size}
            />

            <MaintenanceDialog
                open={modals.maintenanceOpen}
                onOpenChange={modals.setMaintenanceOpen}
                steamGridKey={modals.steamGridKey}
                setSteamGridKey={modals.setSteamGridKey}
                onSaveConfig={actions.handleSaveConfig}
                onDeleteSource={(source: string) => {
                    modals.setDeleteConfirm({ type: 'source', source })
                    modals.setMaintenanceOpen(false)
                }}
                loading={actions.actionLoading}
            />

            {modals.reportItem && (
                <ReportItemDialog
                    globalItemId={modals.reportItem.id}
                    itemTitle={modals.reportItem.title}
                    open={!!modals.reportItem}
                    onOpenChange={(open) => !open && modals.setReportItem(null)}
                />
            )}

            <ItemDetailView
                item={modals.viewItem as any}
                isOpen={!!modals.viewItem}
                onClose={() => modals.setViewItem(null)}
                onItemChange={(updatedItem: any) => {
                    // Update the view modal state
                    modals.setViewItem(updatedItem)
                    // Also update the main items array so data persists when modal reopens
                    if (updatedItem) {
                        setItems(prev => prev.map(item =>
                            item.id === updatedItem.id ? { ...item, ...updatedItem } : item
                        ))
                    }
                }}
                onEdit={(item: any) => {
                    modals.setViewItem(null)
                    modals.setEditItem(item)
                }}
                onDelete={(id: string) => {
                    modals.setViewItem(null)
                    modals.setDeleteConfirm({ type: 'single', id })
                }}
            />
        </div>
    )
}

// Wrap in Suspense for useSearchParams
export default function DataBrowserPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
            </div>
        }>
            <DataBrowserContent />
        </Suspense>
    )
}
