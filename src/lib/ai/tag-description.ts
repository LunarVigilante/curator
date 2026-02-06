/**
 * AI Tag Description Generator
 * 
 * Generates short, helpful descriptions for semantic tags used in media curation.
 * These descriptions appear in tooltip hover states to help users understand
 * what each tag means.
 */

import { callLLM } from '@/lib/llm'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { getLLMConfig } from '@/lib/harvesters/shared'

/**
 * Generate an AI description for a semantic tag
 * @param tagName - The tag name (e.g., "buoyant", "high-energy bingeable")
 * @returns A 1-2 sentence description of what the tag means
 */
export async function generateTagDescription(tagName: string): Promise<string> {
    const supabase = createServiceRoleClient()
    const config = await getLLMConfig(supabase)

    if (!config.apiKey) {
        return `Describes media with "${tagName}" characteristics.`
    }

    const systemPrompt = `You are a media curator assistant. Generate ONLY a brief description (1-2 sentences, max 50 words) for a semantic tag used to describe TV shows, movies, and other media.

The description should:
- Explain what this tag means in entertainment context
- Be clear and accessible to general audiences
- Help users understand what to expect from content with this tag

Respond with ONLY the description text, no quotes, no prefix, no extra formatting.`

    const userPrompt = `Tag: "${tagName}"`

    try {
        const response = await callLLM({
            userPrompt,
            systemPrompt,
            apiKey: config.apiKey,
            provider: config.provider,
            model: config.model,
            endpoint: config.endpoint,
            timeoutMs: 30000
        })

        const description = response.trim()
        console.log(`[Tag] Generated description for "${tagName}": ${description.substring(0, 50)}...`)
        return description
    } catch (error) {
        console.warn(`[Tag] Failed to generate description for "${tagName}":`, error)
        // Return a fallback description
        return `Describes media with "${tagName}" characteristics.`
    }
}

/**
 * Categorize a tag into a semantic category
 * @param tagName - The tag name
 * @returns Category like 'mood', 'theme', 'style', 'narrative', 'pacing'
 */
export async function categorizeTag(tagName: string): Promise<string> {
    const supabase = createServiceRoleClient()
    const config = await getLLMConfig(supabase)

    if (!config.apiKey) {
        return 'theme'
    }

    const systemPrompt = `Classify this media tag into ONE category. Respond with ONLY the category name.

Categories:
- mood (emotional tone: buoyant, melancholic, tense)
- theme (subject matter: redemption, family, identity)
- style (aesthetic: documentary, surreal, minimalist)
- narrative (story structure: episodic, serialized)
- pacing (rhythm: slow-burn, rapid-fire)
- tone (atmosphere: dark, light-hearted, satirical)`

    const userPrompt = `Tag: "${tagName}"`

    try {
        const response = await callLLM({
            userPrompt,
            systemPrompt,
            apiKey: config.apiKey,
            provider: config.provider,
            model: config.model,
            endpoint: config.endpoint,
            timeoutMs: 15000
        })

        const category = response.trim().toLowerCase()
        const validCategories = ['mood', 'theme', 'style', 'narrative', 'pacing', 'tone']
        return validCategories.includes(category) ? category : 'theme'
    } catch {
        return 'theme'
    }
}
