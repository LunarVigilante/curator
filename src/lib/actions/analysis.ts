'use server'

import { db } from '@/lib/db'
import { items, ratings, categories } from '@/db/schema'
import { eq, desc, isNotNull } from 'drizzle-orm'
import { callLLM } from '@/lib/llm'

export interface TasteAnalysis {
    profile: {
        summary: string
        top_genres: string[]
        visual_style: string
        narrative_preference: string
    }
    analysis: {
        high_rated_patterns: string
        low_rated_patterns: string
        outliers: string
    }
    recommendations: {
        name: string
        category: string
        reason: string
        confidence: number
    }[]
    anti_recommendations: {
        name: string
        warning: string
    }[]
    suggested_metadata_updates: {
        item_name: string
        suggested_tags: string[]
        suggested_description: string
    }[]
}

export async function analyzeUserTaste(categoryId?: string): Promise<TasteAnalysis> {
    // 1. Fetch data
    const allItems = await db.query.items.findMany({
        with: {
            ratings: true,
            category: true,
            tags: {
                with: {
                    tag: true
                }
            }
        }
    })

    // Filter for items that have ratings
    let ratedItems = allItems.filter(item => item.ratings.length > 0)

    // If categoryId is provided, filter by category
    if (categoryId) {
        ratedItems = ratedItems.filter(item => item.categoryId === categoryId)
    }

    if (ratedItems.length === 0) {
        throw new Error("No rated items found. Rate some items first!")
    }

    // 2. Format data for LLM
    const itemsList = ratedItems.map((item: typeof allItems[0]) => {
        const rating = item.ratings[0] // Assuming single user for now
        const ratingValue = rating.value
        const tier = rating.tier
        const tags = item.tags.map((t: { tag: { name: string } }) => t.tag.name).join(', ')

        return `- ${item.name} (${item.category?.name}): Rating ${ratingValue}/10 (Tier ${tier || 'N/A'}). Tags: [${tags}]. Description: "${item.description || ''}"`
    }).join('\n')

    const context = categoryId
        ? `Focus the analysis specifically on the category: ${ratedItems[0]?.category?.name || 'this category'}.`
        : "Provide a comprehensive analysis of the user's taste across all categories, including hobbies and interests that might align with their rankings."

    const prompt = `
    Analyze the following user tier list and provide a "Taste Report Card".
    ${context}
    
    User's Rated Items:
    ${itemsList}
    
    IMPORTANT: 
    1. Do NOT recommend any items that are already in the User's Rated Items list.
    2. If recommending a show/game that has multiple versions/seasons (e.g. Hunter x Hunter), specify the year or version to avoid ambiguity.
    3. For recommendations, suggest the most appropriate category for the item.
    
    Return a JSON object with the following structure:
    {
      "profile": {
        "summary": "2-3 sentence summary of their taste, including potential hobbies/interests",
        "top_genres": ["Genre 1", "Genre 2"],
        "visual_style": "Description of preferred visual styles",
        "narrative_preference": "Description of preferred story types"
      },
      "analysis": {
        "high_rated_patterns": "What do their high-rated items have in common?",
        "low_rated_patterns": "What do their low-rated items have in common?",
        "outliers": "Any ratings that seem contradictory?"
      },
      "recommendations": [
        { "name": "Title (Year/Version)", "category": "Category Name", "reason": "Why they would like it", "confidence": 0.9 }
      ],
      "anti_recommendations": [
        { "name": "Title", "warning": "Why they should avoid it" }
      ],
      "suggested_metadata_updates": [
        { "item_name": "Name from list", "suggested_tags": ["New Tag"], "suggested_description": "Better description" }
      ]
    }
    `

    // 3. Call LLM
    try {
        const response = await callLLM(prompt)

        // Clean up response if it contains markdown code blocks
        const jsonStr = response.replace(/```json\n?|\n?```/g, '').trim()

        const analysis = JSON.parse(jsonStr) as TasteAnalysis
        return analysis
    } catch (error) {
        console.error("Analysis failed:", error)
        throw new Error("Failed to analyze taste. Please try again.")
    }
}
