/**
 * AI Enrichment Service
 * 
 * Handles AI-powered content generation:
 * - 4-part structured descriptions
 * - Tag generation
 * - Embedding generation
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { generateStructuredDescription, combineDescription, buildEmbeddingText, StructuredDescription } from '@/lib/ai/structured-description'
import { generateEmbedding } from '@/lib/harvesters/shared'

// ============================================================================
// TYPES
// ============================================================================

export interface AIEnrichmentResult {
    success: boolean
    description?: string
    description_parts?: StructuredDescription
    tags?: string[]
    embedding?: number[]
    error?: string
}

export interface AIEnrichmentOptions {
    generateDescription?: boolean
    generateTags?: boolean
    generateEmbedding?: boolean
}

// ============================================================================
// DESCRIPTION GENERATION
// ============================================================================

/**
 * Generate a 4-part structured description using AI
 */
export async function generateAIDescription(
    supabase: SupabaseClient,
    itemId: string
): Promise<{ description: string; description_parts: StructuredDescription } | null> {
    const serviceSupabase = createServiceRoleClient()

    // Get current item
    const { data: item, error } = await (supabase.from('global_items') as any)
        .select('title, description, category_type, metadata')
        .eq('id', itemId)
        .single()

    if (error || !item) {
        console.error('Failed to fetch item for description generation:', error)
        return null
    }

    try {
        const description_parts = await generateStructuredDescription(serviceSupabase, {
            title: item.title,
            originalDescription: item.description || '',
            type: item.category_type,
            metadata: item.metadata
        })

        const description = combineDescription(description_parts)

        return { description, description_parts }
    } catch (e) {
        console.error('Failed to generate AI description:', e)
        return null
    }
}

// ============================================================================
// TAG GENERATION
// ============================================================================

/**
 * Generate tags for an item using AI
 * Calls LLM directly to avoid authentication issues with internal API calls
 */
export async function generateAITags(
    supabase: SupabaseClient,
    itemId: string
): Promise<string[] | null> {
    const { callLLM } = await import('@/lib/llm')
    const { SystemConfigService } = await import('@/lib/services/SystemConfigService')

    // Get current item
    const { data: item, error } = await (supabase.from('global_items') as any)
        .select('title, description, category_type, genres, metadata')
        .eq('id', itemId)
        .single()

    if (error || !item) {
        console.error('Failed to fetch item for tag generation:', error)
        return null
    }

    try {
        // Fetch LLM config from database
        const provider = await SystemConfigService.getDecryptedConfig('llm_provider') || 'openrouter'
        const apiKey = await SystemConfigService.getDecryptedConfig('llm_api_key')
        const endpoint = await SystemConfigService.getDecryptedConfig('llm_endpoint')
        const model = await SystemConfigService.getDecryptedConfig('llm_model')

        // Check all possible API key locations based on provider
        const anannasKey = await SystemConfigService.getDecryptedConfig('anannas_api_key')
        const openaiKey = await SystemConfigService.getDecryptedConfig('openai_api_key')
        const openrouterKey = await SystemConfigService.getDecryptedConfig('openrouter_api_key')
        const anthropicKey = await SystemConfigService.getDecryptedConfig('anthropic_api_key')
        const googleKey = await SystemConfigService.getDecryptedConfig('google_ai_api_key')

        const finalApiKey = apiKey || openrouterKey || anannasKey || openaiKey || anthropicKey || googleKey

        if (!finalApiKey) {
            console.error('[generateAITags] No LLM API Key configured')
            return null
        }

        const systemPrompt = `You are an expert curator. Generate 5-8 relevant tags for the given item.

TAG RULES:
- Generate 5-8 tags
- Include: Genre, Mood, Theme, Era/Period
- Be specific and useful for discovery
- Each tag should be 1-3 words

Return ONLY a comma-separated list of tags. No JSON, no quotes, no markdown.
Example: Action, Sci-Fi, Dark Atmosphere, 1990s, Cyberpunk, Neo-Noir`

        const userPrompt = `Generate tags for:
Title: ${item.title}
Type: ${item.category_type}
${item.description ? `Description: ${item.description}` : ''}`

        const response = await callLLM({
            userPrompt,
            systemPrompt,
            apiKey: finalApiKey,
            provider,
            model: model || undefined,
            endpoint: endpoint || undefined
        })

        // Parse comma-separated tags
        const tags = response
            .split(',')
            .map((tag: string) => tag.trim())
            .filter((tag: string) => tag.length > 0 && tag.length < 50)
            .slice(0, 8)

        console.log('[generateAITags] Generated tags:', tags.length)
        return tags
    } catch (e) {
        console.error('Failed to generate AI tags:', e)
        return null
    }
}

// ============================================================================
// EMBEDDING GENERATION
// ============================================================================

/**
 * Generate embedding for an item
 */
export async function generateItemEmbedding(
    supabase: SupabaseClient,
    itemId: string
): Promise<number[] | null> {
    // Get full item data
    const { data: item, error } = await (supabase.from('global_items') as any)
        .select('*')
        .eq('id', itemId)
        .single()

    if (error || !item) {
        console.error('Failed to fetch item for embedding generation:', error)
        return null
    }

    try {
        const embeddingText = buildEmbeddingText(item)
        const embedding = await generateEmbedding(embeddingText)
        return embedding
    } catch (e) {
        console.error('Failed to generate embedding:', e)
        return null
    }
}

// ============================================================================
// COMBINED ENRICHMENT
// ============================================================================

/**
 * Full AI enrichment: description + tags + embedding
 * Used by harvest scripts and "Regen Description" button
 */
export async function enrichWithAI(
    supabase: SupabaseClient,
    itemId: string,
    options: AIEnrichmentOptions = {}
): Promise<AIEnrichmentResult> {
    const {
        generateDescription: doDescription = true,
        generateTags: doTags = true,
        generateEmbedding: doEmbedding = true
    } = options

    let description: string | undefined
    let description_parts: StructuredDescription | undefined
    let tags: string[] | undefined
    let embedding: number[] | undefined

    // Generate description
    if (doDescription) {
        const descResult = await generateAIDescription(supabase, itemId)
        if (descResult) {
            description = descResult.description
            description_parts = descResult.description_parts
        }
    }

    // Generate tags
    if (doTags) {
        const tagResult = await generateAITags(supabase, itemId)
        if (tagResult) {
            tags = tagResult
        }
    }

    // Generate embedding
    if (doEmbedding) {
        embedding = await generateItemEmbedding(supabase, itemId) || undefined
    }

    return {
        success: true,
        description,
        description_parts,
        tags,
        embedding
    }
}

// ============================================================================
// DATABASE UPDATE HELPERS
// ============================================================================

/**
 * Update item with AI-generated content
 */
export async function updateItemWithAIContent(
    supabase: SupabaseClient,
    itemId: string,
    data: {
        description?: string
        description_parts?: StructuredDescription
        embedding?: number[]
    }
): Promise<boolean> {
    const updateData: Record<string, any> = {}

    if (data.description !== undefined) {
        updateData.description = data.description
    }
    if (data.description_parts !== undefined) {
        updateData.description_parts = data.description_parts
    }
    if (data.embedding !== undefined) {
        updateData.embedding = data.embedding
    }

    if (Object.keys(updateData).length === 0) {
        return true // Nothing to update
    }

    const { error } = await (supabase.from('global_items') as any)
        .update(updateData)
        .eq('id', itemId)

    if (error) {
        console.error('Failed to update item with AI content:', error)
        return false
    }

    return true
}
