import { useState, useCallback, useMemo } from 'react'
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

export function useTournamentMatchmaker(
    initialItems: TournamentItem[],
    challengers: ChallengerItem[],
    settings: { discoveryMode: boolean; matchLength: number | 'endless' }
) {
    // Local session score map: ItemID -> Elo Score
    const [eloScores, setEloScores] = useState<Map<string, number>>(new Map(initialItems.map(i => [i.id, i.elo])))
    const [roundCount, setRoundCount] = useState(0)
    const [ignoredIds, setIgnoredIds] = useState<Set<string>>(new Set())

    // Check if tournament is complete
    const isComplete = useMemo(() => {
        if (settings.matchLength === 'endless') return false
        return roundCount >= settings.matchLength
    }, [roundCount, settings.matchLength])

    // Helper to get current score
    const getScore = useCallback((id: string) => eloScores.get(id) || 1200, [eloScores])

    // Generate a new pair
    const generatePair = useCallback((): [TournamentItem, TournamentItem] | null => {
        // If match limit reached, return null
        if (settings.matchLength !== 'endless' && roundCount >= settings.matchLength) {
            return null
        }

        // Filter out ignored items
        const activeItems = initialItems.filter(i => !ignoredIds.has(i.id))

        if (activeItems.length < 2) return null

        const pool = [...activeItems]

        // Discovery Logic
        // Only run if discoveryMode is ON
        if (settings.discoveryMode) {
            const activeChallengers = challengers.filter(c => !ignoredIds.has(c.id))
            const isDiscoveryRound = activeChallengers.length > 0 && Math.random() < 0.20 // 20% chance

            if (isDiscoveryRound) {
                const userItem = pool[Math.floor(Math.random() * pool.length)]
                const challenger = activeChallengers[Math.floor(Math.random() * activeChallengers.length)]

                const challengerItem: TournamentItem = {
                    ...challenger,
                    elo: 1200,
                    type: 'CHALLENGER'
                }
                const hydratedUserItem = { ...userItem, elo: getScore(userItem.id) }
                return [hydratedUserItem, challengerItem] as [TournamentItem, TournamentItem]
            }
        }

        // Matchmaking Logic
        const isHighVariance = typeof settings.matchLength === 'number' && settings.matchLength < 20

        if (isHighVariance) {
            // High Variance / Accuracy Focus: Pair items with similar Elo to force separation
            // Sort by current Elo
            const sortedPool = pool.map(i => ({ ...i, elo: getScore(i.id) })).sort((a, b) => a.elo - b.elo)

            // Pick Item A at random
            const idx1 = Math.floor(Math.random() * sortedPool.length)

            // Pick Item B from neighbors (tight window)
            // Window size 4 (+/- 2)
            const minIdx = Math.max(0, idx1 - 2)
            const maxIdx = Math.min(sortedPool.length - 1, idx1 + 2)

            let idx2 = idx1
            // Try to find a different item in window
            // If window is too small, fallback to random
            if (maxIdx > minIdx) {
                let attempts = 0
                while (idx2 === idx1 && attempts < 10) {
                    idx2 = Math.floor(Math.random() * (maxIdx - minIdx + 1)) + minIdx
                    attempts++
                }
            }

            // Fallback if we couldn't find neighbor or window too small
            if (idx2 === idx1) {
                idx2 = Math.floor(Math.random() * sortedPool.length)
                while (idx2 === idx1) idx2 = Math.floor(Math.random() * sortedPool.length)
            }

            return [sortedPool[idx1], sortedPool[idx2]] as [TournamentItem, TournamentItem]
        }

        // Standard / Endless Logic: Weighted Random or Pure Random
        // Current: Pure Random
        const idx1 = Math.floor(Math.random() * pool.length)
        let idx2 = Math.floor(Math.random() * pool.length)

        while (idx1 === idx2) {
            idx2 = Math.floor(Math.random() * pool.length)
        }

        const itemA = { ...pool[idx1], elo: getScore(pool[idx1].id) }
        const itemB = { ...pool[idx2], elo: getScore(pool[idx2].id) }

        return [itemA, itemB] as [TournamentItem, TournamentItem]

    }, [initialItems, challengers, getScore, ignoredIds, settings, roundCount])

    // Initialize current pair lazily
    const [currentPair, setCurrentPair] = useState<[TournamentItem, TournamentItem] | null>(() => {
        // Generate initial pair
        const activeItems = initialItems.filter(i => !ignoredIds.has(i.id))
        if (activeItems.length < 2) return null

        const pool = [...activeItems]
        const idx1 = Math.floor(Math.random() * pool.length)
        let idx2 = Math.floor(Math.random() * pool.length)
        while (idx1 === idx2) {
            idx2 = Math.floor(Math.random() * pool.length)
        }

        const getInitialScore = (id: string) => {
            const item = initialItems.find(i => i.id === id)
            return item?.elo || 1200
        }

        return [
            { ...pool[idx1], elo: getInitialScore(pool[idx1].id) },
            { ...pool[idx2], elo: getInitialScore(pool[idx2].id) }
        ]
    })


    // Removed useEffect that was causing setState loop
    // Initialization is now guaranteed by parent component ensuring items exist before mounting hook

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

        const newRoundCount = roundCount + 1
        setRoundCount(newRoundCount)

        // Check if we've reached the match limit
        if (settings.matchLength !== 'endless' && newRoundCount >= settings.matchLength) {
            setCurrentPair(null) // Stop generating pairs
        } else {
            setCurrentPair(generatePair())
        }

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
        roundCount,
        isComplete
    }
}
