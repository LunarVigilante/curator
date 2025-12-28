import {
    type ImportStrategy,
    type ParsedImport,
    type ImportSourceType,
    detectImportSource
} from '@/lib/types/import'
import { LLMParserAdapter } from './adapters/LLMParserAdapter'

/**
 * ImportRouter - Routes input to the appropriate parsing strategy
 * 
 * Uses the Strategy pattern to handle different input types:
 * - Spotify URLs → SpotifyAdapter
 * - Letterboxd/IMDb URLs → ScraperAdapter
 * - Unstructured text → LLMParserAdapter
 */
export class ImportRouter {
    private strategies: ImportStrategy[] = []
    private defaultStrategy: ImportStrategy

    constructor() {
        // Initialize adapters
        // Order matters: more specific handlers first
        // TODO: Add URL-specific adapters
        // this.strategies.push(new SpotifyAdapter())
        // this.strategies.push(new LetterboxdAdapter())
        // this.strategies.push(new ImdbAdapter())

        // LLM Parser is the fallback for unstructured text
        this.defaultStrategy = new LLMParserAdapter()
        this.strategies.push(this.defaultStrategy)
    }

    /**
     * Detect the import source type from input
     */
    detectSource(input: string): ImportSourceType {
        return detectImportSource(input)
    }

    /**
     * Route input to the appropriate strategy and parse
     */
    async route(input: string): Promise<ParsedImport> {
        const trimmed = input.trim()

        if (!trimmed) {
            throw new Error('Empty input provided')
        }

        // Find the first strategy that can handle this input
        for (const strategy of this.strategies) {
            if (strategy.canHandle(trimmed)) {
                console.log(`[ImportRouter] Using strategy: ${strategy.name}`)
                return await strategy.parse(trimmed)
            }
        }

        // Fallback to default (LLM Parser)
        console.log(`[ImportRouter] Using default strategy: ${this.defaultStrategy.name}`)
        return await this.defaultStrategy.parse(trimmed)
    }

    /**
     * Get list of available strategies for debugging
     */
    getStrategies(): string[] {
        return this.strategies.map(s => s.name)
    }
}

// Singleton instance
let importRouterInstance: ImportRouter | null = null

export function getImportRouter(): ImportRouter {
    if (!importRouterInstance) {
        importRouterInstance = new ImportRouter()
    }
    return importRouterInstance
}
