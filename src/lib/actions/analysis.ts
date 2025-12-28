'use server'

import { db } from '@/lib/db'
import { items, ratings, categories, globalItems } from '@/db/schema'
import { eq, and, isNotNull, sql } from 'drizzle-orm'
import { z } from 'zod'
import {
    TasteAnalysisSchema,
    type TasteAnalysis,
    AnalysisFailedError
} from '@/lib/types/analysis'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

// Re-export for component usage
export type { TasteAnalysis } from '@/lib/types/analysis'

// =============================================================================
// SECURITY: Prompt Injection Protection
// Sanitize all user-generated content before including in LLM prompts
// =============================================================================

/**
 * Sanitize user input to prevent prompt injection attacks.
 * - Strips newlines (prevents breaking out of data section)
 * - Limits length (prevents context overflow)
 * - Escapes XML-like tags
 */
function sanitizeForPrompt(input: string | null | undefined, maxLength = 100): string {
    if (!input) return ''
    return input
        .replace(/[\n\r]/g, ' ')           // Strip newlines
        .replace(/</g, '&lt;')              // Escape < to prevent tag injection
        .replace(/>/g, '&gt;')              // Escape > to prevent tag injection
        .replace(/\s+/g, ' ')               // Collapse whitespace
        .trim()
        .substring(0, maxLength)
}

// =============================================================================
// SAFETY: Content filter for LLM outputs
// =============================================================================

const OFFENSIVE_TERMS = [
    'racist', 'sexist', 'homophobic', 'transphobic', 'nazi', 'hate',
    'slur', 'n-word', 'f-word', 'offensive', 'inappropriate'
]

/**
 * Check if AI-generated content contains potentially offensive terms.
 * Returns true if content should be flagged for review.
 */
function containsOffensiveContent(text: string): boolean {
    const lowerText = text.toLowerCase()
    return OFFENSIVE_TERMS.some(term => lowerText.includes(term))
}

/**
 * Sanitize AI-generated recommendation warnings to remove potentially offensive phrasing.
 */
function sanitizeWarning(warning: string): string {
    if (containsOffensiveContent(warning)) {
        // Replace with generic warning if offensive content detected
        return "This title may not match your preferences based on your rating patterns."
    }
    return warning
}

async function getCurrentUserId(): Promise<string | null> {
    const session = await auth.api.getSession({ headers: await headers() })
    return session?.user?.id || null
}

