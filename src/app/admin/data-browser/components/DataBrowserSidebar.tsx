'use client'

import React from 'react'
import { Search, ShieldAlert, ImageIcon, FileText, AlertTriangle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { CATEGORY_ICONS } from '../constants'

interface DataBrowserSidebarProps {
    searchQuery: string
    setSearchQuery: (val: string) => void
    selectedCategories: string[]
    setSelectedCategories: (val: string[]) => void
    missingImage: boolean
    setMissingImage: (val: boolean) => void
    shortDesc: boolean
    setShortDesc: (val: boolean) => void
    uncategorized: boolean
    setUncategorized: (val: boolean) => void
    onOpenMaintenance: () => void
}

export function DataBrowserSidebar({
    searchQuery,
    setSearchQuery,
    selectedCategories,
    setSelectedCategories,
    missingImage,
    setMissingImage,
    shortDesc,
    setShortDesc,
    uncategorized,
    setUncategorized,
    onOpenMaintenance
}: DataBrowserSidebarProps) {
    return (
        <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg p-4 backdrop-blur-md">
            <h3 className="font-semibold mb-4 text-zinc-300">Filters</h3>

            {/* Search */}
            <div className="mb-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <Input
                        placeholder="Search titles..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 bg-zinc-900/50 border-zinc-700 focus:border-cyan-600 focus:ring-cyan-600/20"
                    />
                </div>
            </div>

            {/* Category Filter */}
            <div className="mb-4">
                <h4 className="text-sm font-medium text-zinc-400 mb-2">Category</h4>
                <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-700">
                    {Object.entries(CATEGORY_ICONS).map(([key, { icon: Icon, color, label }]) => (
                        <label key={key} className="flex items-center gap-2 cursor-pointer hover:bg-zinc-800/50 p-1.5 rounded transition-colors select-none">
                            <Checkbox
                                checked={selectedCategories.includes(key)}
                                onCheckedChange={(checked) => {
                                    if (checked) setSelectedCategories([...selectedCategories, key])
                                    else setSelectedCategories(selectedCategories.filter(s => s !== key))
                                }}
                                className="data-[state=checked]:bg-cyan-600 data-[state=checked]:border-cyan-600 border-zinc-600 w-4 h-4"
                            />
                            <Icon className={`w-4 h-4 ${color}`} />
                            <span className="text-sm text-zinc-300">{label}</span>
                        </label>
                    ))}
                </div>
            </div>

            {/* Quality Filters */}
            <div className="mb-4">
                <h4 className="text-sm font-medium text-zinc-400 mb-2">Quality Issues</h4>
                <div className="space-y-1.5">
                    <label className="flex items-center gap-2 cursor-pointer hover:bg-zinc-800/50 p-1.5 rounded transition-colors select-none">
                        <Checkbox checked={missingImage} onCheckedChange={(c) => setMissingImage(!!c)} className="border-zinc-600 w-4 h-4" />
                        <ImageIcon className="w-4 h-4 text-yellow-500" />
                        <span className="text-sm text-zinc-300">Missing Image</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer hover:bg-zinc-800/50 p-1.5 rounded transition-colors select-none">
                        <Checkbox checked={shortDesc} onCheckedChange={(c) => setShortDesc(!!c)} className="border-zinc-600 w-4 h-4" />
                        <FileText className="w-4 h-4 text-orange-500" />
                        <span className="text-sm text-zinc-300">Short Description</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer hover:bg-zinc-800/50 p-1.5 rounded transition-colors select-none">
                        <Checkbox checked={uncategorized} onCheckedChange={(c) => setUncategorized(!!c)} className="border-zinc-600 w-4 h-4" />
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                        <span className="text-sm text-zinc-300">Uncategorized</span>
                    </label>
                </div>
            </div>

            {/* Maintenance Button */}
            <div className="pt-4 border-t border-zinc-800 mt-4">
                <Button
                    variant="outline"
                    className="w-full justify-start text-zinc-400 hover:text-white hover:bg-zinc-800 border-zinc-700"
                    onClick={onOpenMaintenance}
                >
                    <ShieldAlert className="w-4 h-4 mr-2" />
                    Database Maintenance
                </Button>
            </div>
        </div>
    )
}
