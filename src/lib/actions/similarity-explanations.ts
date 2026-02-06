'use server'

import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { callLLMForJSON } from '@/lib/llm'
import { SystemConfigService } from '@/lib/services/SystemConfigService'

/**
 * Similarity explanation with structured data for glanceable tooltip
 */
export interface SimilarityExplanation {
    summary: string           // Narrative Bridge ("Why you'll like it")
    sharedDNA: string[]       // Passed from RPC (Green Chips)
    keyDifference: string | null  // Contrast Warning ("The Wedge")
}

/**
 * Item metadata for comparison
 */
interface ItemMetadata {
    id: string
    title: string
    description: string | null
    genres: string[] | null
    cached_tags: { id: string; name: string }[] | null
    category_type: string | null
    release_year: number | null
    vote_average: number | null
}

// Model context limits (in tokens, ~4 chars per token)
const MODEL_CONTEXT_LIMITS: Record<string, number> = {
    'mistralai/ministral-3b': 128000,
    'mistralai/ministral-8b': 128000,
    'mistralai/mistral-small': 32000,  // Ministral Small Creative
    'gpt-4o': 128000,
    'gpt-4o-mini': 128000,
    'claude-3-sonnet': 200000,
    'claude-3-opus': 200000,
    'default': 32000  // Conservative default
}

/**
 * Estimate token count (rough approximation: ~4 chars per token)
 */
function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4)
}

/**
 * Truncate text to fit within token limit, keeping beginning and end
 */
function truncateToTokenLimit(text: string, maxTokens: number): string {
    const currentTokens = estimateTokens(text)
    if (currentTokens <= maxTokens) return text

    // Calculate how many characters we can keep
    const maxChars = maxTokens * 4
    const keepEach = Math.floor((maxChars - 20) / 2)  // 20 chars for "..."

    if (keepEach <= 0) return text.slice(0, maxChars)

    return text.slice(0, keepEach) + ' [...] ' + text.slice(-keepEach)
}

/**
 * Build comparison prompt with context-aware truncation
 */
function buildComparisonPrompt(
    sourceItem: ItemMetadata,
    similarItem: ItemMetadata,
    sharedTraits: string[],
    contextLimit: number
): string {
    // Reserve tokens for system prompt and response (~500 tokens)
    const availableTokens = contextLimit - 500

    // Extract tag names
    const sourceTags = sourceItem.cached_tags?.map(t => t.name) || []
    const similarTags = similarItem.cached_tags?.map(t => t.name) || []

    // Build base content (without descriptions)
    const baseContent = `
Compare these two ${sourceItem.category_type || 'media'} items and explain their similarity:

ITEM A: "${sourceItem.title}" (${sourceItem.release_year || 'Unknown'})
- Category: ${sourceItem.category_type || 'Unknown'}
- Genres: ${sourceItem.genres?.join(', ') || 'None'}
- Tags: ${sourceTags.slice(0, 10).join(', ') || 'None'}
- Rating: ${sourceItem.vote_average || 'N/A'}

ITEM B: "${similarItem.title}" (${similarItem.release_year || 'Unknown'})
- Category: ${similarItem.category_type || 'Unknown'}
- Genres: ${similarItem.genres?.join(', ') || 'None'}
- Tags: ${similarTags.slice(0, 10).join(', ') || 'None'}
- Rating: ${similarItem.vote_average || 'N/A'}
`

    const baseTokens = estimateTokens(baseContent)
    const remainingTokens = availableTokens - baseTokens

    // Allocate remaining tokens to descriptions (split evenly)
    const descTokensEach = Math.floor(remainingTokens / 2) - 50  // Buffer

    let prompt = baseContent

    if (descTokensEach > 50) {  // Only add descriptions if we have enough room
        const sourceDesc = truncateToTokenLimit(
            sourceItem.description || 'No description available',
            descTokensEach
        )
        const similarDesc = truncateToTokenLimit(
            similarItem.description || 'No description available',
            descTokensEach
        )

        prompt = `
Compare these two ${sourceItem.category_type || 'media'} items and explain their similarity:

ITEM A: "${sourceItem.title}" (${sourceItem.release_year || 'Unknown'})
- Category: ${sourceItem.category_type || 'Unknown'}
- Genres: ${sourceItem.genres?.join(', ') || 'None'}
- Tags: ${sourceTags.slice(0, 10).join(', ') || 'None'}
- Rating: ${sourceItem.vote_average || 'N/A'}
- Description: ${sourceDesc}

ITEM B: "${similarItem.title}" (${similarItem.release_year || 'Unknown'})
- Category: ${similarItem.category_type || 'Unknown'}
- Genres: ${similarItem.genres?.join(', ') || 'None'}
- Tags: ${similarTags.slice(0, 10).join(', ') || 'None'}
- Rating: ${similarItem.vote_average || 'N/A'}
- Description: ${similarDesc}
`
    }

    prompt += `
CONTEXT:
These items share the following key traits: ${sharedTraits.join(', ') || 'None identified'}.
`
    return prompt
}

