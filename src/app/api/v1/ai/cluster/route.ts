import { NextRequest, NextResponse } from 'next/server'
import { findSimilarItems } from '@/lib/services/search'
import { withAiApi, validationError } from '@/lib/middleware'
import { parseRequestBody, clusterSchema } from '@/lib/validation/api-schemas'
import { log } from 'next-axiom'

interface ClusterResult {
    name: string
    description: string
    itemIds: string[]
    centroidItemId: string
    avgSimilarity: number
}

export const POST = withAiApi(async (request: NextRequest) => {
    // Validate request body with Zod schema
    const validation = await parseRequestBody(request, clusterSchema)
    if (!validation.success) {
        return validationError(validation.error)
    }

    const { itemIds, numClusters: maxClusters } = validation.data
    const threshold = 0.65

    if (itemIds.length < 2) {
        return validationError('At least 2 item IDs required')
    }

    // For each item, find similar items in parallel
    const similarityMap = new Map<string, Map<string, number>>()
    const itemsToProcess = itemIds.slice(0, 10) // Limit to prevent rate limiting

    const promises = itemsToProcess.map(itemId => findSimilarItems(itemId, { limit: 20 }))
    const results = await Promise.allSettled(promises)

    results.forEach((result, index) => {
        const itemId = itemsToProcess[index]

        if (result.status === 'rejected') {
            log.warn('[Cluster] Failed to get similar items', { itemId, reason: String(result.reason) })
            return
        }

        const similar = result.value
        const itemSimilarities = new Map<string, number>()

        for (const s of similar) {
            if (itemIds.includes(s.id)) {
                itemSimilarities.set(s.id, s.score)
            }
        }

        similarityMap.set(itemId, itemSimilarities)
    })

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

    log.info('[Cluster] Completed', {
        itemsProcessed: itemIds.length,
        clustersFound: clusters.length
    })

    return NextResponse.json({
        success: true,
        clusters,
        itemsProcessed: itemIds.length,
        clustersFound: clusters.length
    })
})
