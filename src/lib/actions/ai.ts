'use server'

import { callLLM, cleanLLMResponse } from '@/lib/llm'
import { createTag, getTags } from '@/lib/actions/tags'

function extractJson(text: string): string {
    // Try to find JSON block enclosed in ```json ... ```
    const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/)
    if (jsonBlockMatch) {
        return jsonBlockMatch[1]
    }

    // Try to find JSON block enclosed in ``` ... ```
    const codeBlockMatch = text.match(/```\s*([\s\S]*?)\s*```/)
    if (codeBlockMatch) {
        return codeBlockMatch[1]
    }

    // Fallback: Try to find the first { or [ and the last } or ]
    const firstOpenBrace = text.indexOf('{')
    const firstOpenBracket = text.indexOf('[')

    let startIndex = -1
    let endIndex = -1

    if (firstOpenBrace !== -1 && (firstOpenBracket === -1 || firstOpenBrace < firstOpenBracket)) {
        startIndex = firstOpenBrace
        endIndex = text.lastIndexOf('}')
    } else if (firstOpenBracket !== -1) {
        startIndex = firstOpenBracket
        endIndex = text.lastIndexOf(']')
    }

    if (startIndex !== -1 && endIndex !== -1) {
        return text.substring(startIndex, endIndex + 1)
    }

    return text
}

export async function generateTags(name: string, description: string, categoryName: string) {
    try {
        const existingTags = await getTags()
        const existingTagNames = existingTags.map(t => t.name).join(', ')

        const prompt = `
            Analyze the following item and suggest up to 5 relevant tags.
            Item Name: ${name}
            Description: ${description}
            Category: ${categoryName}

            Existing Tags (reuse these if applicable): ${existingTagNames}

            Return ONLY a comma-separated list of 5-7 relevant vibe-based tags. Example: Action, Relentless, Futuristic, Dark, 90s Vibe
        `

        const systemPrompt = "You are a helpful assistant that suggests tags for items. Return ONLY a comma-separated list of tags, no JSON, no quotes, no markdown."
        const response = await callLLM(prompt, systemPrompt)
        console.log('generateTags raw response:', response)

        const suggestedTags = response.split(',').map((t: string) => t.trim()).filter(Boolean)

        const finalTags: { id: string, name: string }[] = []

        for (const tagName of suggestedTags) {
            try {
                const tag = await createTag(tagName)
                if (tag) {
                    finalTags.push(tag)
                }
            } catch (e) {
                console.error(`Failed to create/get tag ${tagName}`, e)
            }
        }

        return finalTags
    } catch (error) {
        console.error('Auto-tagging failed:', error)
        return []
    }
}

export async function generateDescription(name: string, categoryName: string) {
    try {
        const prompt = `
            Generate a description for:
            Item Name: ${name}
            Category: ${categoryName}
        `

        const systemPrompt = `You are an expert curator. Generate a description in two distinct parts. Combine them into a single paragraph.

Part 1: The Metadata Intro (The Facts)
Instruction: concisely state the Creator, Year, Genre, and Key Talent.
Constraint: Keep this factual and brief. This does not count toward your 50-word limit.
Templates:
- Movies/TV: '[Director]’s [Year] [Genre] stars [Cast].'
- Books: '[Author]’s [Year] [Genre] follows [Protagonist].'
- Music: '[Artist]’s [Year] [Genre] album features [Key Tracks].'
- Games: '[Studio]’s [Year] [Genre] is set in [Setting].'

Part 2: The Core Analysis (The Hook & Vibe)
Instruction: Describe the central conflict, themes, and cultural impact.
Constraint: Maximum 50 words. Be dense, critical, and engaging.
Content:
- The Hook: What is the actual plot/conflict?
- The Vibe: Why does it matter? (Awards, Atmosphere, Innovation).

Output the result as a single combined paragraph. Return ONLY the raw text.`
        const response = await callLLM(prompt, systemPrompt)
        console.log('generateDescription raw response:', response)

        // For description, use the refactored cleaner
        return cleanLLMResponse(response)
    } catch (error) {
        console.error('Description generation failed:', error)
        return ''
    }
}

export type MetadataField = {
    name: string
    type: 'text' | 'number' | 'url' | 'date'
    required?: boolean
}

export async function extractMetadata(name: string, description: string, schema: MetadataField[]) {
    try {
        const fields = schema.map(f => `${f.name} (${f.type})`).join(', ')

        const prompt = `
            Analyze the following item and extract metadata values for the specified fields.
            Item Name: ${name}
            Description: ${description}

            Fields to Extract: ${fields}

            Return ONLY a JSON object where keys are the field names and values are the extracted values. 
            If a value cannot be found, omit the key or use null.
            Example: {"Year": 1999, "Genre": "Action"}
        `

        console.log('extractMetadata prompt:', prompt)
        const response = await callLLM(prompt)
        console.log('extractMetadata raw response:', response)

        const cleanedResponse = extractJson(response)
        console.log('extractMetadata cleaned response:', cleanedResponse)

        return JSON.parse(cleanedResponse)
    } catch (error) {
        console.error('Metadata extraction failed:', error)
        return {}
    }
}

export async function suggestMetadataSchema(categoryName: string, categoryDescription: string) {
    try {
        const prompt = `
            Suggest a list of custom metadata fields for a ranking category.
            Category Name: ${categoryName}
            Description: ${categoryDescription}

            Return ONLY a JSON array of objects with 'name' (string), 'type' ('text', 'number', 'url', 'date'), and 'required' (boolean).
            Suggest 3-5 relevant fields.
            Example: [{"name": "Release Year", "type": "number", "required": false}, {"name": "Studio", "type": "text", "required": true}]
        `

        const response = await callLLM(prompt)
        console.log('suggestMetadataSchema raw response:', response)

        const cleanedResponse = extractJson(response)
        console.log('suggestMetadataSchema cleaned response:', cleanedResponse)

        return JSON.parse(cleanedResponse) as MetadataField[]
    } catch (error) {
        console.error('Schema suggestion failed:', error)
        return []
    }
}
