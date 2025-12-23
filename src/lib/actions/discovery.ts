'use server'

import { callLLM, cleanLLMResponse } from '@/lib/llm'

export type ChallengerItem = {
    id: string // External ID (e.g. "tmdb-12345")
    name: string
    image: string | null
    description: string
    origin: 'TMDB' | 'RAWG' | 'GOOGLE_BOOKS' | 'LASTFM' | 'OTHER'
}

export async function fetchChallengers(categoryName: string, existingItemNames: string[]): Promise<ChallengerItem[]> {
    // Determine domain based on category name (simple heuristic)
    let domain = 'General'
    if (/movie|film|cinema/i.test(categoryName)) domain = 'Movies'
    if (/game/i.test(categoryName)) domain = 'Video Games'
    if (/book|read/i.test(categoryName)) domain = 'Books'
    if (/music|song|album/i.test(categoryName)) domain = 'Music'

    try {
        const prompt = `
            Suggest 5 "Hidden Gem" or "Critically Acclaimed" items for the category: "${categoryName}" (${domain}).
            
            Constraint: Do NOT suggest any of these items (User already has them):
            ${existingItemNames.slice(0, 50).join(', ')}

            Return ONLY a JSON array of objects with:
            - name: string
            - description: string (very brief, 10-15 words)
            - year: string
            
            Example: [{"name": "The Godfather", "description": "Mafia masterpiece...", "year": "1972"}]
        `

        const response = await callLLM(prompt)
        const cleaned = cleanLLMResponse(response)
        const suggestions = JSON.parse(cleaned)

        // Transform into ChallengerItems
        return suggestions.map((s: any, index: number) => ({
            id: `challenger-${Date.now()}-${index}`,
            name: `${s.name} (${s.year || 'Unknown'})`,
            description: s.description,
            image: null, // We'd need a real search API to get images. For now, use placeholder.
            origin: 'OTHER'
        }))

    } catch (error) {
        console.error('Failed to fetch challengers:', error)
        return []
    }
}
