'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useTournamentMatchmaker } from '@/hooks/useTournamentMatchmaker'
import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, Check, SkipForward, Save, Settings, Info, Loader2 } from 'lucide-react'
import Image from 'next/image'
import { toast } from 'sonner'
import { updateItemScores, addChallengerItem, ignoreItem, submitMatchActivity } from '@/lib/actions/items'
import { fetchChallengers, ChallengerItem } from '@/lib/actions/discovery'

type TournamentItem = {
    id: string
    name: string
    image: string | null
    elo: number
    type: 'USER' | 'CHALLENGER'
    description?: string
}

export function TournamentModal({
    isOpen,
    onOpenChange,
    items,
    categoryId
}: {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    items: any[]
    categoryId: string
}) {
    const [challengers, setChallengers] = useState<ChallengerItem[]>([])
    const [isSaving, setIsSaving] = useState(false)
    const [settingsOpen, setSettingsOpen] = useState(false)

    // Settings State
    const [discoveryMode, setDiscoveryMode] = useState(true)
    const [matchLength, setMatchLength] = useState<number | 'endless'>(30)

    // Transform user items to Tournament format
    const tournamentItems: TournamentItem[] = items.map(i => ({
        id: i.id,
        name: i.name,
        image: i.image,
        elo: i.eloScore || 1200,
        type: 'USER'
    }))

    // Fetch challengers on mount
    useEffect(() => {
        if (isOpen && challengers.length === 0) {
            fetchChallengers(categoryId, items.map(i => i.name))
                .then(setChallengers)
                .catch(err => console.error(err))
        }
    }, [isOpen, categoryId, items, challengers.length])

    const { currentPair, vote, skip, ignore, eloScores, roundCount } = useTournamentMatchmaker(
        tournamentItems,
        challengers,
        { discoveryMode, matchLength }
    )

    const handleVote = async (winnerId: string) => {
        const result = vote(winnerId)
        if (!result) return
        const { winner, loser } = result

        // Logic: Auto-Add Challenger if they receive a vote (Winner is challenger)
        if (winner.type === 'CHALLENGER') {
            toast.info(`Adding "${winner.name}" to your collection...`)
            try {
                const challengerData: ChallengerItem = {
                    id: winner.id,
                    name: winner.name,
                    image: winner.image || '',
                    description: winner.description || '',
                    origin: 'TMDB'
                }
                await addChallengerItem(challengerData, categoryId, result.newWinnerScore)
                toast.success(`${winner.name} saved!`)
            } catch {
                toast.error(`Failed to save ${winner.name}`)
            }
        }

        // Log Activity
        submitMatchActivity({
            winnerId: winner.id,
            winnerName: winner.name,
            loserId: loser.id,
            loserName: loser.name
        })
    }

    const handleEndTournament = async () => {
        setIsSaving(true)
        try {
            const updates = Array.from(eloScores.entries()).map(([id, elo]) => ({ id, elo }))
            await updateItemScores(updates)
            toast.success(`Tournament Complete! ${updates.length} ratings updated.`)
            onOpenChange(false)
        } catch {
            toast.error("Failed to save tournament results.")
        } finally {
            setIsSaving(false)
        }
    }

    if (!currentPair) return null
    const [itemA, itemB] = currentPair

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[90vw] h-[80vh] p-0 gap-0 bg-black border-none overflow-hidden flex flex-col">
                <DialogTitle className="sr-only">Tournament Match</DialogTitle>

                {/* Header */}
                <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-50 pointer-events-none">
                    {/* Top Left: End/Save */}
                    <div className="pointer-events-auto">
                        <Button
                            onClick={handleEndTournament}
                            disabled={isSaving}
                            variant="ghost"
                            className="text-zinc-400 hover:text-white"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4 mr-2" />
                                    End Session
                                </>
                            )}
                        </Button>
                    </div>

                    {/* Top Right: Settings & Round Info */}
                    <div className="flex items-center gap-4 pointer-events-auto">
                        <div className="flex items-center gap-2 text-zinc-500 font-mono text-sm tracking-widest bg-black/50 px-3 py-1 rounded-full border border-white/10 backdrop-blur">
                            <Trophy className="w-3 h-3 text-yellow-500" />
                            <span>ROUND {roundCount + 1}</span>
                            {matchLength !== 'endless' && <span className="text-zinc-700">/ {matchLength}</span>}
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-zinc-400 hover:text-white"
                            onClick={() => setSettingsOpen(true)}
                        >
                            <Settings className="w-5 h-5" />
                        </Button>
                    </div>
                </div>

                {/* Settings Modal (Nested Dialog) */}
                <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
                    <DialogContent className="bg-zinc-950 border-white/10 sm:max-w-md">
                        <DialogTitle className="text-white">Tournament Settings</DialogTitle>

                        <div className="space-y-6 pt-4">
                            {/* Discovery Mode */}
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <h4 className="text-sm font-medium text-white">Discovery Mode</h4>
                                    <p className="text-xs text-zinc-500">Show me new movies I haven&apos;t ranked yet.</p>
                                </div>
                                <Switch checked={discoveryMode} onCheckedChange={setDiscoveryMode} />
                            </div>

                            {/* Session Length */}
                            <div className="space-y-3">
                                <h4 className="text-sm font-medium text-white">Session Length</h4>
                                <div className="flex gap-2">
                                    {[10, 30, 50].map(len => (
                                        <Button
                                            key={len}
                                            variant={matchLength === len ? "secondary" : "outline"}
                                            onClick={() => setMatchLength(len as number)}
                                            className="flex-1 h-10 border-white/10"
                                        >
                                            {len}
                                        </Button>
                                    ))}
                                    <Button
                                        variant={matchLength === 'endless' ? "secondary" : "outline"}
                                        onClick={() => setMatchLength('endless')}
                                        className="flex-1 h-10 border-white/10 font-serif italic"
                                    >
                                        ∞
                                    </Button>
                                </div>
                            </div>

                            {/* Pro Tip */}
                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 flex gap-3 items-start">
                                <Info className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                                <p className="text-xs text-blue-200">
                                    <span className="font-bold text-blue-400">Pro Tip: </span>
                                    {matchLength === 'endless' && "Endless mode is great for casual browsing, but set a limit for accurate rankings."}
                                    {typeof matchLength === 'number' && matchLength < 20 && "Quick sessions focus on high-impact pairings to fix your top tiers fast."}
                                    {typeof matchLength === 'number' && matchLength >= 20 && "30+ rounds gives us enough data to separate your S-Tier from A-Tier with 90% confidence."}
                                </p>
                            </div>

                            <Button onClick={() => setSettingsOpen(false)} className="w-full bg-white text-black hover:bg-zinc-200">
                                Save Settings
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Split Arena */}
                <div className="flex-1 flex flex-col md:flex-row h-full relative">
                    <ContenderCard item={itemA} onClick={() => handleVote(itemA.id)} />

                    {/* VS Badge */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-none">
                        <div className="bg-black rounded-full p-4 border-4 border-zinc-900 shadow-2xl">
                            <span className="text-3xl font-black italic text-zinc-200">VS</span>
                        </div>
                    </div>

                    {/* Skip Button - Centered horizontally, below VS */}
                    <div className="absolute top-[65%] left-1/2 -translate-x-1/2 z-50">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-zinc-500 hover:text-white hover:bg-white/10 rounded-full px-6 backdrop-blur-sm transition-all shadow-lg border border-white/5"
                                >
                                    <SkipForward className="w-4 h-4 mr-2" />
                                    Skip / Haven&apos;t Seen
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-56 bg-zinc-900 border-white/10 p-2 text-zinc-200" side="bottom">
                                <div className="grid gap-1">
                                    <Button variant="ghost" className="justify-start text-zinc-300 hover:text-white hover:bg-white/10" onClick={skip}>
                                        Skip this match
                                    </Button>
                                    <div className="h-px bg-white/10 my-1" />
                                    <p className="text-xs text-zinc-500 px-2 py-1 font-medium">NEVER SHOW AGAIN</p>
                                    <Button
                                        variant="ghost"
                                        className="justify-start text-red-400 hover:text-red-300 hover:bg-red-500/10 truncate"
                                        onClick={() => { ignore(itemA.id); ignoreItem(itemA.id); }}
                                    >
                                        Ignore &quot;{itemA.name}&quot;
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        className="justify-start text-red-400 hover:text-red-300 hover:bg-red-500/10 truncate"
                                        onClick={() => { ignore(itemB.id); ignoreItem(itemB.id); }}
                                    >
                                        Ignore &quot;{itemB.name}&quot;
                                    </Button>
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>

                    <ContenderCard item={itemB} onClick={() => handleVote(itemB.id)} />
                </div>
            </DialogContent>
        </Dialog>
    )
}

