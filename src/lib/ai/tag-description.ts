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
 * Attempt to parse JSON, repairing common LLM output issues:
 * - Trailing commas before closing braces
 * - Control characters inside strings
 * - Unescaped newlines inside values
 */
function safeJsonParse<T>(raw: string): T | null {
    // First try as-is
    try { return JSON.parse(raw) as T } catch { /* continue */ }

    let repaired = raw
    // Strip control chars except \n \r \t
    repaired = repaired.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')
    // Replace literal newlines inside JSON string values with spaces
    repaired = repaired.replace(/(["'])\s*\n\s*/g, '$1 ')
    // Remove trailing commas before } or ]
    repaired = repaired.replace(/,\s*([}\]])/g, '$1')

    try { return JSON.parse(repaired) as T } catch { /* continue */ }

    // Last resort: extract individual key-value pairs with regex
    const pairs = new Map<string, string>()
    const pairRegex = /"([^"]+)"\s*:\s*"((?:[^"\\]|\\.)*)"?/g
    let m: RegExpExecArray | null
    while ((m = pairRegex.exec(raw)) !== null) {
        pairs.set(m[1], m[2].replace(/\\(["\\])/g, '$1'))
    }
    if (pairs.size > 0) {
        return Object.fromEntries(pairs) as T
    }
    return null
}

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
        console.log(`   ║    🏷️  "${tagName}": ${description.substring(0, 50)}...`)
        return description
    } catch (error) {
        console.warn(`   ║    ⚠️  Failed tag description for "${tagName}":`, error)
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

/**
 * Batch generate descriptions for multiple tags in a single LLM call
 * Falls back to individual calls if batch parsing fails
 * @param tagNames - Array of tag names to describe
 * @returns Map of tag name to description
 */
export async function batchGenerateTagDescriptions(tagNames: string[]): Promise<Map<string, string>> {
    const results = new Map<string, string>()
    if (tagNames.length === 0) return results

    // For 1-2 tags, individual calls are fine
    if (tagNames.length <= 2) {
        for (const name of tagNames) {
            results.set(name, await generateTagDescription(name))
        }
        return results
    }

    const supabase = createServiceRoleClient()
    const config = await getLLMConfig(supabase)

    if (!config.apiKey) {
        tagNames.forEach(name => results.set(name, `Describes media with "${name}" characteristics.`))
        return results
    }

    const systemPrompt = `You are a media curator assistant. For each tag, write a 1-sentence description (max 30 words) of what it means for TV/film.

Rules:
- Output ONLY a JSON object mapping tag name to description
- Do NOT use quotes or special characters inside description values
- Keep descriptions simple and plain-text

Example: {"slow-burn": "A narrative that builds tension gradually over many episodes", "satirical": "Uses humor and irony to critique society or institutions"}`

    const userPrompt = `Describe these ${tagNames.length} tags: ${tagNames.map(n => `"${n}"`).join(', ')}`

    try {
        const response = await callLLM({
            userPrompt,
            systemPrompt,
            apiKey: config.apiKey,
            provider: config.provider,
            model: config.model,
            endpoint: config.endpoint,
            timeoutMs: 60000,
            maxTokens: tagNames.length * 60
        })

        const jsonMatch = response.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
            const parsed = safeJsonParse<Record<string, string>>(jsonMatch[0])
            if (parsed) {
                for (const name of tagNames) {
                    results.set(name, parsed[name] || `Describes media with ${name} characteristics.`)
                }
                console.log(`   ║    🏷️  Batch described ${tagNames.length} tags in 1 call`)
                return results
            }
        }
    } catch (error) {
        console.warn(`   ║    ⚠️  Batch tag description failed, falling back to individual:`, error)
    }

    // Fallback: individual calls
    for (const name of tagNames) {
        results.set(name, await generateTagDescription(name))
    }
    return results
}

/**
 * Batch categorize multiple tags in a single LLM call
 * @param tagNames - Array of tag names to categorize
 * @returns Map of tag name to category
 */
export async function batchCategorizeTags(tagNames: string[]): Promise<Map<string, string>> {
    const results = new Map<string, string>()
    if (tagNames.length === 0) return results

    if (tagNames.length <= 2) {
        for (const name of tagNames) {
            results.set(name, await categorizeTag(name))
        }
        return results
    }

    const supabase = createServiceRoleClient()
    const config = await getLLMConfig(supabase)

    if (!config.apiKey) {
        tagNames.forEach(name => results.set(name, 'theme'))
        return results
    }

    const systemPrompt = `Classify each media tag into ONE category. Output ONLY valid JSON: {"tag_name": "category", ...}

Categories: mood, theme, style, narrative, pacing, tone`

    const userPrompt = `Categorize these ${tagNames.length} tags:\n${tagNames.map(n => `- "${n}"`).join('\n')}`

    try {
        const response = await callLLM({
            userPrompt,
            systemPrompt,
            apiKey: config.apiKey,
            provider: config.provider,
            model: config.model,
            endpoint: config.endpoint,
            timeoutMs: 30000,
            maxTokens: tagNames.length * 20
        })

        const jsonMatch = response.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
            const parsed = safeJsonParse<Record<string, string>>(jsonMatch[0])
            if (parsed) {
                const validCategories = ['mood', 'theme', 'style', 'narrative', 'pacing', 'tone']
                for (const name of tagNames) {
                    const cat = (parsed[name] || '').toLowerCase().trim()
                    results.set(name, validCategories.includes(cat) ? cat : 'theme')
                }
                console.log(`   ║    🏷️  Batch categorized ${tagNames.length} tags in 1 call`)
                return results
            }
        }
    } catch {
        // Fallback to individual
    }

    for (const name of tagNames) {
        results.set(name, await categorizeTag(name))
    }
    return results
}