const SYSTEM_PROMPT = `You are an expert at analyzing media similarities. Given two items and their shared traits, explain WHY a fan of Item A would enjoy Item B.

CRITICAL: Return ONLY a valid JSON object with EXACTLY this structure:
{
  "summary": "2 sentences explaining the appeal connection",
  "keyDifference": "1 sentence warning about the biggest contrast (tone, style, etc)"
}

Rules:
- "summary" (The Bridge): Focus on the shared narrative elements provided in Context. convince a fan of A to watch B.
- "keyDifference" (The Wedge): Identify the biggest mismatch (e.g., "Show A is dark/gritty while Show B is campy").
- Be concise, specific, and insightful. NO markdown.`

/**
 * Get context limit for the configured model
 */
async function getModelContextLimit(): Promise<number> {
    const model = await SystemConfigService.getDecryptedConfig('llm_model')

    if (!model) return MODEL_CONTEXT_LIMITS.default

    // Check for exact match
    if (MODEL_CONTEXT_LIMITS[model]) {
        return MODEL_CONTEXT_LIMITS[model]
    }

    // Check for partial match (model names can vary)
    const modelLower = model.toLowerCase()
    for (const [key, limit] of Object.entries(MODEL_CONTEXT_LIMITS)) {
        if (modelLower.includes(key.toLowerCase()) || key.toLowerCase().includes(modelLower)) {
            return limit
        }
    }

    // Check for known large-context patterns
    if (modelLower.includes('128k') || modelLower.includes('1m')) {
        return 128000
    }
    if (modelLower.includes('32k')) {
        return 32000
    }

    return MODEL_CONTEXT_LIMITS.default
}

/**
 * Get or generate similarity explanation for a pair of items
 * Uses cache when available, otherwise generates via LLM
 */
export async function getSimilarityExplanation(
    sourceItemId: string,
    similarItemId: string,
    sharedTraits: string[] = []
): Promise<SimilarityExplanation | null> {
    const supabase = await createServiceRoleClient()

    // Check cache first (gracefully handle missing table)
    try {
        const { data: cached } = await supabase
            .from('similarity_explanations')
            .select('summary, shared_dna, key_difference')
            .eq('source_item_id', sourceItemId)
            .eq('similar_item_id', similarItemId)
            .single()

        if (cached) {
            return {
                summary: cached.summary,
                sharedDNA: sharedTraits.length > 0 ? sharedTraits : (cached.shared_dna || []), // Prefer RPC traits if provided
                keyDifference: cached.key_difference
            }
        }
    } catch (cacheError) {
        // Table may not exist yet - continue to generate
        console.warn('Cache lookup failed, generating fresh:', cacheError)
    }

    // Fetch both items' metadata
    const { data: items, error } = await supabase
        .from('global_items')
        .select('id, title, description, genres, cached_tags, category_type, release_year, vote_average')
        .in('id', [sourceItemId, similarItemId])

    if (error || !items || items.length < 2) {
        console.error('Failed to fetch items for similarity explanation:', error)
        return null
    }

    const sourceItem = items.find((i: { id: string }) => i.id === sourceItemId) as ItemMetadata | undefined
    const similarItem = items.find((i: { id: string }) => i.id === similarItemId) as ItemMetadata | undefined

    if (!sourceItem || !similarItem) return null

    try {
        // Get context limit for current model
        const contextLimit = await getModelContextLimit()

        // Build prompt with context-aware truncation
        const userPrompt = buildComparisonPrompt(sourceItem, similarItem, sharedTraits, contextLimit)

        // Call LLM
        const response = await callLLMForJSON(userPrompt, SYSTEM_PROMPT, { maxTokens: 300 })

        console.log('[Similarity] Raw LLM response length:', response?.length, 'first 200 chars:', response?.substring(0, 200))

        // Clean up response - extract JSON from various wrappers
        let cleanResponse = response.trim()

        // Remove markdown code blocks if present
        cleanResponse = cleanResponse.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '')

        // Try to find JSON object using regex (handles text before/after)
        const jsonMatch = cleanResponse.match(/\{[\s\S]*"commonalities"[\s\S]*\}/)
        if (jsonMatch) {
            cleanResponse = jsonMatch[0]
        } else {
            // Fallback: find first { and last }
            const firstBrace = cleanResponse.indexOf('{')
            const lastBrace = cleanResponse.lastIndexOf('}')
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                cleanResponse = cleanResponse.substring(firstBrace, lastBrace + 1)
            }
        }

        // Normalize whitespace (replace newlines/tabs with spaces, collapse multiple spaces)
        cleanResponse = cleanResponse
            .replace(/[\r\n\t]+/g, ' ')
            .replace(/\s{2,}/g, ' ')

        // Try to parse with multiple repair strategies
        let parsed: SimilarityExplanation | null = null

        // Strategy 1: Direct parse
        try {
            parsed = JSON.parse(cleanResponse) as SimilarityExplanation
        } catch {
            // Strategy 2: Fix truncated strings by finding unclosed quotes
            try {
                // If JSON is truncated mid-string, try to close it
                let repairedJson = cleanResponse

                // Check if we're missing the closing brace and/or quotes
                const quoteCount = (repairedJson.match(/"/g) || []).length
                if (quoteCount % 2 !== 0) {
                    // Odd number of quotes - add closing quote
                    repairedJson += '"'
                }

                // Check for missing differences field
                if (!repairedJson.includes('"differences"')) {
                    repairedJson = repairedJson.replace(/"\s*}?\s*$/, '", "differences": null }')
                }

                // Ensure proper closing
                if (!repairedJson.endsWith('}')) {
                    repairedJson += '}'
                }

                parsed = JSON.parse(repairedJson) as SimilarityExplanation
            } catch {
                // Strategy 3: Extract values using regex
                try {
                    const summaryMatch = cleanResponse.match(/"summary"\s*:\s*"((?:[^"\\]|\\.)*)/)
                    // sharedDNA is now passed in, but we support parsing it if LLM hallucinates it
                    const keyDiffMatch = cleanResponse.match(/"keyDifference"\s*:\s*"((?:[^"\\]|\\.)*)"/)

                    if (summaryMatch) {
                        let summary = summaryMatch[1]
                        summary = summary.replace(/\\$/, '').trim()

                        parsed = {
                            summary,
                            sharedDNA: sharedTraits, // Use input traits
                            keyDifference: keyDiffMatch ? keyDiffMatch[1] : null
                        }
                    }
                } catch {
                    // All strategies failed
                    console.error('Failed to parse LLM response after all repair strategies')
                    console.error('Cleaned response was:', cleanResponse.substring(0, 400))
                    return null
                }
            }
        }

        if (!parsed) {
            console.error('Failed to extract valid JSON from LLM response')
            console.error('Cleaned response was:', cleanResponse.substring(0, 400))
            return null
        }

        // Validate response
        if (!parsed.summary || typeof parsed.summary !== 'string') {
            console.error('Invalid LLM response format:', parsed)
            return null
        }

        // Use input traits as sharedDNA
        parsed.sharedDNA = sharedTraits

        // Normalize keyDifference - convert string 'null', 'N/A', etc. to actual null
        const normalizeKeyDifference = (val: unknown): string | null => {
            if (!val) return null
            if (typeof val !== 'string') return null
            const trimmed = val.trim().toLowerCase()
            if (trimmed === 'null' || trimmed === 'n/a' || trimmed === 'none' || trimmed === '') return null
            return val.trim()
        }
        const keyDifference = normalizeKeyDifference(parsed.keyDifference)

        // Cache the result
        await supabase
            .from('similarity_explanations')
            .upsert({
                source_item_id: sourceItemId,
                similar_item_id: similarItemId,
                summary: parsed.summary,
                shared_dna: sharedTraits,
                key_difference: keyDifference,
                created_at: new Date().toISOString()
            })

        return {
            summary: parsed.summary,
            sharedDNA: sharedTraits,
            keyDifference
        }
    } catch (err) {
        console.error('Failed to generate similarity explanation:', err)
        return null
    }
}

