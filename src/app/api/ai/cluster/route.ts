import { NextResponse } from 'next/server'
import { findSimilarItems } from '@/lib/services/search'

interface ClusterRequest {
    itemIds: string[]
    threshold?: number
    maxClusters?: number
}

interface ClusterResult {
    name: string
    description: string
    itemIds: string[]
    centroidItemId: string
    avgSimilarity: number
}

export async function POST(request: Request) {
    try {
        const body: ClusterRequest = await request.json()
        const { itemIds, threshold = 0.65, maxClusters = 5 } = body

        if (!itemIds || itemIds.length < 2) {
            return NextResponse.json(
                { error: 'At least 2 item IDs required' },
                { status: 400 }
            )
        }

        // For each item, find similar items
        const similarityMap = new Map<string, Map<string, number>>()

        for (const itemId of itemIds.slice(0, 10)) { // Limit to prevent rate limiting
            try {
                const similar = await findSimilarItems(itemId, 20)
                const itemSimilarities = new Map<string, number>()

                for (const s of similar) {
                    if (itemIds.includes(s.id)) {
                        itemSimilarities.set(s.id, s.similarity)
                    }
                }

                similarityMap.set(itemId, itemSimilarities)
            } catch (e) {
                console.error(`Failed to get similar items for ${itemId}:`, e)
            }
        }

        // Simple clustering: group items by similarity
        const clusters: ClusterResult[] = []
        const assigned = new Set<string>()

        // Find natural clusters based on mutual high similarity
        for (const [centroidId, similarities] of similarityMap) {
            if (assigned.has(centroidId)) continue

            const clusterItems = [centroidId]
            let totalSimilarity = 0
            let count = 0

            for (const [otherId, similarity] of similarities) {
                if (!assigned.has(otherId) && similarity >= threshold && otherId !== centroidId) {
                    clusterItems.push(otherId)
                    totalSimilarity += similarity
                    count++
                }
            }

            if (clusterItems.length >= 2) {
                clusterItems.forEach(id => assigned.add(id))

                clusters.push({
                    name: `Cluster ${clusters.length + 1}`,
                    description: `${clusterItems.length} items with ${Math.round((totalSimilarity / Math.max(count, 1)) * 100)}% average similarity`,
                    itemIds: clusterItems,
                    centroidItemId: centroidId,
                    avgSimilarity: count > 0 ? totalSimilarity / count : 1
                })

                if (clusters.length >= maxClusters) break
            }
        }

        // Add remaining unclustered items as a misc group
        const unclustered = itemIds.filter(id => !assigned.has(id))
        if (unclustered.length > 0) {
            clusters.push({
                name: 'Unclustered',
                description: `${unclustered.length} items without strong similarity`,
                itemIds: unclustered,
                centroidItemId: unclustered[0],
                avgSimilarity: 0
            })
        }

        return NextResponse.json({
            success: true,
            clusters,
            itemsProcessed: itemIds.length,
            clustersFound: clusters.length
        })

    } catch (error) {
        console.error('Clustering error:', error)
        return NextResponse.json(
            { error: 'Failed to cluster items' },
            { status: 500 }
        )
    }
}
