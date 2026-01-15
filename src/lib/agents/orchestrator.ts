/**
 * Agent Orchestrator
 * 
 * Lightweight agents for content enrichment and query understanding:
 * - Analyst: Generates rich descriptions for embedding
 * - Curator: Parses complex user queries for semantic search
 * 
 * Uses OpenRouter as the LLM backend.
 */

import { callLLMWithConfig, callLLMForJSON } from '@/lib/llm';

// ============================================================================
// TYPES
// ============================================================================

export interface AnalystInput {
    title: string;
    categoryType: string;
    description?: string;
    metadata?: Record<string, any>;
    tags?: string[];
    reviews?: string[];
}

export interface AnalystOutput {
    richDescription: string;
    embeddingText: string;
}

export interface CuratorInput {
    query: string;
    context?: {
        preferredCategories?: string[];
        excludeCategories?: string[];
        yearRange?: { min?: number; max?: number };
    };
}

export interface CuratorOutput {
    searchQuery: string;
    filters: {
        categories?: string[];
        yearMin?: number;
        yearMax?: number;
        mood?: string[];
        themes?: string[];
    };
    intent: 'discovery' | 'specific' | 'comparative' | 'exploratory';
}

// ============================================================================
// ANALYST AGENT
// ============================================================================

const ANALYST_SYSTEM_PROMPT = `You are The Analyst, an expert at synthesizing information about media content into rich, descriptive paragraphs optimized for semantic search and embedding.

Your task is to combine title, description, metadata, tags, and reviews into a single dense paragraph that captures:
1. Core premise and plot elements
2. Themes, genres, and archetypes
3. Tone and emotional texture
4. Style, aesthetics, and notable characteristics
5. Critical reception highlights (if reviews provided)

Guidelines:
- Write in third person, present tense
- Be specific and descriptive, avoid vague superlatives
- Include proper nouns (character names, locations, creators)
- Incorporate genre terminology and industry jargon
- Aim for 150-250 words
- Do NOT include ratings, scores, or numerical data
- Do NOT use bullet points or lists

Output only the rich description paragraph, nothing else.`;

/**
 * The Analyst Agent
 * Generates a rich description suitable for embedding from item metadata.
 */
export async function analyzeItem(input: AnalystInput): Promise<AnalystOutput> {
    const userPrompt = buildAnalystPrompt(input);

    try {
        const richDescription = await callLLMWithConfig(
            userPrompt,
            ANALYST_SYSTEM_PROMPT,
            false,
            { maxTokens: 500 }
        );

        // Build embedding text: title + rich description + tags
        const embeddingText = buildEmbeddingText(input, richDescription);

        return {
            richDescription: richDescription.trim(),
            embeddingText,
        };
    } catch (error) {
        console.error('[Orchestrator] Analyst error:', error);

        // Fallback to basic description
        const fallbackDescription = input.description || `${input.title} - ${input.categoryType}`;
        return {
            richDescription: fallbackDescription,
            embeddingText: buildEmbeddingText(input, fallbackDescription),
        };
    }
}

function buildAnalystPrompt(input: AnalystInput): string {
    const parts: string[] = [
        `Title: ${input.title}`,
        `Type: ${input.categoryType}`,
    ];

    if (input.description) {
        parts.push(`Description: ${input.description}`);
    }

    if (input.metadata) {
        const metaStr = Object.entries(input.metadata)
            .filter((entry) => entry[1] !== null && entry[1] !== undefined)
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
            .join('\n');
        if (metaStr) {
            parts.push(`Metadata:\n${metaStr}`);
        }
    }

    if (input.tags && input.tags.length > 0) {
        parts.push(`Tags: ${input.tags.join(', ')}`);
    }

    if (input.reviews && input.reviews.length > 0) {
        const reviewSnippets = input.reviews.slice(0, 3).map(r => r.slice(0, 200));
        parts.push(`Review excerpts:\n${reviewSnippets.join('\n---\n')}`);
    }

    return parts.join('\n\n');
}

function buildEmbeddingText(input: AnalystInput, richDescription: string): string {
    const parts: string[] = [
        input.title,
        input.categoryType.replace(/_/g, ' '),
        richDescription,
    ];

    if (input.tags && input.tags.length > 0) {
        parts.push(input.tags.join(' '));
    }

    // Include key metadata values
    if (input.metadata) {
        const keyFields = ['genres', 'directors', 'actors', 'authors', 'developers', 'themes'];
        for (const field of keyFields) {
            const value = input.metadata[field];
            if (value) {
                if (Array.isArray(value)) {
                    parts.push(value.join(' '));
                } else if (typeof value === 'string') {
                    parts.push(value);
                }
            }
        }
    }

    return parts.join(' ').slice(0, 8000); // Voyage max input consideration
}

// ============================================================================
// CURATOR AGENT
// ============================================================================

