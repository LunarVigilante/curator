'use server'

import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { callLLMForJSON } from '@/lib/llm'
import { SystemConfigService } from '@/lib/services/SystemConfigService'

/**
 * Similarity explanation with commonalities and differences
 */
export interface SimilarityExplanation {
    commonalities: string  // 1-2 sentences explaining shared themes/tones
    differences: string | null    // 1 sentence noting key difference
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

    return prompt
}

const SYSTEM_PROMPT = `You are an expert at analyzing media similarities. Given two items, explain WHY they are similar in a natural, insightful way.

Focus on thematic connections, tone, appeal, and subtle similarities - not just matching genres.

Return ONLY a JSON object with this exact structure:
{
  "commonalities": "1-2 sentences explaining shared themes, tones, or appeal",
  "differences": "1 sentence noting a key difference (or null if very similar)"
}

Examples of good explanations:
- "Both explore themes of found family and redemption through flawed protagonists navigating morally grey worlds."
- "These share a melancholic yet hopeful tone, using music as a narrative device to express unspoken emotions."
- "While both are action-heavy thrillers, the first leans into noir aesthetics while the second embraces neon-lit cyberpunk."

Be concise, specific, and insightful.`

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
    similarItemId: string
): Promise<SimilarityExplanation | null> {
    const supabase = await createServiceRoleClient()

    // Check cache first
    const { data: cached } = await supabase
        .from('similarity_explanations')
        .select('commonalities, differences')
        .eq('source_item_id', sourceItemId)
        .eq('similar_item_id', similarItemId)
        .single()

    if (cached) {
        return {
            commonalities: cached.commonalities,
            differences: cached.differences
        }
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
        const userPrompt = buildComparisonPrompt(sourceItem, similarItem, contextLimit)

        // Call LLM
        const response = await callLLMForJSON(userPrompt, SYSTEM_PROMPT, { maxTokens: 300 })

        // Clean up response (strip markdown code blocks if present)
        let cleanResponse = response.trim()
        if (cleanResponse.startsWith('```')) {
            cleanResponse = cleanResponse.replace(/^```(json)?\n?/, '').replace(/\n?```$/, '')
        }

        // Parse response
        const parsed = JSON.parse(cleanResponse) as SimilarityExplanation

        // Validate response
        if (!parsed.commonalities || typeof parsed.commonalities !== 'string') {
            console.error('Invalid LLM response format:', parsed)
            return null
        }

        // Cache the result
        await supabase
            .from('similarity_explanations')
            .upsert({
                source_item_id: sourceItemId,
                similar_item_id: similarItemId,
                commonalities: parsed.commonalities,
                differences: parsed.differences || null,
                created_at: new Date().toISOString()
            })

        return {
            commonalities: parsed.commonalities,
            differences: parsed.differences || null
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
    similarItemIds: string[]
): Promise<Map<string, SimilarityExplanation>> {
    const results = new Map<string, SimilarityExplanation>()
    const supabase = await createServiceRoleClient()

    if (similarItemIds.length === 0) return results

    // Fetch all cached explanations
    const { data: cached } = await supabase
        .from('similarity_explanations')
        .select('similar_item_id, commonalities, differences')
        .eq('source_item_id', sourceItemId)
        .in('similar_item_id', similarItemIds)

    // Add cached results
    const cachedIds = new Set<string>()
    if (cached) {
        for (const item of cached) {
            results.set(item.similar_item_id, {
                commonalities: item.commonalities,
                differences: item.differences
            })
            cachedIds.add(item.similar_item_id)
        }
    }

    // Generate missing explanations (limit to first 5 to control costs)
    const missingIds = similarItemIds.filter(id => !cachedIds.has(id)).slice(0, 5)

    // Generate in parallel (but limit concurrency)
    const generatePromises = missingIds.map(async (similarId) => {
        const explanation = await getSimilarityExplanation(sourceItemId, similarId)
        if (explanation) {
            results.set(similarId, explanation)
        }
    })

    await Promise.all(generatePromises)

    return results
}
