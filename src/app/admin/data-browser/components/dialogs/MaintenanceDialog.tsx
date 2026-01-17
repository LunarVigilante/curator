'use client'

import React from 'react'
import { Settings, Key, ShieldAlert, Trash2, RefreshCw } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface MaintenanceDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    steamGridKey: string
    setSteamGridKey: (key: string) => void
    onSaveConfig: () => void
    onDeleteSource: (source: string) => void
    loading: boolean
}

export function MaintenanceDialog({
    open,
    onOpenChange,
    steamGridKey,
    setSteamGridKey,
    onSaveConfig,
    onDeleteSource,
    loading
}: MaintenanceDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-zinc-950 border-zinc-800 sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-zinc-100 font-bold">
                        <Settings className="w-5 h-5 text-blue-500" />
                        System Configuration
                    </DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        Manage API keys and database maintenance.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* API Keys Section */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                            <Key className="w-4 h-4 text-yellow-500" />
                            API Keys
                        </h4>
                        <div className="space-y-2">
                            <label className="text-xs text-zinc-500">SteamGridDB API Key (Vertical Covers)</label>
                            <div className="flex gap-2">
                                <Input
                                    type="password"
                                    placeholder="Enter key..."
                                    value={steamGridKey}
                                    onChange={(e) => setSteamGridKey(e.target.value)}
                                    className="bg-zinc-900 border-zinc-800 text-zinc-200 text-sm"
                                />
                                <Button
                                    size="sm"
                                    className="bg-blue-600 hover:bg-blue-500"
                                    onClick={onSaveConfig}
                                    disabled={loading}
                                >
                                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Save'}
                                </Button>
                            </div>
                            <p className="text-[10px] text-zinc-600">
                                Required for high-quality game cover harvesting.
                            </p>
                        </div>
                    </div>

                    <div className="h-px bg-zinc-800 w-full" />

                    {/* Maintenance Section */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-medium text-red-400 flex items-center gap-2">
                            <ShieldAlert className="w-4 h-4" />
                            Danger Zone
                        </h4>

                        <div className="p-4 bg-red-950/10 border border-red-900/30 rounded-lg space-y-3">
                            <h5 className="text-xs font-medium text-red-300 flex items-center gap-2">
                                <Trash2 className="w-3 h-3" />
                                Bulk Delete by Source
                            </h5>
                            <div className="grid grid-cols-2 gap-2">
                                {['tmdb', 'tmdb_tv', 'anilist', 'bgg', 'rawg', 'google_books', 'spotify_artist', 'itunes_podcast'].map((key) => (
                                    <Button
                                        key={key}
                                        variant="outline"
                                        size="sm"
                                        className="justify-start border-zinc-800 hover:bg-red-950/30 hover:text-red-400 hover:border-red-900/50 transition-colors h-8 text-xs"
                                        onClick={() => onDeleteSource(key)}
                                    >
                                        {key.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
