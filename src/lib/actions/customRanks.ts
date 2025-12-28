'use server'

import { db } from '@/lib/db'
import { customRanks } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { callLLMWithConfig } from '@/lib/llm'

const DEFAULT_TIERS = [
    { name: 'S', color: '#f87171' }, // red-400
    { name: 'A', color: '#fb923c' }, // orange-400
    { name: 'B', color: '#facc15' }, // yellow-400
    { name: 'C', color: '#4ade80' }, // green-400
    { name: 'D', color: '#60a5fa' }, // blue-400
    { name: 'F', color: '#a855f7' }, // purple-500
]

export async function getCustomRanks(categoryId: string) {
    const ranks = await db.query.customRanks.findMany({
        where: eq(customRanks.categoryId, categoryId),
        orderBy: (customRanks, { asc }) => [asc(customRanks.sortOrder), asc(customRanks.name)]
    })
    return ranks
}

export async function analyzeSentiment(rankName: string): Promise<'positive' | 'neutral' | 'negative'> {
    try {
        const prompt = `Analyze the following ranking tier name and determine if it represents:
- POSITIVE: Good/favorable items (e.g., "Favorites", "Must Watch", "Loved It", "Top Tier")
- NEGATIVE: Bad/unfavorable items (e.g., "Dropped", "Disappointing", "Trash", "Hate It")
- NEUTRAL: No judgment (e.g., "Haven't Finished", "Planning to Watch", "On Hold", "Currently Watching")

Tier name: "${rankName}"

Return ONLY a JSON object with this exact format:
{ "sentiment": "positive" | "neutral" | "negative", "reasoning": "brief explanation" }
`

        const response = await callLLMWithConfig(prompt)

        // Clean up response if it contains markdown code blocks
        const jsonStr = response.replace(/```json\n?|\n?```/g, '').trim()
        const analysis = JSON.parse(jsonStr)

        // Validate the sentiment value
        if (!['positive', 'neutral', 'negative'].includes(analysis.sentiment)) {
            console.warn('Invalid sentiment from LLM, defaulting to neutral:', analysis.sentiment)
            return 'neutral'
        }

        return analysis.sentiment
    } catch (error) {
        console.error('Failed to analyze sentiment, defaulting to neutral:', error)
        // Default to neutral if LLM fails
        return 'neutral'
    }
}

export async function createCustomRank(categoryId: string, data: {
    name: string
    sentiment?: 'positive' | 'neutral' | 'negative'
    color?: string
    sortOrder?: number
    type?: 'RANKED' | 'UTILITY'
}) {
    // If sentiment is not provided, use LLM to analyze it
    const sentiment = data.sentiment || await analyzeSentiment(data.name)

    // Auto-detect utility type keyworks if not explicitly provided
    let type = data.type || 'RANKED'
    const lowerName = data.name.toLowerCase()
    if (!data.type && (lowerName.includes('watchlist') || lowerName.includes('plan to') || lowerName.includes('never seen') || lowerName.includes('dropped'))) {
        type = 'UTILITY'
    }

    // Get the current max sort order for this category
    const existingRanks = await getCustomRanks(categoryId)

    // Bootstrap default tiers if this is the first custom rank
    if (existingRanks.length === 0) {
        for (let i = 0; i < DEFAULT_TIERS.length; i++) {
            const tier = DEFAULT_TIERS[i]
            await db.insert(customRanks).values({
                categoryId,
                name: tier.name,
                sentiment: 'neutral', // Defaults are neutral contextually until customized
                color: tier.color,
                sortOrder: i,
                type: 'RANKED'
            })
        }
    }

    // Re-fetch to get correct sort order base (now populated)
    const updatedRanks = await getCustomRanks(categoryId)
    const maxSortOrder = updatedRanks.reduce((max, rank) => Math.max(max, rank.sortOrder), -1)

    const newRank = await db.insert(customRanks).values({
        categoryId,
        name: data.name,
        sentiment,
        color: data.color || null,
        sortOrder: data.sortOrder ?? (maxSortOrder + 1),
        type
    }).returning()

    revalidatePath(`/categories/${categoryId}`)
    return newRank[0]
}

export async function updateCustomRank(id: string, data: {
    name?: string
    sentiment?: 'positive' | 'neutral' | 'negative'
    color?: string
    sortOrder?: number
    type?: 'RANKED' | 'UTILITY'
}) {
    const updateData: any = {}

    if (data.name !== undefined) {
        updateData.name = data.name
        // Re-analyze sentiment if name changed and no explicit sentiment provided
        if (data.sentiment === undefined) {
            updateData.sentiment = await analyzeSentiment(data.name)
        }
    }

    if (data.sentiment !== undefined) updateData.sentiment = data.sentiment
    if (data.color !== undefined) updateData.color = data.color
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder
    if (data.type !== undefined) updateData.type = data.type

    const updated = await db.update(customRanks)
        .set(updateData)
        .where(eq(customRanks.id, id))
        .returning()

    if (updated[0]) {
        revalidatePath(`/categories/${updated[0].categoryId}`)
    }

    return updated[0]
}

export async function deleteCustomRank(id: string) {
    const rank = await db.query.customRanks.findFirst({
        where: eq(customRanks.id, id)
    })

    if (!rank) {
        throw new Error('Custom rank not found')
    }

    await db.delete(customRanks).where(eq(customRanks.id, id))
    revalidatePath(`/categories/${rank.categoryId}`)
}

export async function updateCustomRankOrder(categoryId: string, rankOrders: { id: string, sortOrder: number }[]) {
    await db.transaction(async (tx) => {
        for (const item of rankOrders) {
            await tx.update(customRanks)
                .set({ sortOrder: item.sortOrder })
                .where(eq(customRanks.id, item.id))
        }
    })
    revalidatePath(`/categories/${categoryId}`)
}