/**
 * Batch get explanations for multiple similar items
 * Fetches from cache first, generates missing ones
 */
export async function getBatchSimilarityExplanations(
    sourceItemId: string,
    items: { id: string, sharedTraits?: string[] }[]
): Promise<Map<string, SimilarityExplanation>> {
    const results = new Map<string, SimilarityExplanation>()
    const supabase = await createServiceRoleClient()

    if (items.length === 0) return results

    // Create map for easy lookup
    const itemMap = new Map(items.map(i => [i.id, i.sharedTraits || []]))
    const similarItemIds = items.map(i => i.id)

    // Fetch all cached explanations (gracefully handle missing table)
    const cachedIds = new Set<string>()
    try {
        const { data: cached } = await supabase
            .from('similarity_explanations')
            .select('similar_item_id, summary, shared_dna, key_difference')
            .eq('source_item_id', sourceItemId)
            .in('similar_item_id', similarItemIds)

        // Add cached results
        if (cached) {
            for (const item of cached) {
                results.set(item.similar_item_id, {
                    summary: item.summary,
                    sharedDNA: itemMap.get(item.similar_item_id) || item.shared_dna || [], // Prefer RPC input
                    keyDifference: item.key_difference
                })
                cachedIds.add(item.similar_item_id)
            }
        }
    } catch (cacheError) {
        // Table may not exist yet - all items will be generated fresh
        console.warn('Batch cache lookup failed:', cacheError)
    }

    // Generate missing explanations (limit to first 5 to control costs)
    const missingIds = similarItemIds.filter(id => !cachedIds.has(id)).slice(0, 5)

    // Generate in parallel (but limit concurrency)
    const generatePromises = missingIds.map(async (similarId) => {
        const sharedTraits = itemMap.get(similarId) || []
        const explanation = await getSimilarityExplanation(sourceItemId, similarId, sharedTraits)
        if (explanation) {
            results.set(similarId, explanation)
        }
    })

    await Promise.all(generatePromises)

    return results
}
