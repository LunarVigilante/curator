'use client'

import { useState, useEffect, useCallback } from 'react'
import { calculateElo } from '@/lib/elo'
import { ChallengerItem } from '@/lib/actions/discovery'

type TournamentItem = {
    id: string
    name: string
    image: string | null
    elo: number
    type: 'USER' | 'CHALLENGER'
    description?: string
}

export function useTournamentMatchmaker(initialItems: TournamentItem[], challengers: ChallengerItem[]) {
    // Local session score map: ItemID -> Elo Score
    const [eloScores, setEloScores] = useState<Map<string, number>>(new Map(initialItems.map(i => [i.id, i.elo])))

    const [currentPair, setCurrentPair] = useState<[TournamentItem, TournamentItem] | null>(null)
    const [history, setHistory] = useState<string[]>([]) // Track pairs to avoid immediate repeats
    const [roundCount, setRoundCount] = useState(0)

    // Helper to get current score
    const getScore = useCallback((id: string) => eloScores.get(id) || 1200, [eloScores])

    // Generate a new pair
    const generatePair = useCallback(() => {
        if (initialItems.length < 2) return null

        const pool = [...initialItems]

        // 20% Chance for Discovery Round (if challengers exist)
        const isDiscoveryRound = challengers.length > 0 && Math.random() < 0.20

        if (isDiscoveryRound) {
            // Pick rand user item
            const userItem = pool[Math.floor(Math.random() * pool.length)]
            // Pick rand challenger
            const challenger = challengers[Math.floor(Math.random() * challengers.length)]

            const challengerItem: TournamentItem = {
                ...challenger,
                elo: 1200, // Challengers start at 1200
                type: 'CHALLENGER'
            }

            // Hydrate user item with latest score
            const hydratedUserItem = { ...userItem, elo: getScore(userItem.id) }

            return [hydratedUserItem, challengerItem] as [TournamentItem, TournamentItem]
        }

        // Standard Ranked Round: Pick two random items (optimized for close Elo in future)
        // For now: Pure random
        let idx1 = Math.floor(Math.random() * pool.length)
        let idx2 = Math.floor(Math.random() * pool.length)

        while (idx1 === idx2) {
            idx2 = Math.floor(Math.random() * pool.length)
        }

        const itemA = { ...pool[idx1], elo: getScore(pool[idx1].id) }
        const itemB = { ...pool[idx2], elo: getScore(pool[idx2].id) }

        return [itemA, itemB] as [TournamentItem, TournamentItem]

    }, [initialItems, challengers, getScore])

    // Initial pair
    useEffect(() => {
        if (!currentPair) {
            const next = generatePair()
            setCurrentPair(next)
        }
    }, [currentPair, generatePair])

    const vote = (winnerId: string) => {
        if (!currentPair) return

        const [itemA, itemB] = currentPair
        const winner = itemA.id === winnerId ? itemA : itemB
        const loser = itemA.id === winnerId ? itemB : itemA

        // Calculate new scores
        const { newWinnerScore, newLoserScore } = calculateElo(winner.elo, loser.elo)

        // Update local map
        const newMap = new Map(eloScores)
        newMap.set(winner.id, newWinnerScore)
        newMap.set(loser.id, newLoserScore)
        setEloScores(newMap)

        setRoundCount(prev => prev + 1)
        setCurrentPair(generatePair())

        return { winner, loser, newWinnerScore, newLoserScore }
    }

    const skip = () => {
        setCurrentPair(generatePair())
    }

    return {
        currentPair,
        vote,
        skip,
        eloScores,
        roundCount
    }
}
