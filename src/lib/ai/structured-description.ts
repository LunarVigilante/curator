/**
 * Structured 4-Part Description Generation
 * 
 * Generates descriptions in 4 focused sections:
 * - Premise (80-110 words): Setting, protagonist, central conflict
 * - Themes & Tropes (80-110 words): Themes, archetypes, industry terminology
 * - Tone & Appeal (50-70 words): Atmosphere, "for fans of X"
 * - Signature Style (40-60 words): Visual/technical signature
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { callLLM } from '@/lib/llm';
import { getLLMConfig, type LLMConfig } from '@/lib/harvesters/shared';

// ============================================================================
// TYPES
// ============================================================================

export interface StructuredDescription {
    premise: string;   // 80-110 words
    themes: string;    // 80-110 words  
    tone: string;      // 50-70 words
    style: string;     // 40-60 words
}

export interface GenerationContext {
    title: string;
    originalDescription: string;
    type: string;
    metadata?: Record<string, any>;
}

// ============================================================================
// PROMPTS
// ============================================================================

const PROMPTS = {
    premise: (ctx: GenerationContext) => ({
        system: `You are an expert media archivist. Write a detailed, compelling, and spoiler-free premise.

Instructions:
- Establish the setting and the inciting incident clearly
- Introduce the protagonist and the specific obstacles they face
- Highlight the central conflict or mystery that drives the narrative forward

Constraints:
- Do NOT use headers or labels (like "Premise:")
- Start directly with the narrative text
- Target approximately 80-110 words`,
        user: `Write the premise for: ${ctx.title}

Type: ${ctx.type}
Original context: ${ctx.originalDescription?.slice(0, 500) || 'No context available'}`
    }),

    themes: (ctx: GenerationContext) => ({
        system: `You are a literary and media analyst. Identify and elaborate on the core themes, character archetypes, and narrative tropes.

Instructions:
- Identify the major themes (e.g., "the cyclical nature of revenge," "coming of age in a war zone")
- List specific narrative tropes and archetypes using industry-standard terminology (e.g., "enemies-to-lovers," "the chosen one," "cyberpunk dystopia")
- Weave these keywords naturally into a dense, descriptive paragraph

Constraints:
- Do NOT use bullet points or headers
- Output a single block of raw text
- Target approximately 80-110 words`,
        user: `Identify themes and tropes for: ${ctx.title}

Type: ${ctx.type}
Context: ${ctx.originalDescription?.slice(0, 500) || 'No context available'}`
    }),

    tone: (ctx: GenerationContext) => ({
        system: `You are a content recommendation engine. Describe the atmosphere, emotional tone, and target audience.

Instructions:
- Describe the overall mood and emotional experience
- Compare to 2-3 similar well-known media properties ("For fans of X and Y")
- Anchor the vibe with familiar reference points

Constraints:
- Do NOT use headers
- Start directly with the description of the tone
- Target approximately 50-70 words`,
        user: `Describe the tone and appeal for: ${ctx.title}

Type: ${ctx.type}
Context: ${ctx.originalDescription?.slice(0, 500) || 'No context available'}`
    }),

    style: (ctx: GenerationContext) => ({
        system: `You are a technical art critic. Describe the unique stylistic or technical signature.

Instructions:
- Focus on visual art style, gameplay loops (if a game), cinematography (if a film), or prose style (if a book)
- Highlight what makes this ${ctx.type} visually or technically distinctive
- Be specific about techniques, aesthetics, or production values

Constraints:
- Do NOT use headers
- Start the paragraph immediately
- Target approximately 40-60 words`,
        user: `Describe the signature style for: ${ctx.title}

Type: ${ctx.type}
Context: ${ctx.originalDescription?.slice(0, 500) || 'No context available'}`
    })
};

// ============================================================================
// GENERATION FUNCTIONS
// ============================================================================

async function generatePart(
    config: LLMConfig,
    partName: keyof typeof PROMPTS,
    context: GenerationContext
): Promise<string> {
    const prompt = PROMPTS[partName](context);

    try {
        const response = await callLLM({
            provider: config.provider as 'openai' | 'openrouter' | 'anthropic',
            apiKey: config.apiKey,
            model: config.model || 'anthropic/claude-sonnet-4',
            endpoint: config.endpoint,
            userPrompt: prompt.user,
            systemPrompt: prompt.system,
            maxTokens: 300
        });

        return response.trim();
    } catch (error) {
        console.error(`Failed to generate ${partName} for ${context.title}:`, error);
        return '';
    }
}

/**
 * Generate all 4 description parts in parallel
 */