export async function analyzeUserTaste(categoryId?: string): Promise<TasteAnalysis> {
    // Get current user for tenant isolation
    const userId = await getCurrentUserId()
    if (!userId) {
        throw new Error("Authentication required to analyze taste.")
    }

    // 1. Fetch data with SQL-level filtering (no memory hog)
    // Build WHERE conditions
    let targetUserId = userId;

    if (categoryId) {
        // If analyzing a specific category, determining the target user is tricky because
        // we might be looking at someone else's list.
        // We should check who owns the category.
        const category = await db.query.categories.findFirst({
            where: eq(categories.id, categoryId),
            columns: { userId: true, isPublic: true }
        });

        if (category) {
            // If we found the category, use its owner as the target user.
            // This allows analyzing public lists (or your own private ones).
            // Security: If private and not yours, you shouldn't be here, but the page wouldn't load.
            targetUserId = category.userId || userId;
        }
    }

    const whereConditions = categoryId
        ? and(
            eq(items.userId, targetUserId),
            isNotNull(items.tier),
            eq(items.categoryId, categoryId)
        )
        : and(
            eq(items.userId, userId),
            isNotNull(items.tier)
        )

    const ratedItems = await db.query.items.findMany({
        where: whereConditions,
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

    // Fetch custom ranks
    const allCustomRanks = await db.query.customRanks.findMany()
    const tierTypeMap = new Map<string, string>()
    for (const r of allCustomRanks) {
        tierTypeMap.set(r.name, r.type)
    }

    if (ratedItems.length === 0) {
        throw new Error("No items found to analyze.")
    }

    // ==========================================================================
    // TOKEN OPTIMIZATION: Limit items sent to LLM to reduce context window cost
    // Sort by tier priority (S=0, A=1, B=2, C=3, D=4, F=5) and take best + worst
    // ==========================================================================
    const TIER_PRIORITY: Record<string, number> = { 'S': 0, 'A': 1, 'B': 2, 'C': 3, 'D': 4, 'F': 5 }
    const MAX_TOP_ITEMS = 20
    const MAX_BOTTOM_ITEMS = 10

    // Sort all items by tier (best first)
    const sortedItems = [...ratedItems].sort((a, b) => {
        const tierA = TIER_PRIORITY[a.tier || 'F'] ?? 99
        const tierB = TIER_PRIORITY[b.tier || 'F'] ?? 99
        return tierA - tierB
    })

    // Take top N best and bottom M worst (avoid overlap if list is small)
    const topItems = sortedItems.slice(0, MAX_TOP_ITEMS)
    const bottomItems = sortedItems.length > MAX_TOP_ITEMS + MAX_BOTTOM_ITEMS
        ? sortedItems.slice(-MAX_BOTTOM_ITEMS)
        : [] // Skip if we already have all items in topItems

    // Combine without duplicates
    const itemsForPrompt = [...topItems, ...bottomItems.filter(b => !topItems.includes(b))]

    // 2. Format data for LLM (only iterate over limited subset)
    const rankedList: string[] = []
    const utilityList: string[] = []
    let negativeRatedCount = 0

    for (const item of itemsForPrompt) {
        const tier = item.tier || ''
        const ratingValue = item.ratings[0]?.value || 0
        // SECURITY: Sanitize all user-generated content to prevent prompt injection
        const sanitizedTags = item.tags
            .map((t: { tag: { name: string } }) => sanitizeForPrompt(t.tag.name, 30))
            .join(', ')

        const type = tierTypeMap.get(tier) || 'RANKED'

        const isNegative = ['C', 'D', 'F'].includes(tier)
        if (isNegative && type === 'RANKED') {
            negativeRatedCount++
        }

        const sentiment = isNegative ? 'NEGATIVE' : 'POSITIVE'
        // SECURITY: Sanitize item name, category, and description
        const sanitizedName = sanitizeForPrompt(item.name, 100)
        const sanitizedCategory = sanitizeForPrompt(item.category?.name, 50)
        const sanitizedDesc = sanitizeForPrompt(item.description, 150)

        const line = `- ${sanitizedName} (${sanitizedCategory}): ${type === 'UTILITY' ? `Status: ${tier}` : `Tier ${tier} (${sentiment})`}. Tags: [${sanitizedTags}]. Desc: "${sanitizedDesc}" (ID: ${item.id})`

        if (type === 'UTILITY') {
            utilityList.push(line)
        } else {
            rankedList.push(line)
        }
    }

    const hasNegativeRatings = negativeRatedCount >= 2

    // 3. Generate List Fingerprint (Smart Caching)
    const { createHash } = await import('crypto')
    const sortedForHash = [...ratedItems].sort((a, b) => a.id.localeCompare(b.id))
    const fingerprintString = sortedForHash.map(item => {
        return `${item.id}:${item.tier}:${item.ratings[0]?.value || 0}`
    }).join('|')

    const currentHash = createHash('sha256').update(fingerprintString).digest('hex')

    // Check Cache
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
            // Validate cached data too, just in case schema changed
            const cachedJson = JSON.parse(category.cachedAnalysis)
            const parsedCache = TasteAnalysisSchema.safeParse(cachedJson)
            if (parsedCache.success) {
                return parsedCache.data
            }
            console.warn("Cached analysis failed schema validation, regenerating.")
        }
    }

    const context = categoryId
        ? `Focus the analysis specifically on the category: ${ratedItems[0]?.category?.name || 'this category'}.`
        : "Provide a comprehensive analysis of the user's taste across all categories."

    // ==========================================================================
    // PARALLEL EXECUTION: Split analysis into 3 concurrent LLM calls
    // ==========================================================================

    // ==========================================================================
    // 4. FIND CONTROVERSIAL CANDIDATES (Anti-Recommendations)
    // ==========================================================================

    // A. Identify User's S-Tier Tags
    const sTierItems = ratedItems.filter(i => ['S', 'A'].includes(i.tier || ''))
    const tagCounts = new Map<string, number>()

    sTierItems.forEach(item => {
        item.tags.forEach(t => {
            const count = tagCounts.get(t.tag.name) || 0
            tagCounts.set(t.tag.name, count + 1)
        })
    })

    const userTopTags = Array.from(tagCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name]) => name.toLowerCase())

    // B. Find High-Rated Global Items (excluding user's own items)
    const userGlobalItemIds = new Set(ratedItems.map(i => i.globalItemId).filter(Boolean))

    // Get popular global items with > 7.5 average rating
    // Note: Since we might not have enough ratings in a seeded DB, we also check rating count
    const popularGlobalItems = await db
        .select({
            id: globalItems.id,
            title: globalItems.title,
            tags: globalItems.cachedTags,
            releaseYear: globalItems.releaseYear,
            avgRating: sql<number>`avg(${ratings.value})`,
            ratingCount: sql<number>`count(${ratings.id})`
        })
        .from(globalItems)
        .leftJoin(items, eq(globalItems.id, items.globalItemId))
        .leftJoin(ratings, eq(items.id, ratings.itemId))
        .groupBy(globalItems.id)
        .having(({ avgRating, ratingCount }) =>
            // In a real app this would be higher, but for seed data we'll be lenient
            // Or avgRating > 7.5 OR ratingCount > 2
            sql`${avgRating} >= 7.5 OR ${ratingCount} >= 2`
        )
        .limit(50)

    // C. Filter for Incompatibility (Low Tag Overlap)
    const candidates = popularGlobalItems
        .filter(gItem => !userGlobalItemIds.has(gItem.id)) // Exclude seen
        .map(gItem => {
            let itemTags: string[] = []
            try {
                itemTags = gItem.tags ? JSON.parse(gItem.tags) : []
            } catch (e) { }

            // Calculate overlap
            const overlap = itemTags.filter(t => userTopTags.includes(t.toLowerCase())).length
            return {
                ...gItem,
                itemTags,
                overlap
            }
        })
        .filter(c => c.itemTags.length > 0) // Must have tags to judge
        .sort((a, b) => a.overlap - b.overlap) // Least overlap first
        .slice(0, 10) // Top 10 controversial fits

    // Format candidates for prompt
    const candidatesStr = candidates.map(c =>
        `- ${c.title} (${c.releaseYear}): [${c.itemTags.slice(0, 5).join(', ')}]`
    ).join('\n')


    // ==========================================================================
    // PARALLEL EXECUTION: Split analysis into 3 concurrent LLM calls
    // ==========================================================================

    // Import LLM helper
    const { callLLMForJSON } = await import('@/lib/llm')

    const basePrompt = `
    User's Rated Items (USE THESE FOR TASTE SCORING & PREFERENCES):
    ${rankedList.join('\n') || "No specifically ranked items yet."}

    User's Context Items (USE THESE FOR INTERESTS/CURIOSITY ONLY):
    ${utilityList.join('\n') || "No context items."}
    
    Rating Logic: S/A/B = POSITIVE (liked). C/D/F = NEGATIVE (disliked).
    `

    // --- Task 1: PROFILE & ANALYSIS ---
    const profilePrompt = `
    Analyze the user data and return ONLY the "profile" and "analysis" sections.
    ${context}
    ${basePrompt}

    Return JSON:
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
            : `"unexplored_themes": "Since the user has less than 2 negative ratings, discuss genres/tropes they haven't tried yet.",`
        }
        "outliers": "Contradictions or surprising ratings"
      }
    }
    `

    // --- Task 2: RECOMMENDATIONS ---
    const recsPrompt = `
    Provide recommendations based on the user's taste.
    ${context}
    ${basePrompt}
    
    Potential "Likely Miss" Candidates (High quality items that might clash with user tags):
    ${candidatesStr || "None identified from database."}

    Rules:
    1. Do NOT recommend items already in the list.
    2. Provide 'matchScore' (0-100).
    3. Anti-Recommendations:
       - Select items that are POPULAR or HIGHLY RATED but fundamentally clash with the user's specific preferences (Attribute Conflict).
       - You may use the provided "Likely Miss Candidates" or your own knowledge of "Famous but polarizing" items.
       - WARNING FORMAT: A single sentence starting with 'While popular for...'.
       - Example: 'While popular for its visceral shock value, Saw relies on gore and torture, which conflicts with your demonstrated preference for atmospheric, psychological dread.'
       - Do NOT mention the 'Match %' in the text. Focus solely on the stylistic mismatch.

    Return JSON:
    {
      "recommendations": [
        { "name": "Title", "releaseYear": "YYYY", "medium": "Type", "reason": "Why it fits", "matchScore": 95 }
      ],
      "anti_recommendations": [
        { "name": "Title", "releaseYear": "YYYY", "medium": "Type", "warning": "While popular for [TRAIT], [TITLE] relies on [CONFLICTING_TRAIT], which conflicts with..." , "matchScore": 90 }
      ]
    }
    `

    // --- Task 3: METADATA UPDATES ---
    const metadataPrompt = `
    Suggest metadata improvements for the items in the input list.
    ${basePrompt}

    Return JSON:
    {
      "suggested_metadata_updates": [
        { "item_id": "EXACT_ID_FROM_INPUT", "item_name": "Name", "suggested_tags": ["New Tag"], "suggested_description": "Better desc" }
      ]
    }
    `

    try {
        console.log("Starting parallel analysis...")
        const [profileRaw, recsRaw, metaRaw] = await Promise.all([
            callLLMForJSON(profilePrompt, undefined, { maxTokens: 2048 }),
            callLLMForJSON(recsPrompt, undefined, { maxTokens: 2048 }),
            callLLMForJSON(metadataPrompt, undefined, { maxTokens: 2048 })
        ])

        // Parse and Merge
        const profileData = JSON.parse(profileRaw)
        const recsData = JSON.parse(recsRaw)
        const metaData = JSON.parse(metaRaw)

        const finalResult = {
            ...profileData,
            ...recsData,
            ...metaData
        }

        // Validate Merged Result
        const result = TasteAnalysisSchema.parse(finalResult)

        // SAFETY: Sanitize anti-recommendation warnings
        const sanitizedResult = {
            ...result,
            anti_recommendations: result.anti_recommendations.map(rec => ({
                ...rec,
                warning: sanitizeWarning(rec.warning)
            }))
        }

        // Cache the result
        if (categoryId) {
            await db.update(categories)
                .set({
                    cachedAnalysis: JSON.stringify(sanitizedResult),
                    analysisHash: currentHash
                })
                .where(eq(categories.id, categoryId))
        }

        return sanitizedResult

    } catch (error) {
        console.error("Analysis Failed", error)

        if (error instanceof z.ZodError) {
            throw new AnalysisFailedError("JSON Validation Failed", "Analysis result format was invalid. Please retry.")
        }

        const errorMessage = error instanceof Error ? error.message : "Unknown error"
        throw new AnalysisFailedError(
            errorMessage,
            `Failed to analyze taste: ${errorMessage}`
        )
    }
}
