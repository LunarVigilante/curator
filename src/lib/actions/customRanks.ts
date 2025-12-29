'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { callLLMWithConfig } from '@/lib/llm'

const DEFAULT_TIERS = [
    { name: 'S', color: '#f87171' },
    { name: 'A', color: '#fb923c' },
    { name: 'B', color: '#facc15' },
    { name: 'C', color: '#4ade80' },
    { name: 'D', color: '#60a5fa' },
    { name: 'F', color: '#a855f7' },
]

export async function getCustomRanks(categoryId: string) {
    const supabase = await createClient()

    const { data, error } = await (supabase.from('custom_ranks') as any)
        .select('*')
        .eq('category_id', categoryId)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true })

    if (error) throw error
    return data || []
}

export async function analyzeSentiment(rankName: string): Promise<'POSITIVE' | 'NEUTRAL' | 'NEGATIVE'> {
    try {
        const prompt = `Analyze the following ranking tier name and determine if it represents:
- POSITIVE: Good/favorable items (e.g., "Favorites", "Must Watch", "Loved It", "Top Tier")
- NEGATIVE: Bad/unfavorable items (e.g., "Dropped", "Disappointing", "Trash", "Hate It")
- NEUTRAL: No judgment (e.g., "Haven't Finished", "Planning to Watch", "On Hold", "Currently Watching")

Tier name: "${rankName}"

Return ONLY a JSON object with this exact format:
{ "sentiment": "POSITIVE" | "NEUTRAL" | "NEGATIVE", "reasoning": "brief explanation" }
`

        const response = await callLLMWithConfig(prompt)
        const jsonStr = response.replace(/```json\n?|\n?```/g, '').trim()
        const analysis = JSON.parse(jsonStr)

        if (!['POSITIVE', 'NEUTRAL', 'NEGATIVE'].includes(analysis.sentiment)) {
            return 'NEUTRAL'
        }

        return analysis.sentiment
    } catch (error) {
        console.error('Failed to analyze sentiment, defaulting to neutral:', error)
        return 'NEUTRAL'
    }
}

export async function createCustomRank(categoryId: string, data: {
    name: string
    sentiment?: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE'
    color?: string
    sortOrder?: number
    type?: 'RANKED' | 'UTILITY'
}) {
    const supabase = await createClient()
    const sentiment = data.sentiment || await analyzeSentiment(data.name)

    let type = data.type || 'RANKED'
    const lowerName = data.name.toLowerCase()
    if (!data.type && (lowerName.includes('watchlist') || lowerName.includes('plan to') || lowerName.includes('never seen') || lowerName.includes('dropped'))) {
        type = 'UTILITY'
    }

    const existingRanks = await getCustomRanks(categoryId)

    // Bootstrap default tiers if this is the first custom rank
    if (existingRanks.length === 0) {
        for (let i = 0; i < DEFAULT_TIERS.length; i++) {
            const tier = DEFAULT_TIERS[i]
            await (supabase.from('custom_ranks') as any).insert({
                category_id: categoryId,
                name: tier.name,
                sentiment: 'NEUTRAL',
                color: tier.color,
                sort_order: i,
                type: 'RANKED'
            })
        }
    }

    const updatedRanks = await getCustomRanks(categoryId)
    const maxSortOrder = updatedRanks.reduce((max: number, rank: any) => Math.max(max, rank.sort_order), -1)

    const { data: newRank, error } = await (supabase.from('custom_ranks') as any)
        .insert({
            category_id: categoryId,
            name: data.name,
            sentiment,
            color: data.color || null,
            sort_order: data.sortOrder ?? (maxSortOrder + 1),
            type
        })
        .select()
        .single()

    if (error) throw error

    revalidatePath(`/categories/${categoryId}`)
    return newRank
}

export async function updateCustomRank(id: string, data: {
    name?: string
    sentiment?: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE'
    color?: string
    sortOrder?: number
    type?: 'RANKED' | 'UTILITY'
}) {
    const supabase = await createClient()
    const updateData: any = {}

    if (data.name !== undefined) {
        updateData.name = data.name
        if (data.sentiment === undefined) {
            updateData.sentiment = await analyzeSentiment(data.name)
        }
    }

    if (data.sentiment !== undefined) updateData.sentiment = data.sentiment
    if (data.color !== undefined) updateData.color = data.color
    if (data.sortOrder !== undefined) updateData.sort_order = data.sortOrder
    if (data.type !== undefined) updateData.type = data.type

    const { data: updated, error } = await (supabase.from('custom_ranks') as any)
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

    if (error) throw error

    if (updated) {
        revalidatePath(`/categories/${updated.category_id}`)
    }

    return updated
}

export async function deleteCustomRank(id: string) {
    const supabase = await createClient()

    const { data: rank } = await (supabase.from('custom_ranks') as any)
        .select('category_id')
        .eq('id', id)
        .single()

    if (!rank) {
        throw new Error('Custom rank not found')
    }

    const { error } = await (supabase.from('custom_ranks') as any)
        .delete()
        .eq('id', id)

    if (error) throw error
    revalidatePath(`/categories/${rank.category_id}`)
}

export async function updateCustomRankOrder(categoryId: string, rankOrders: { id: string, sortOrder: number }[]) {
    const supabase = await createClient()

    for (const item of rankOrders) {
        await (supabase.from('custom_ranks') as any)
            .update({ sort_order: item.sortOrder })
            .eq('id', item.id)
    }

    revalidatePath(`/categories/${categoryId}`)
}