export async function generateStructuredDescription(
    supabase: ReturnType<typeof createServiceRoleClient>,
    context: GenerationContext
): Promise<StructuredDescription> {
    const config = await getLLMConfig(supabase);

    if (!config.apiKey) {
        console.warn('No LLM API key configured');
        return { premise: '', themes: '', tone: '', style: '' };
    }

    // Run all 4 prompts in parallel
    const [premise, themes, tone, style] = await Promise.all([
        generatePart(config, 'premise', context),
        generatePart(config, 'themes', context),
        generatePart(config, 'tone', context),
        generatePart(config, 'style', context)
    ]);

    return { premise, themes, tone, style };
}

/**
 * Combine structured description into a single text block for backwards compatibility
 */
export function combineDescription(parts: StructuredDescription): string {
    const sections = [
        parts.premise,
        parts.themes,
        parts.tone,
        parts.style
    ].filter(s => s && s.trim());

    return sections.join('\n\n');
}

/**
 * Build rich embedding text from item data and structured description
 */
export function buildEmbeddingText(
    item: {
        title: string;
        category_type?: string;
        description_parts?: StructuredDescription;
        description?: string;
        genres?: string[];
        cast?: string[];
        director?: string;
        studio?: string;
        developers?: string[];
        publishers?: string[];
        designers?: string[];
        mechanics?: string[];
        platforms?: string[];
        themes?: string[];
        cached_tags?: { id: string; name: string }[];
        metadata?: Record<string, any>;
    }
): string {
    const parts: string[] = [];

    // Title
    parts.push(item.title);

    // Category
    if (item.category_type) {
        parts.push(`Category: ${item.category_type}`);
    }

    // Structured description (preferred) or legacy description
    if (item.description_parts) {
        if (item.description_parts.premise) parts.push(item.description_parts.premise);
        if (item.description_parts.themes) parts.push(item.description_parts.themes);
        if (item.description_parts.tone) parts.push(item.description_parts.tone);
        if (item.description_parts.style) parts.push(item.description_parts.style);
    } else if (item.description) {
        parts.push(item.description);
    }

    // Genres
    if (item.genres?.length) {
        parts.push(`Genres: ${item.genres.join(', ')}`);
    }

    // Cast/Crew (Movies, TV)
    if (item.cast?.length) {
        parts.push(`Cast: ${item.cast.slice(0, 10).join(', ')}`);
    }
    if (item.director) {
        parts.push(`Director: ${item.director}`);
    }
    if (item.studio) {
        parts.push(`Studio: ${item.studio}`);
    }

    // Games
    if (item.developers?.length) {
        parts.push(`Developers: ${item.developers.join(', ')}`);
    }
    if (item.publishers?.length) {
        parts.push(`Publishers: ${item.publishers.join(', ')}`);
    }
    if (item.platforms?.length) {
        parts.push(`Platforms: ${item.platforms.join(', ')}`);
    }

    // Board Games
    if (item.designers?.length) {
        parts.push(`Designers: ${item.designers.join(', ')}`);
    }
    if (item.mechanics?.length) {
        parts.push(`Mechanics: ${item.mechanics.join(', ')}`);
    }

    // Tags
    if (item.cached_tags?.length) {
        parts.push(`Tags: ${item.cached_tags.map(t => t.name).join(', ')}`);
    }

    // Additional metadata
    if (item.metadata) {
        if (item.metadata.themes?.length) {
            parts.push(`Themes: ${item.metadata.themes.join(', ')}`);
        }
        if (item.metadata.keywords?.length) {
            parts.push(`Keywords: ${item.metadata.keywords.join(', ')}`);
        }
    }

    return parts.join('\n');
}
