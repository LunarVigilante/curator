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
    metadata?: any
}

export function useTournamentMatchmaker(initialItems: TournamentItem[], challengers: ChallengerItem[]) {
    // Local session score map: ItemID -> Elo Score
    const [eloScores, setEloScores] = useState<Map<string, number>>(new Map(initialItems.map(i => [i.id, i.elo])))

    const [currentPair, setCurrentPair] = useState<[TournamentItem, TournamentItem] | null>(null)
    const [history, setHistory] = useState<string[]>([]) // Track pairs to avoid immediate repeats
    const [roundCount, setRoundCount] = useState(0)
    const [ignoredIds, setIgnoredIds] = useState<Set<string>>(new Set())

    // Helper to get current score
    const getScore = useCallback((id: string) => eloScores.get(id) || 1200, [eloScores])

    // Generate a new pair
    const generatePair = useCallback(() => {
        // Filter out ignored items
        const activeItems = initialItems.filter(i => !ignoredIds.has(i.id))

        if (activeItems.length < 2) return null

        const pool = [...activeItems]

        // 20% Chance for Discovery Round (if challengers exist)
        // ...
        // Ensure challengers are not ignored (if we track their IDs in ignoredIds too)
        const activeChallengers = challengers.filter(c => !ignoredIds.has(c.id))
        const isDiscoveryRound = activeChallengers.length > 0 && Math.random() < 0.20

        if (isDiscoveryRound) {
            // Pick rand user item
            const userItem = pool[Math.floor(Math.random() * pool.length)]
            // Pick rand challenger
            const challenger = activeChallengers[Math.floor(Math.random() * activeChallengers.length)]

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

    }, [initialItems, challengers, getScore, ignoredIds])

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

    const ignore = (itemId: string) => {
        // Remove from local pool (effectively) by removing from initialItems? 
        // We can't easily mutate initialItems prop. 
        // We can maintain a set of ignored IDs.
        setIgnoredIds(prev => new Set(prev).add(itemId))

        // Skip match
        setCurrentPair(generatePair())
    }

    // Filter available items logic in generatePair needs to respect ignoredIds

    return {
        currentPair,
        vote,
        skip,
        ignore,
        eloScores,
        roundCount
    }
}
