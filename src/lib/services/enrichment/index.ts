/**
 * Enrichment Services Barrel Export
 * 
 * Central export for all enrichment-related services.
 * 
 * Architecture:
 * - providers/       - Category-specific metadata providers (TMDB, IGDB, BGG, etc.)
 * - MetadataService  - Orchestrates provider selection and execution
 * - AIEnrichmentService - AI-powered description/tags/embedding
 * - EnrichmentPipeline - High-level unified pipeline
 */

// ============================================================================
// METADATA SERVICE (fast, no AI)
// ============================================================================

export {
    refreshMetadata,
    type MetadataRefreshResult,
    type MetadataRefreshOptions
} from './MetadataService'

// ============================================================================
// AI ENRICHMENT SERVICE
// ============================================================================

export {
    generateAIDescription,
    generateAITags,
    generateItemEmbedding,
    enrichWithAI,
    updateItemWithAIContent,
    type AIEnrichmentResult,
    type AIEnrichmentOptions
} from './AIEnrichmentService'

// ============================================================================
// UNIFIED PIPELINE (recommended for scripts)
// ============================================================================

export {
    enrichItem,
    refreshItemMetadata,
    regenerateItemContent,
    fullEnrichment,
    type EnrichmentOptions,
    type EnrichmentResult
} from './EnrichmentPipeline'

// ============================================================================
// PROVIDERS (for direct access if needed)
// ============================================================================

export {
    getProviderForCategory,
    getAllProviders,
    getAllSupportedCategories,
    hasProvider,
    TMDBProvider,
    VideoGameProvider,
    BoardGameProvider,
    AnimeProvider,
    MusicProvider,
    BookProvider,
    PodcastProvider,
    ComicsProvider
} from './providers'

export type { MetadataProvider, ProviderResult, ProviderItem } from './providers/types'
