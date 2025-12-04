'use server'

import { db } from '@/lib/db'
import { categories, items } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { callLLM } from '@/lib/llm'

export type Recommendation = {
    name: string
    description: string
    reasoning: string
}

export type RecommendationResult = {
    recommendations: Recommendation[]
    antiRecommendation: Recommendation
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
        if (rating.type === 'NUMERICAL') return rating.value > 75
        if (rating.type === 'TIER') return ['S', 'A', 'B'].includes(rating.tier || '')
        return false
    }).map(item => item.name)

    // Filter for disliked items
    const dislikedItems = userItems.filter(item => {
        const rating = item.ratings[0]
        if (!rating) return false
        if (rating.type === 'NUMERICAL') return rating.value < 40
        if (rating.type === 'TIER') return ['F', 'D'].includes(rating.tier || '')
        return false
    }).map(item => item.name)

    // 3. Construct Prompt
    const prompt = `
    I want THREE new recommendations and ONE anti-recommendation for items in the category: "${category.name}".
    
    Here are items I LIKE in this category:
    ${likedItems.length > 0 ? likedItems.join(', ') : 'No specific favorites yet.'}
    
    Here are items I DISLIKE in this category:
    ${dislikedItems.length > 0 ? dislikedItems.join(', ') : 'No specific dislikes yet.'}

    Please recommend THREE new items that I might enjoy, and ONE popular item I should AVOID based on my tastes.
    
    Provide the response in the following JSON format:
    {
      "recommendations": [
        { "name": "Item 1", "description": "Brief description", "reasoning": "Why you'd like it" },
        { "name": "Item 2", "description": "Brief description", "reasoning": "Why you'd like it" },
        { "name": "Item 3", "description": "Brief description", "reasoning": "Why you'd like it" }
      ],
      "antiRecommendation": {
        "name": "Item to Avoid",
        "description": "Brief description",
        "reasoning": "Why you probably won't like it based on your dislikes"
      }
    }
  `

    // 4. Call LLM
    try {
        const jsonResponse = await callLLM(prompt)
        const cleanJson = jsonResponse.replace(/```json/g, '').replace(/```/g, '').trim()
        const result = JSON.parse(cleanJson) as RecommendationResult
        return result
    } catch (error) {
        console.error('Recommendation Error:', error)
        // Fallback mock response
        return {
            recommendations: [
                {
                    name: `Mock Recommendation 1 for ${category.name}`,
                    description: "This is a fallback recommendation.",
                    reasoning: "Please configure your LLM API Key in Settings."
                },
                {
                    name: `Mock Recommendation 2 for ${category.name}`,
                    description: "This is a fallback recommendation.",
                    reasoning: "Please configure your LLM API Key in Settings."
                },
                {
                    name: `Mock Recommendation 3 for ${category.name}`,
                    description: "This is a fallback recommendation.",
                    reasoning: "Please configure your LLM API Key in Settings."
                }
            ],
            antiRecommendation: {
                name: "Mock Anti-Recommendation",
                description: "Something to avoid.",
                reasoning: "Based on your tastes, you probably won't like this."
            }
        }
    }
}
