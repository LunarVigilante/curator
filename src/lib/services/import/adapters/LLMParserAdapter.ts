import { callLLMForJSON } from '@/lib/llm'
import {
    type ImportStrategy,
    type ParsedImport,
    type ParsedImportItem,
    LLMParseResultSchema,
    LLM_IMPORT_SYSTEM_PROMPT,
    isUrl
} from '@/lib/types/import'

/**
 * LLMParserAdapter - Uses LLM to parse unstructured text into structured media lists
 * 
 * This is the fallback adapter for any input that isn't a recognized URL.
 * It uses the LLM with a specialized prompt to extract:
 * - Collection title (inferred if not explicit)
 * - Media items with metadata
 * - Ranking order
 */
export class LLMParserAdapter implements ImportStrategy {
    name = 'LLMParser'

    /**
     * Can handle any non-URL input, or URLs that aren't recognized
     */
    canHandle(input: string): boolean {
        const trimmed = input.trim()

        // If it's not a URL, we can parse it
        if (!isUrl(trimmed)) {
            return true
        }

        // If it IS a URL but not one we have a specific adapter for,
        // we can try to extract text from it (future enhancement)
        // For now, return false for unknown URLs
        return false
    }

    /**
     * Parse unstructured text using LLM
     */
    async parse(input: string): Promise<ParsedImport> {
        const userPrompt = `Parse this user input into a structured media list. Extract all media items (movies, TV shows, anime, music, books, or games) and their details.

User Input:
"""
${input}
"""`

        try {
            // Call LLM with JSON mode
            const response = await callLLMForJSON(userPrompt, LLM_IMPORT_SYSTEM_PROMPT)

            // Parse and validate response
            const parsed = LLMParseResultSchema.parse(JSON.parse(response))

            // Transform to our ParsedImport format
            const items: ParsedImportItem[] = parsed.items.map(item => ({
                title: item.title,
                director: item.director,
                artist: item.artist,
                author: item.author,
                studio: item.studio,
                releaseYear: item.releaseYear,
                rank: item.rank,
                mediaType: parsed.mediaType === 'mixed' ? undefined : parsed.mediaType,
                confidence: parsed.confidence,
                rawInput: undefined
            }))

            return {
                source: 'unstructured_text',
                collectionTitle: parsed.collectionTitle,
                collectionDescription: parsed.collectionDescription,
                mediaType: parsed.mediaType,
                items,
                parseConfidence: parsed.confidence,
                warnings: items.length === 0 ? ['No media items could be extracted'] : undefined
            }

        } catch (error) {
            console.error('[LLMParserAdapter] Parse error:', error)

            // Return a failed parse result
            return {
                source: 'unstructured_text',
                collectionTitle: 'Imported Collection',
                mediaType: 'mixed',
                items: [],
                parseConfidence: 0,
                warnings: [
                    'Failed to parse input. Please try with clearer formatting.',
                    error instanceof Error ? error.message : 'Unknown error'
                ]
            }
        }
    }
}
