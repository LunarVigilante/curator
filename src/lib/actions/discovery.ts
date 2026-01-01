'use server'

import { callLLMWithConfig, cleanLLMResponse } from '@/lib/llm'

export type ChallengerItem = {
    id: string // External ID (e.g. "tmdb-12345")
    name: string
    image: string | null
    description: string
    origin: 'TMDB' | 'RAWG' | 'GOOGLE_BOOKS' | 'LASTFM' | 'OTHER'
}

import { searchMediaAction } from './media'

export async function fetchChallengers(categoryName: string, existingItemNames: string[], categoryId: string): Promise<ChallengerItem[]> {
    // Determine domain based on category name (simple heuristic)
    let domain = 'General'
    if (/movie|film|cinema/i.test(categoryName)) domain = 'Movies'
    if (/game/i.test(categoryName)) domain = 'Video Games'
    if (/book|read/i.test(categoryName)) domain = 'Books'
    if (/music|song|album/i.test(categoryName)) domain = 'Music'
    if (/anime|manga/i.test(categoryName)) domain = 'Anime'

    try {
        const prompt = `
            Suggest 3 "Hidden Gem" or "Critically Acclaimed" items for the category: "${categoryName}" (${domain}).
            
            Constraint: Do NOT suggest any of these items (User already has them):
            ${existingItemNames.slice(0, 50).join(', ')}

            Return ONLY a JSON array of objects with:
            - name: string
            - year: string
            
            Example: [{"name": "The Godfather", "year": "1972"}]
        `

        const response = await callLLMWithConfig(prompt)
        const cleaned = cleanLLMResponse(response)
        const suggestions = JSON.parse(cleaned)

        // Resolve metadata for suggestions in parallel
        const validChallengers: ChallengerItem[] = []

        await Promise.all(suggestions.map(async (s: any) => {
            try {
                // Search for the item to get real metadata (image, description, ID)
                const searchResults = await searchMediaAction(s.name, categoryName, null, categoryId)

                if (searchResults.success && searchResults.data && searchResults.data.length > 0) {
                    const match = searchResults.data[0]
                    validChallengers.push({
                        id: match.id,
                        name: match.title, // Use official title
                        image: match.imageUrl || null,
                        description: match.description || '',
                        origin: 'TMDB' // Generic origin, could be refined
                    })
                }
            } catch (err) {
                console.error(`Failed to resolve metadata for challenger: ${s.name}`, err)
            }
        }))

        return validChallengers

    } catch (error) {
        console.error('Failed to fetch challengers:', error)
        return []
    }
}
