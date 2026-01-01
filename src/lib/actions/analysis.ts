'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentUserId } from '@/lib/auth'
import { z } from 'zod'
import {
    TasteAnalysisSchema,
    type TasteAnalysis,
    AnalysisFailedError
} from '@/lib/types/analysis'

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

/**
 * Safely parse JSON with repair attempts for common LLM formatting errors.
 * Returns empty object if all repairs fail (graceful fallback for non-critical data).
 */
function safeParseJSON(raw: string, label: string, throwOnFail = true): Record<string, unknown> {
    // First, try direct parse
    try {
        return JSON.parse(raw)
    } catch {
        console.warn(`[${label}] Direct parse failed, attempting repair...`)
    }

    // Repair attempt 1: Fix trailing commas before ] or }
    let repaired = raw.replace(/,\s*([\]}])/g, '$1')

    // Repair attempt 2: Fix unescaped newlines in strings
    repaired = repaired.replace(/(?<!\\)\n/g, '\\n')

    // Repair attempt 3: Remove control characters
    repaired = repaired.replace(/[\x00-\x1F\x7F]/g, (char) =>
        char === '\n' || char === '\r' || char === '\t' ? char : ''
    )

    try {
        return JSON.parse(repaired)
    } catch {
        console.warn(`[${label}] Repair attempt 1 failed, trying deeper repair...`)
    }

    // Repair attempt 4: Extract just the JSON object/array
    const jsonMatch = raw.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)
    if (jsonMatch) {
        try {
            let extracted = jsonMatch[1]
            // Fix trailing commas
            extracted = extracted.replace(/,\s*([\]}])/g, '$1')
            return JSON.parse(extracted)
        } catch {
            console.warn(`[${label}] JSON extraction failed`)
        }
    }

    // Final fallback: return empty object or throw based on criticality
    if (!throwOnFail) {
        console.warn(`[${label}] All repairs failed, returning empty object`)
        return {}
    }
    throw new Error(`Failed to parse ${label} JSON after repair attempts. Raw length: ${raw.length}`)
}

