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
        low_rated_patterns?: string
        unexplored_themes?: string
        outliers: string
    }
    recommendations: {
        name: string
        releaseYear: string
        medium: string
        reason: string
        matchScore: number
    }[]
    anti_recommendations: {
        name: string
        releaseYear: string
        medium: string
        warning: string
        matchScore: number
    }[]
    suggested_metadata_updates: {
        item_id: string
        item_name: string
        suggested_tags: string[]
        suggested_description: string
    }[]
}

export async function analyzeUserTaste(categoryId?: string): Promise<TasteAnalysis> {
    // 1. Fetch data (unchanged)
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

    // Fetch custom ranks (unchanged)
    const allCustomRanks = await db.query.customRanks.findMany()
    const tierTypeMap = new Map<string, string>()
    for (const r of allCustomRanks) {
        tierTypeMap.set(r.name, r.type)
    }

    // Filter items (unchanged)
    let ratedItems = allItems.filter(item => item.ratings.length > 0)
    if (categoryId) {
        ratedItems = ratedItems.filter(item => item.categoryId === categoryId)
    }

    if (ratedItems.length === 0) {
        throw new Error("No items found to analyze.")
    }

    // 2. Format data for LLM
    const rankedList: string[] = []
    const utilityList: string[] = []
    let negativeRatedCount = 0

    for (const item of ratedItems) {
        const rating = item.ratings[0]
        const tier = rating.tier || ''
        const ratingValue = rating.value
        const tags = item.tags.map((t: { tag: { name: string } }) => t.tag.name).join(', ')

        const type = tierTypeMap.get(tier) || 'RANKED'

        const isNegative = ['C', 'D', 'F'].includes(tier)
        if (isNegative && type === 'RANKED') {
            negativeRatedCount++
        }

        const sentiment = isNegative ? 'NEGATIVE' : 'POSITIVE'
        const line = `- ${item.name} (${item.category?.name}): ${type === 'UTILITY' ? `Status: ${tier}` : `Tier ${tier} (${sentiment})`}. Tags: [${tags}]. Description: "${item.description || ''}" (ID: ${item.id})`

        if (type === 'UTILITY') {
            utilityList.push(line)
        } else {
            rankedList.push(line)
        }
    }

    const hasNegativeRatings = negativeRatedCount >= 2

    // 3. Generate List Fingerprint (Smart Caching)
    const { createHash } = await import('crypto')

    // Sort items by ID to ensure consistent order for hashing regardless of DB return order
    const sortedForHash = [...ratedItems].sort((a, b) => a.id.localeCompare(b.id))

    const fingerprintString = sortedForHash.map(item => {
        const r = item.ratings[0]
        return `${item.id}:${r.tier}:${r.value}`
    }).join('|')

    const currentHash = createHash('sha256').update(fingerprintString).digest('hex')

    // Check Cache if categoryId exists
    if (categoryId) {
        const category = await db.query.categories.findFirst({
            where: eq(categories.id, categoryId),
            columns: {
                cachedAnalysis: true,
                analysisHash: true
            }
        })

        if (category?.cachedAnalysis && category?.analysisHash === currentHash) {
            console.log("Returning cached analysis for category:", categoryId)
            return JSON.parse(category.cachedAnalysis) as TasteAnalysis
        }
    }

    const context = categoryId
        ? `Focus the analysis specifically on the category: ${ratedItems[0]?.category?.name || 'this category'}.`
        : "Provide a comprehensive analysis of the user's taste across all categories."

    const prompt = `
    Analyze the following user data and provide a "Taste Report Card".
    ${context}
    
    User's Rated Items (USE THESE FOR TASTE SCORING & PREFERENCES):
    ${rankedList.join('\n') || "No specifically ranked items yet."}

    User's Context Items (USE THESE FOR INTERESTS/CURIOSITY ONLY, DO NOT TREAT AS WATCHED/PLAYED/RATED):
    ${utilityList.join('\n') || "No context items."}
    
    IMPORTANT RULES: 
    1. **Rating Logic**: Treat S, A, and B tiers as POSITIVE (liked). Treat C, D, and F tiers as NEGATIVE (disliked).
    2. Do NOT recommend items already in either list.
    3. **BOLD** key genres, tropes, and descriptors in the Profile Summary using markdown.
    4. **Data Enforcement**: You MUST provide 'releaseYear', 'medium' (e.g. Anime, Movie, Game), and 'matchScore' (0-100) for ALL recommendations and anti-recommendations.
    5. **Anti-Recommendations**: 'matchScore' here represents the RISK/MISMATCH level (higher = worse fit).
    6. **Avoid Seasons**: Do NOT recommend specific 'Seasons' (e.g. "Overlord II", "Season 3"). Recommend the Franchise/Series name or a different unique work.
    
    Return a JSON object with this structure:
    {
      "profile": {
        "summary": "2-3 sentence summary. BOLD key terms.",
        "top_genres": ["Genre 1", "Genre 2"],
        "visual_style": "Description",
        "narrative_preference": "Description"
      },
      "analysis": {
        "high_rated_patterns": "Commonalities in S, A, and B tier items.",
        ${hasNegativeRatings
            ? `"low_rated_patterns": "Commonalities in C, D, and F tier items. What turns the user off?",`
            : `"unexplored_themes": "Since the user has less than 2 negative ratings, discuss genres/tropes they haven't tried yet that might offer 'Room for Growth'.",`
        }
        "outliers": "Contradictions or surprising ratings"
      },
      "recommendations": [
        { "name": "Title", "releaseYear": "YYYY", "medium": "Type", "reason": "Why it fits", "matchScore": 95 }
      ],
      "anti_recommendations": [
        { "name": "Title", "releaseYear": "YYYY", "medium": "Type", "warning": "Why avoid (specific mismatch)", "matchScore": 90 }
      ],
      "suggested_metadata_updates": [
        { "item_id": "EXACT_ID_FROM_INPUT", "item_name": "Name", "suggested_tags": ["New Tag"], "suggested_description": "Better desc" }
      ]
    }
    `

    // 4. Call LLM
    try {
        const response = await callLLM(prompt)

        // Clean up response if it contains markdown code blocks
        const jsonStr = response.replace(/```json\n?|\n?```/g, '').trim()

        const analysis = JSON.parse(jsonStr) as TasteAnalysis

        // Cache the result if we are in a specific category
        if (categoryId) {
            await db.update(categories)
                .set({
                    cachedAnalysis: jsonStr,
                    analysisHash: currentHash
                })
                .where(eq(categories.id, categoryId))
        }

        return analysis
    } catch (error) {
        console.error("Analysis failed:", error)
        throw new Error("Failed to analyze taste. Please try again.")
    }
}
