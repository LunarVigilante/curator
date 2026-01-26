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
 */
export async function generateAITags(
    supabase: SupabaseClient,
    itemId: string
): Promise<string[] | null> {
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
        // Call the existing tag generation endpoint logic
        const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/ai/generate-tags`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                itemId,
                title: item.title,
                description: item.description,
                type: item.category_type,
                genres: item.genres
            })
        })

        if (!response.ok) {
            console.error('Tag generation API failed')
            return null
        }

        const result = await response.json()
        return result.tags || null
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
