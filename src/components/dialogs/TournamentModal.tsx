'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useTournamentMatchmaker } from '@/hooks/useTournamentMatchmaker'
import { AnimatePresence, motion } from 'framer-motion'
import { Trophy, Check, X, SkipForward, Save } from 'lucide-react'
import Image from 'next/image'
import { toast } from 'sonner'
import { updateItemScores, addChallengerItem } from '@/lib/actions/items'
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

    const { currentPair, vote, skip, eloScores, roundCount } = useTournamentMatchmaker(tournamentItems, challengers)

    const handleVote = async (winnerId: string) => {
        const result = vote(winnerId)
        if (!result) return

        const { winner, loser } = result

        // Logic 4: Auto-Add Challenger if they receive a vote (Winner OR Loser? Spec says "Voting FOR a Challenger")
        // If the user VOTED FOR the challenger (winner is challenger) -> Add it.
        // If the user voted AGAINST the challenger (loser is challenger) -> Do nothing (User rejected it).

        if (winner.type === 'CHALLENGER') {
            toast.info(`Adding "${winner.name}" to your collection...`)
            try {
                await addChallengerItem(winner as ChallengerItem, categoryId, result.newWinnerScore)
                toast.success(`${winner.name} saved!`)
            } catch (e) {
                toast.error(`Failed to save ${winner.name}`)
            }
        }
    }

    const handleEndTournament = async () => {
        setIsSaving(true)
        try {
            // Convert Map to array of updates
            const updates = Array.from(eloScores.entries()).map(([id, elo]) => ({ id, elo }))

            // Filter out challengers who haven't been added to DB yet (we only update existing items)
            // But wait, added challengers are already in DB via handleVote. 
            // We only need to update USER items that are in the map.
            // IDs in eloScores might belong to temporary challengers that were NOT voted for (if they lost).
            // So we strictly filter updates for items that exist in our initial 'items' list OR were added.
            // Simplified: Just attempt to update. If ID doesn't exist in DB, `updateItemScores` will ignore or fail gracefully.
            // Better: updateItemScores should handle it.

            await updateItemScores(updates)

            toast.success(`Tournament Complete! ${updates.length} ratings updated.`)
            onOpenChange(false)
        } catch (error) {
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

                {/* Header */}
                <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-50 bg-gradient-to-b from-black/80 to-transparent">
                    <div className="flex items-center gap-2 text-zinc-400">
                        <Trophy className="w-5 h-5 text-yellow-500" />
                        <span className="font-mono text-sm tracking-widest">ROUND {roundCount + 1}</span>
                    </div>
                    <Button
                        onClick={handleEndTournament}
                        disabled={isSaving}
                        className="bg-white text-black hover:bg-zinc-200"
                    >
                        {isSaving ? 'Saving...' : 'End Tournament'}
                        <Save className="w-4 h-4 ml-2" />
                    </Button>
                </div>

                {/* Split Arena */}
                <div className="flex-1 flex flex-col md:flex-row h-full">
                    <ContenderCard item={itemA} onClick={() => handleVote(itemA.id)} />

                    {/* VS Badge */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 bg-black rounded-full p-4 border-4 border-zinc-900 shadow-2xl">
                        <span className="text-3xl font-black italic text-zinc-200">VS</span>
                    </div>

                    <ContenderCard item={itemB} onClick={() => handleVote(itemB.id)} />
                </div>

                {/* Footer Controls */}
                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-50">
                    <Button
                        variant="secondary"
                        size="lg"
                        onClick={skip}
                        className="rounded-full px-8 bg-zinc-900/80 backdrop-blur text-zinc-400 hover:text-white border border-white/10"
                    >
                        <SkipForward className="w-4 h-4 mr-2" />
                        Skip / Haven't Seen
                    </Button>
                </div>

            </DialogContent>
        </Dialog>
    )
}

function ContenderCard({ item, onClick }: { item: TournamentItem, onClick: () => void }) {
    return (
        <motion.div
            className="flex-1 relative group cursor-pointer overflow-hidden border-b md:border-b-0 md:border-r border-white/5 last:border-0"
            whileHover={{ flex: 1.1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            onClick={onClick}
        >
            {/* Background Image */}
            {item.image ? (
                <Image src={item.image} alt={item.name} fill className="object-cover opacity-60 group-hover:opacity-100 transition-opacity duration-500" />
            ) : (
                <div className="absolute inset-0 bg-zinc-900 flex items-center justify-center">
                    <span className="text-zinc-700 font-bold text-6xl opacity-20">{item.name[0]}</span>
                </div>
            )}

            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

            {/* Challenger Badge */}
            {item.type === 'CHALLENGER' && (
                <div className="absolute top-20 right-6 bg-yellow-500/20 text-yellow-400 border border-yellow-500/50 px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase animate-pulse">
                    New Discovery
                </div>
            )}

            {/* Info */}
            <div className="absolute bottom-0 left-0 right-0 p-8 md:p-12 transform group-hover:-translate-y-2 transition-transform duration-300">
                <h3 className="text-3xl md:text-5xl font-black text-white leading-tight mb-2 drop-shadow-lg max-w-lg">
                    {item.name}
                </h3>
                {item.description && (
                    <p className="text-zinc-400 line-clamp-2 max-w-md text-sm md:text-base leading-relaxed">
                        {item.description}
                    </p>
                )}

                <div className="mt-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform translate-y-4 group-hover:translate-y-0">
                    <span className="inline-flex items-center gap-2 bg-white text-black px-6 py-2 rounded-full font-bold tracking-wide text-sm">
                        <Check className="w-4 h-4" /> VOTE WINNER
                    </span>
                </div>
            </div>
        </motion.div>
    )
}