export async function analyzeUserTaste(categoryId?: string): Promise<TasteAnalysis> {
    // Get current user for tenant isolation
    const userId = await getCurrentUserId()
    if (!userId) {
        throw new Error("Authentication required to analyze taste.")
    }

    const supabase = await createClient()

    // 1. Fetch data with SQL-level filtering (no memory hog)
    let targetUserId = userId;

    if (categoryId) {
        // If analyzing a specific category, check who owns it
        const { data: category } = await (supabase.from('categories') as any)
            .select('user_id, is_public')
            .eq('id', categoryId)
            .single()

        if (category) {
            targetUserId = category.user_id || userId;
        }
    }

    // Fetch rated items with relations (including global_items for metadata)
    let query = (supabase.from('items') as any)
        .select(`
            id, name, description, tier, elo_score, global_item_id, user_id, metadata,
            category:categories(id, name),
            ratings(*),
            items_to_tags(tag:tags(id, name)),
            global_item:global_items(id, title, description, cached_tags, release_year, metadata, source)
        `)
        .eq('user_id', targetUserId)
        .not('tier', 'is', null)

    if (categoryId) {
        query = query.eq('category_id', categoryId)
    }

    const { data: ratedItems, error: itemsError } = await query

    if (itemsError) throw itemsError

    // Fetch custom ranks
    const { data: allCustomRanks } = await (supabase.from('custom_ranks') as any)
        .select('name, type')

    const tierTypeMap = new Map<string, string>()
    for (const r of allCustomRanks || []) {
        tierTypeMap.set(r.name, r.type)
    }

    if (!ratedItems || ratedItems.length === 0) {
        throw new Error("No items found to analyze.")
    }

    // Build explicit exclusion list (by name, case-insensitive)
    const userRatedItemNames = new Set(
        (ratedItems as any[]).map((i: any) => i.name?.toLowerCase().trim()).filter(Boolean)
    )

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

    // DEBUG: Log first item to see data structure
    if (itemsForPrompt.length > 0) {
        console.log('[Analysis] Sample item data:', JSON.stringify(itemsForPrompt[0], null, 2))
    }

    for (const item of itemsForPrompt) {
        const tier = item.tier || ''
        const globalItem = item.global_item as any

        // Get name from global_item.title (preferred) or item.name (fallback)
        const itemName = globalItem?.title || item.name || 'Unknown'

        // Get description from global_item.description (preferred) or item.description (fallback)
        const itemDescription = globalItem?.description || item.description || ''

        // Get tags: prefer global_item.cached_tags, then metadata.genres/tags, then items_to_tags
        let tagsList: string[] = []
        if (globalItem?.cached_tags) {
            try {
                const cachedTags = typeof globalItem.cached_tags === 'string'
                    ? JSON.parse(globalItem.cached_tags)
                    : globalItem.cached_tags
                if (Array.isArray(cachedTags)) {
                    tagsList = cachedTags
                }
            } catch { }
        }
        // Fallback: extract from metadata.genres and metadata.tags
        if (tagsList.length === 0 && globalItem?.metadata) {
            try {
                const meta = typeof globalItem.metadata === 'string'
                    ? JSON.parse(globalItem.metadata)
                    : globalItem.metadata
                if (Array.isArray(meta.genres)) {
                    tagsList.push(...meta.genres)
                }
                if (Array.isArray(meta.tags)) {
                    tagsList.push(...meta.tags.slice(0, 10))
                }
            } catch { }
        }
        // Final fallback: items_to_tags relationship
        if (tagsList.length === 0) {
            tagsList = ((item.items_to_tags as any[]) || [])
                .map((t: any) => t.tag?.name)
                .filter(Boolean)
        }

        // Get additional metadata from global_item.metadata JSONB
        const releaseYear = globalItem?.release_year || ''
        let globalMetadata: any = {}
        if (globalItem?.metadata) {
            try {
                globalMetadata = typeof globalItem.metadata === 'string'
                    ? JSON.parse(globalItem.metadata)
                    : globalItem.metadata
            } catch { }
        }
        const genre = globalMetadata?.genre || globalMetadata?.genres?.join(', ') || ''
        const medium = globalMetadata?.medium || globalMetadata?.type || globalItem?.source || ''

        // Parse item.metadata for externalId, year, type if available
        let itemMetadata: any = {}
        if (item.metadata) {
            try {
                itemMetadata = typeof item.metadata === 'string'
                    ? JSON.parse(item.metadata)
                    : item.metadata
            } catch { }
        }

        // SECURITY: Sanitize all user-generated content
        const sanitizedTags = tagsList
            .map((t: string) => sanitizeForPrompt(t, 30))
            .filter(Boolean)
            .join(', ')

        const type = tierTypeMap.get(tier) || 'RANKED'

        const isNegative = ['C', 'D', 'F'].includes(tier)
        if (isNegative && type === 'RANKED') {
            negativeRatedCount++
        }

        const sentiment = isNegative ? 'NEGATIVE' : 'POSITIVE'
        const sanitizedName = sanitizeForPrompt(itemName, 100)
        const sanitizedCategory = sanitizeForPrompt((item.category as any)?.name, 50)
        const sanitizedDesc = sanitizeForPrompt(itemDescription, 200)
        const yearInfo = releaseYear || itemMetadata?.year ? ` (${releaseYear || itemMetadata?.year})` : ''
        const genreInfo = genre ? ` Genre: ${sanitizeForPrompt(genre, 50)}.` : ''
        const mediumInfo = medium ? ` Medium: ${sanitizeForPrompt(medium, 30)}.` : ''

        const line = `- ${sanitizedName}${yearInfo} [${sanitizedCategory}]: ${type === 'UTILITY' ? `Status: ${tier}` : `Tier ${tier} (${sentiment})`}. Tags: [${sanitizedTags}].${genreInfo}${mediumInfo} Desc: "${sanitizedDesc}" (ID: ${item.id})`

        if (type === 'UTILITY') {
            utilityList.push(line)
        } else {
            rankedList.push(line)
        }
    }

    // DEBUG: Log formatted data being sent to LLM
    console.log('[Analysis] Ranked items for prompt:', rankedList.slice(0, 3))
    console.log('[Analysis] Total items:', itemsForPrompt.length)

    const hasNegativeRatings = negativeRatedCount >= 2

    // 3. Generate List Fingerprint (Smart Caching)
    const { createHash } = await import('crypto')
    const sortedForHash = [...ratedItems].sort((a, b) => a.id.localeCompare(b.id))
    const fingerprintString = sortedForHash.map(item => {
        return `${item.id}:${item.tier}:${(item.ratings as any[])?.[0]?.value || 0}`
    }).join('|')

    const currentHash = createHash('sha256').update(fingerprintString).digest('hex')

    // Check Cache
    if (categoryId) {
        const { data: category } = await (supabase.from('categories') as any)
            .select('cached_analysis, analysis_hash')
            .eq('id', categoryId)
            .single()

        if (category?.cached_analysis && category?.analysis_hash === currentHash) {
            console.log("Returning cached analysis for category:", categoryId)
            // Validate cached data too, just in case schema changed
            const cachedJson = JSON.parse(category.cached_analysis)
            const parsedCache = TasteAnalysisSchema.safeParse(cachedJson)
            if (parsedCache.success) {
                return parsedCache.data
            }
            console.warn("Cached analysis failed schema validation, regenerating.")
        }
    }

    const context = categoryId
        ? `Focus the analysis specifically on the category: ${(ratedItems[0]?.category as any)?.name || 'this category'}.`
        : "Provide a comprehensive analysis of the user's taste across all categories."

    // ==========================================================================
    // 4. FIND CONTROVERSIAL CANDIDATES (Anti-Recommendations)
    // ==========================================================================

    // A. Identify User's S-Tier Tags (from global_items.cached_tags or items_to_tags)
    const sTierItems = (ratedItems as any[]).filter((i: any) => ['S', 'A'].includes(i.tier || ''))
    const tagCounts = new Map<string, number>()

    sTierItems.forEach((item: any) => {
        // First try global_item.cached_tags
        const globalItem = item.global_item as any
        let tags: string[] = []

        if (globalItem?.cached_tags) {
            try {
                const cachedTags = typeof globalItem.cached_tags === 'string'
                    ? JSON.parse(globalItem.cached_tags)
                    : globalItem.cached_tags
                if (Array.isArray(cachedTags)) {
                    tags = cachedTags
                }
            } catch { }
        }

        // Fallback: extract from metadata.genres and metadata.tags
        if (tags.length === 0 && globalItem?.metadata) {
            try {
                const meta = typeof globalItem.metadata === 'string'
                    ? JSON.parse(globalItem.metadata)
                    : globalItem.metadata
                if (Array.isArray(meta.genres)) {
                    tags.push(...meta.genres)
                }
                if (Array.isArray(meta.tags)) {
                    tags.push(...meta.tags.slice(0, 10))
                }
            } catch { }
        }

        // Final fallback: items_to_tags relationship
        if (tags.length === 0) {
            tags = ((item.items_to_tags as any[]) || [])
                .map((t: any) => t.tag?.name)
                .filter(Boolean)
        }

        // Count each tag
        tags.forEach(tagName => {
            if (tagName) {
                const count = tagCounts.get(tagName) || 0
                tagCounts.set(tagName, count + 1)
            }
        })
    })

    const userTopTags = Array.from(tagCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name]) => name.toLowerCase())

    // B. Find High-Rated Global Items (excluding user's own items)
    const userGlobalItemIds = new Set((ratedItems as any[]).map((i: any) => i.global_item_id).filter(Boolean))

    // Get popular global items - simplified query for Supabase
    const { data: popularGlobalItems } = await (supabase.from('global_items') as any)
        .select('id, title, cached_tags, release_year')
        .limit(50)

    // C. Filter for Incompatibility (Low Tag Overlap)
    const candidates = (popularGlobalItems || [])
        .filter((gItem: any) => {
            // Exclude by global_item_id
            if (userGlobalItemIds.has(gItem.id)) return false
            // Exclude by name (case-insensitive)
            if (userRatedItemNames.has(gItem.title?.toLowerCase().trim())) return false
            return true
        })
        .map((gItem: any) => {
            let itemTags: string[] = []
            try {
                itemTags = gItem.cached_tags ? JSON.parse(gItem.cached_tags) : []
            } catch { }

            // Calculate overlap
            const overlap = itemTags.filter(t => userTopTags.includes(t.toLowerCase())).length
            return {
                ...gItem,
                itemTags,
                overlap
            }
        })
        .filter((c: any) => c.itemTags.length > 0) // Must have tags to judge
        .sort((a: any, b: any) => a.overlap - b.overlap) // Least overlap first
        .slice(0, 10) // Top 10 controversial fits

    // Format candidates for prompt
    const candidatesStr = candidates.map((c: any) =>
        `- ${c.title} (${c.release_year}): [${c.itemTags.slice(0, 5).join(', ')}]`
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
    // Create explicit exclusion list for LLM
    const excludedItemsList = Array.from(userRatedItemNames).slice(0, 30).join(', ')

    // Get category name for category-specific rules
    const categoryName = (ratedItems[0]?.category as any)?.name?.toLowerCase() || ''
    const isTVShows = categoryName.includes('tv') || categoryName.includes('show')

    // Category-specific instructions
    const categorySpecificRules = isTVShows
        ? `
    TV SHOWS CATEGORY RULES:
    4. ONLY recommend COMPLETE SERIES - NEVER specific seasons like "True Detective (Season 1)", "Mindhunter (Season 2+)", "Fargo (Season 2)", etc.
    5. If a show has multiple seasons, recommend the SHOW NAME ONLY (e.g., "True Detective" not "True Detective (Season 1)").
    6. NEVER recommend anime series for TV Shows - anime belongs in a separate category.
    7. Focus on live-action Western TV series only.
        `
        : ''

    const recsPrompt = `
    Provide recommendations based on the user's taste.
    ${context}
    ${basePrompt}
    
    Potential "Likely Miss" Candidates (High quality items that might clash with user tags):
    ${candidatesStr || "None identified from database."}

    ⚠️ CRITICAL EXCLUSION LIST - The user has ALREADY RATED these items. NEVER recommend them in EITHER section:
    ${excludedItemsList}

    Rules:
    1. ⚠️ NEVER recommend items from the exclusion list above IN EITHER recommendations OR anti_recommendations - these are items the user has ALREADY RATED.
    2. Provide 'matchScore' (0-100).
    3. Anti-Recommendations ("Likely Misses"):
       - MUST NOT include any items from the exclusion list above.
       - Select items that are POPULAR or HIGHLY RATED but fundamentally clash with the user's specific preferences (Attribute Conflict).
       - You may use the provided "Likely Miss Candidates" or your own knowledge of "Famous but polarizing" items.
       - WARNING FORMAT: A single sentence starting with 'While popular for...'.
       - Example: 'While popular for its visceral shock value, Saw relies on gore and torture, which conflicts with your demonstrated preference for atmospheric, psychological dread.'
       - Do NOT mention the 'Match %' in the text. Focus solely on the stylistic mismatch.
    ${categorySpecificRules}

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

        // Parse and Merge with repair for malformed LLM responses
        // Profile and recommendations are critical, metadata is optional
        const profileData = safeParseJSON(profileRaw, 'profile')
        const recsData = safeParseJSON(recsRaw, 'recommendations')
        const metaData = safeParseJSON(metaRaw, 'metadata', false)  // Graceful fallback for metadata

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
            anti_recommendations: (result.anti_recommendations || []).map(rec => ({
                ...rec,
                warning: sanitizeWarning(rec.warning || rec.reason || 'May not match your preferences')
            }))
        }

        // Cache the result
        if (categoryId) {
            await (supabase.from('categories') as any)
                .update({
                    cached_analysis: JSON.stringify(sanitizedResult),
                    analysis_hash: currentHash
                })
                .eq('id', categoryId)
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
