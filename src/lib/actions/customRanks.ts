'use server'

import { db } from '@/lib/db'
import { customRanks } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { callLLM } from '@/lib/llm'

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

        const response = await callLLM(prompt)

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
}) {
    // If sentiment is not provided, use LLM to analyze it
    const sentiment = data.sentiment || await analyzeSentiment(data.name)

    // Get the current max sort order for this category
    const existingRanks = await getCustomRanks(categoryId)
    const maxSortOrder = existingRanks.reduce((max, rank) => Math.max(max, rank.sortOrder), -1)

    const newRank = await db.insert(customRanks).values({
        categoryId,
        name: data.name,
        sentiment,
        color: data.color || null,
        sortOrder: data.sortOrder ?? (maxSortOrder + 1)
    }).returning()

    revalidatePath(`/categories/${categoryId}`)
    return newRank[0]
}

export async function updateCustomRank(id: string, data: {
    name?: string
    sentiment?: 'positive' | 'neutral' | 'negative'
    color?: string
    sortOrder?: number
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