const CURATOR_SYSTEM_PROMPT = `You are The Curator, an expert at understanding complex media discovery queries and extracting structured search parameters.

Your task is to analyze natural language queries about media (movies, games, books, etc.) and extract:
1. Optimized search query for semantic matching
2. Applicable filters (categories, year range, mood, themes)
3. User intent classification

Query Intent Types:
- "discovery": Looking for new recommendations (e.g., "something like Blade Runner")
- "specific": Looking for a known item (e.g., "that movie with Tom Hanks and the volleyball")
- "comparative": Comparing or ranking items (e.g., "best horror games of 2023")
- "exploratory": Broad exploration (e.g., "underrated sci-fi from the 90s")

Respond with a JSON object containing:
{
  "searchQuery": "optimized query string for embedding search",
  "filters": {
    "categories": ["movie", "tv_show", etc.] or null,
    "yearMin": number or null,
    "yearMax": number or null,
    "mood": ["dark", "uplifting", "tense", etc.] or null,
    "themes": ["revenge", "survival", "romance", etc.] or null
  },
  "intent": "discovery" | "specific" | "comparative" | "exploratory"
}`;

/**
 * The Curator Agent
 * Parses complex user queries into structured search parameters.
 */
export async function curateQuery(input: CuratorInput): Promise<CuratorOutput> {
    const userPrompt = buildCuratorPrompt(input);

    try {
        const response = await callLLMForJSON(
            userPrompt,
            CURATOR_SYSTEM_PROMPT,
            { maxTokens: 300 }
        );

        const parsed = JSON.parse(response);

        return {
            searchQuery: parsed.searchQuery || input.query,
            filters: {
                categories: parsed.filters?.categories || input.context?.preferredCategories,
                yearMin: parsed.filters?.yearMin || input.context?.yearRange?.min,
                yearMax: parsed.filters?.yearMax || input.context?.yearRange?.max,
                mood: parsed.filters?.mood || [],
                themes: parsed.filters?.themes || [],
            },
            intent: parsed.intent || 'exploratory',
        };
    } catch (error) {
        console.error('[Orchestrator] Curator error:', error);

        // Fallback to basic query pass-through
        return {
            searchQuery: input.query,
            filters: {
                categories: input.context?.preferredCategories,
                yearMin: input.context?.yearRange?.min,
                yearMax: input.context?.yearRange?.max,
            },
            intent: 'exploratory',
        };
    }
}

function buildCuratorPrompt(input: CuratorInput): string {
    let prompt = `User query: "${input.query}"`;

    if (input.context) {
        const contextParts: string[] = [];

        if (input.context.preferredCategories?.length) {
            contextParts.push(`Preferred categories: ${input.context.preferredCategories.join(', ')}`);
        }
        if (input.context.excludeCategories?.length) {
            contextParts.push(`Exclude categories: ${input.context.excludeCategories.join(', ')}`);
        }
        if (input.context.yearRange) {
            const { min, max } = input.context.yearRange;
            if (min && max) {
                contextParts.push(`Year range: ${min}-${max}`);
            } else if (min) {
                contextParts.push(`After year: ${min}`);
            } else if (max) {
                contextParts.push(`Before year: ${max}`);
            }
        }

        if (contextParts.length > 0) {
            prompt += `\n\nContext:\n${contextParts.join('\n')}`;
        }
    }

    return prompt;
}

// ============================================================================
// ORCHESTRATED SEARCH
// ============================================================================

import { searchItems, type HybridSearchOptions } from '@/lib/services/search';

/**
 * Orchestrated search that uses the Curator agent to parse queries
 * before performing hybrid search.
 */
export async function orchestratedSearch(
    query: string,
    options: {
        useAgent?: boolean;
        preferredCategories?: string[];
        limit?: number;
    } = {}
) {
    const { useAgent = true, preferredCategories, limit = 20 } = options;

    let searchQuery = query;
    let categoryFilter: string | undefined;
    let curatorOutput: CuratorOutput | undefined;

    // Use Curator agent to parse complex queries
    if (useAgent && query.length > 10) {
        try {
            curatorOutput = await curateQuery({
                query,
                context: { preferredCategories },
            });

            searchQuery = curatorOutput.searchQuery;

            // Use first category from filters if available
            if (curatorOutput.filters.categories?.length === 1) {
                categoryFilter = curatorOutput.filters.categories[0];
            }
        } catch (error) {
            console.warn('[Orchestrator] Curator failed, using raw query:', error);
        }
    }

    // Perform hybrid search
    const searchOptions: HybridSearchOptions = {
        limit,
        categoryFilter: categoryFilter || (preferredCategories?.length === 1 ? preferredCategories[0] : undefined),
        semanticWeight: 0.6,
        keywordWeight: 0.4,
    };

    const results = await searchItems(searchQuery, searchOptions);

    return {
        results,
        parsedQuery: curatorOutput,
        appliedFilters: searchOptions,
    };
}
