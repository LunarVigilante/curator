'use client'

import { useState, useTransition } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Check, Loader2 } from 'lucide-react'
import { processBinaryVote } from '@/lib/actions/onboarding'
import { toast } from 'sonner'
import type { BinaryRaterPair } from '@/lib/types/onboarding'

interface BinaryRaterProps {
    pair: BinaryRaterPair
    onComplete?: () => void
}

export function BinaryRater({ pair, onComplete }: BinaryRaterProps) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [selectedWinner, setSelectedWinner] = useState<'A' | 'B' | null>(null)
    const [isComplete, setIsComplete] = useState(false)

    const handleVote = (winner: 'A' | 'B') => {
        if (isComplete) return

        // 1. INSTANT: Visual feedback
        setSelectedWinner(winner)
        setIsComplete(true)

        // 2. OPTIMISTIC: Show success message immediately
        const winnerName = winner === 'A' ? pair.optionA.name : pair.optionB.name
        toast.success(`${winnerName} wins!`, {
            description: `Creating "${pair.theme}" collection...`
        })

        // 3. BACKGROUND: Server sync (non-blocking)
        startTransition(async () => {
            try {
                const result = await processBinaryVote({
                    pairId: pair.id,
                    winnerId: winner,
                    theme: pair.theme,
                    optionA: pair.optionA,
                    optionB: pair.optionB
                })

                if (result.success) {
                    toast.success('Collection created!', {
                        description: 'Redirecting to your dashboard...'
                    })

                    // Small delay for UX
                    setTimeout(() => {
                        if (onComplete) {
                            onComplete()
                        } else {
                            router.push(`/categories/${result.categoryId}`)
                        }
                    }, 500)
                }
            } catch (error) {
                // ROLLBACK: Only if server fails
                setIsComplete(false)
                setSelectedWinner(null)
                toast.error('Something went wrong. Please try again.')
            }
        })
    }

    return (
        <div className="relative w-full h-screen bg-black overflow-hidden">
            {/* Theme Header */}
            <div className="absolute top-0 left-0 right-0 z-20 p-8 text-center bg-gradient-to-b from-black via-black/80 to-transparent">
                <p className="text-zinc-500 uppercase tracking-widest text-sm mb-2">
                    Your First Collection
                </p>
                <h1 className="text-3xl md:text-4xl font-black text-white">
                    {pair.theme}
                </h1>
            </div>

            {/* VS Badge */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30">
                <motion.div
                    className="bg-black rounded-full p-6 border-4 border-zinc-800 shadow-2xl"
                    animate={{
                        scale: [1, 1.1, 1],
                    }}
                    transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                >
                    <span className="text-3xl md:text-4xl font-black italic text-white">VS</span>
                </motion.div>
            </div>

            {/* Split Arena */}
            <div className="flex flex-col md:flex-row h-full">
                <ChoiceCard
                    item={pair.optionA}
                    isSelected={selectedWinner === 'A'}
                    isDisabled={isComplete}
                    isPending={isPending && selectedWinner === 'A'}
                    onClick={() => handleVote('A')}
                    side="left"
                />

                <ChoiceCard
                    item={pair.optionB}
                    isSelected={selectedWinner === 'B'}
                    isDisabled={isComplete}
                    isPending={isPending && selectedWinner === 'B'}
                    onClick={() => handleVote('B')}
                    side="right"
                />
            </div>

            {/* Instructions */}
            {!isComplete && (
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20">
                    <p className="text-zinc-500 text-sm text-center animate-pulse">
                        Click your pick to create your first ranking
                    </p>
                </div>
            )}
        </div>
    )
}

function ChoiceCard({
    item,
    isSelected,
    isDisabled,
    isPending,
    onClick,
    side
}: {
    item: { name: string; imageUrl: string; description?: string }
    isSelected: boolean
    isDisabled: boolean
    isPending: boolean
    onClick: () => void
    side: 'left' | 'right'
}) {
    return (
        <motion.div
            className={`
                flex-1 relative group cursor-pointer overflow-hidden
                border-b md:border-b-0 md:border-r border-white/5 last:border-0
                ${isDisabled && !isSelected ? 'opacity-30 pointer-events-none' : ''}
            `}
            whileHover={!isDisabled ? { flex: 1.15 } : undefined}
            transition={{ duration: 0.4, ease: "easeOut" }}
            onClick={onClick}
        >
            {/* Background Image */}
            <div className="absolute inset-0">
                <Image
                    src={item.imageUrl}
                    alt={item.name}
                    fill
                    className={`
                        object-cover transition-all duration-500
                        ${isSelected ? 'scale-105 opacity-100' : 'opacity-60 group-hover:opacity-90'}
                    `}
                />
            </div>

            {/* Gradient Overlay */}
            <div className={`
                absolute inset-0 transition-opacity duration-300
                ${side === 'left'
                    ? 'bg-gradient-to-r from-black via-black/30 to-transparent'
                    : 'bg-gradient-to-l from-black via-black/30 to-transparent'
                }
            `} />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />

            {/* Selected Overlay */}
            {isSelected && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 bg-green-500/20 border-4 border-green-500"
                />
            )}

            {/* Content */}
            <div className={`
                absolute bottom-0 p-8 md:p-12
                ${side === 'left' ? 'left-0 text-left' : 'right-0 text-right'}
            `}>
                <motion.div
                    className="transform transition-transform duration-300 group-hover:-translate-y-2"
                >
                    <h3 className="text-3xl md:text-5xl font-black text-white leading-tight mb-3 drop-shadow-lg">
                        {item.name}
                    </h3>

                    {item.description && (
                        <p className="text-zinc-400 text-sm md:text-base max-w-md">
                            {item.description}
                        </p>
                    )}

                    {/* Hover/Select State */}
                    <div className={`
                        mt-6 transition-opacity duration-300
                        ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
                    `}>
                        {isPending ? (
                            <span className="inline-flex items-center gap-2 bg-white text-black px-6 py-3 rounded-full font-bold">
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Creating...
                            </span>
                        ) : isSelected ? (
                            <span className="inline-flex items-center gap-2 bg-green-500 text-white px-6 py-3 rounded-full font-bold">
                                <Check className="w-5 h-5" />
                                WINNER
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-2 bg-white text-black px-6 py-3 rounded-full font-bold">
                                <Check className="w-5 h-5" />
                                PICK THIS
                            </span>
                        )}
                    </div>
                </motion.div>
            </div>
        </motion.div>
    )
}
