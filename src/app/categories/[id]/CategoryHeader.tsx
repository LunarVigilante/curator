'use client'

import { Button } from '@/components/ui/button'
import { Settings, Eye, EyeOff, Plus, Share2, ArrowLeft, Search, Image as ImageIcon } from 'lucide-react'
import Link from 'next/link'
import EditCategoryButton from './EditCategoryButton'
import AddItemDialog from '@/components/dialogs/AddItemDialog'
import { AnalyzeButton } from '@/components/analysis/AnalyzeButton'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Slider } from '@/components/ui/slider'

interface CategoryHeaderProps {
    category: any
    isOwner: boolean
    isEditMode: boolean
    onToggleEditMode: () => void
    onExportImage: () => void
    showUnranked: boolean
    onToggleUnranked: () => void
    tileSize: number
    onTileSizeChange: (size: number) => void
}

export default function CategoryHeader({
    category,
    isOwner,
    isEditMode,
    onToggleEditMode,
    onExportImage,
    showUnranked,
    onToggleUnranked,
    tileSize,
    onTileSizeChange
}: CategoryHeaderProps) {
    return (
        <div className="mb-6 space-y-4">
            <Link href="/">
                <Button variant="ghost" className="pl-0 hover:bg-transparent hover:text-primary group">
                    <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
                    Back to Categories
                </Button>
            </Link>

            <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                    <h1 className="text-4xl font-bold mb-4 flex items-center gap-2">
                        {category.name}
                        {isOwner && (
                            <div className="export-ignore">
                                <EditCategoryButton category={category} />
                            </div>
                        )}
                    </h1>

                    {/* Simplified Description Row */}
                    <div className="flex flex-row items-center max-w-4xl">
                        <p className="text-muted-foreground text-lg italic">
                            {category.description || "No description provided."}
                        </p>
                    </div>
                </div>

                {/* Header Actions */}
                <div className="flex items-center gap-2 export-ignore shrink-0 pt-1">
                    <AnalyzeButton categoryId={category.id} variant="ghost" />

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onExportImage}
                        className="transition-all"
                        title="Share Image"
                    >
                        <Share2 className="h-4 w-4" />
                    </Button>

                    {/* Tile Zoom Feature */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary" title="Adjust Tile Size">
                                <Search className="h-5 w-5" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80" align="end">
                            <div className="space-y-4">
                                <h4 className="font-medium leading-none">Tile Size adjustment</h4>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                                        <span>Current Size</span>
                                        <span>{tileSize}px</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <ImageIcon className="h-3 w-3 text-muted-foreground" />
                                        <Slider
                                            value={[tileSize]}
                                            min={80}
                                            max={200}
                                            step={10}
                                            onValueChange={([val]) => onTileSizeChange(val)}
                                            className="flex-1"
                                        />
                                        <ImageIcon className="h-5 w-5 text-foreground" />
                                    </div>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>

                    {/* Eye Icon (Visibility Toggle) */}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onToggleUnranked}
                        className="text-muted-foreground hover:text-primary"
                        title={showUnranked ? "Hide Unranked" : "Show Unranked"}
                    >
                        {showUnranked ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                    </Button>

                    {isOwner && (
                        <Button
                            variant={isEditMode ? "default" : "ghost"}
                            size="icon"
                            onClick={onToggleEditMode}
                            className="transition-all"
                            title="Edit Tiers"
                        >
                            <Settings className={`h-4 w-4 ${isEditMode ? 'animate-spin-slow' : ''}`} />
                        </Button>
                    )}

                    {isOwner && (
                        <AddItemDialog
                            categoryId={category.id}
                            categoryName={category.name}
                            trigger={
                                <Button className="bg-blue-600 hover:bg-blue-700 text-white transition-colors gap-2 border-none">
                                    <Plus className="h-4 w-4" />
                                    <span className="hidden sm:inline">Add Item</span>
                                </Button>
                            }
                        />
                    )}
                </div>
            </div>
        </div>
    )
}
