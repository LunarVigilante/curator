'use server'

import { db } from '@/lib/db'
import { categories, items } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { callLLM } from '@/lib/llm'

export type RecommendationResult = {
    name: string
    description: string
    reasoning: string
}

export async function getRecommendation(categoryId: string): Promise<RecommendationResult> {
    // 1. Get Category Name
    const category = await db.query.categories.findFirst({
        where: eq(categories.id, categoryId)
    })

    if (!category) throw new Error('Category not found')

    // 2. Get User's Top Rated Items in this Category
    // We want items with high ratings (e.g. > 80 or S/A tier)
    const userItems = await db.query.items.findMany({
        where: eq(items.categoryId, categoryId),
        with: {
            ratings: true
        },
        limit: 20
    })

    // Filter for highly rated items
    const likedItems = userItems.filter(item => {
        const rating = item.ratings[0]
        if (!rating) return false
        // Numerical > 75 or Tier S/A/B
        if (rating.type === 'NUMERICAL') return rating.value > 75
        if (rating.type === 'TIER') return ['S', 'A', 'B'].includes(rating.tier || '')
        return false
    }).map(item => item.name)

    // 3. Construct Prompt
    const prompt = `
    I want a recommendation for a new item in the category: "${category.name}".
    
    Here are some items I already like in this category:
    ${likedItems.length > 0 ? likedItems.join(', ') : 'No specific favorites yet, just recommend a popular classic.'}

    Please recommend ONE new item that I might enjoy.
    Provide the response in the following JSON format:
    {
      "name": "Item Name",
      "description": "Brief description of the item",
      "reasoning": "Why you think I would like it based on my favorites"
    }
  `

    // 4. Call LLM
    try {
        const jsonResponse = await callLLM(prompt)

        // Clean up markdown code blocks if present
        const cleanJson = jsonResponse.replace(/```json/g, '').replace(/```/g, '').trim()

        const result = JSON.parse(cleanJson) as RecommendationResult
        return result
    } catch (error) {
        console.error('Recommendation Error:', error)
        // Fallback mock response if LLM fails (for testing without API key)
        return {
            name: `Mock Recommendation for ${category.name}`,
            description: "This is a fallback recommendation because the LLM call failed (likely missing API key).",
            reasoning: "Please configure your LLM API Key in Settings to get real recommendations."
        }
    }
}