function ContenderCard({ item, onClick }: { item: TournamentItem, onClick: () => void }) {
    return (
        <motion.div
            className="flex-1 relative group cursor-pointer overflow-hidden border-b md:border-b-0 md:border-r border-white/5 last:border-0"
            whileHover={{ flex: 1.05 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            onClick={onClick}
        >
            {/* Background Image */}
            {item.image ? (
                <Image src={item.image} alt={item.name} fill className="object-cover opacity-60 group-hover:opacity-80 transition-opacity duration-500" />
            ) : (
                <div className="absolute inset-0 bg-zinc-900 flex items-center justify-center">
                    <span className="text-zinc-700 font-bold text-6xl opacity-20">{item.name[0]}</span>
                </div>
            )}

            {/* Gradient Overlay for Text Readability - Stronger at bottom */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-90" />

            {/* Challenger Badge */}
            {item.type === 'CHALLENGER' && (
                <div className="absolute top-20 right-6 z-10 bg-yellow-500/20 text-yellow-400 border border-yellow-500/50 px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase animate-pulse">
                    New Discovery
                </div>
            )}

            {/* Info */}
            <div className="absolute bottom-0 left-0 right-0 p-8 md:p-12 transform group-hover:-translate-y-2 transition-transform duration-300 z-20">
                <h3 className="text-3xl md:text-5xl font-black text-white leading-tight mb-2 drop-shadow-lg max-w-lg whitespace-normal line-clamp-2">
                    {item.name}
                </h3>
                {item.description && (
                    <p className="text-zinc-300 line-clamp-2 max-w-md text-sm md:text-base leading-relaxed drop-shadow-md">
                        {item.description}
                    </p>
                )}

                <div className="mt-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform translate-y-4 group-hover:translate-y-0 text-white font-bold tracking-wide">
                    Tap to Vote
                </div>
            </div>
        </motion.div>
    )
}
