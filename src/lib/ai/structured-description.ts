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
    semanticSummary?: string; // Optional: High-density super-sentence for Vector DB (hidden from UI)
    productionTags?: string[]; // Optional: Extracted production tags for filtering (e.g., ["Single-Camera", "Prestige"])
    bucketType?: 'NARRATIVE' | 'FORMAT' | 'OBSERVATIONAL'; // Optional: Content bucket for filtering
}

/** UI-ready description with semantic metadata stripped */
export interface DisplayDescription {
    premise: string;
    themes: string;   // Prose only, Keywords stripped
    tone: string;
    style: string;    // Prose only, Production Tags stripped
}

export interface GenerationContext {
    title: string;
    originalDescription: string;
    type: string;
    metadata?: Record<string, any>;
    /** Show status (e.g., 'Ended', 'Returning Series') - used for spoiler constraints */
    status?: string;
}

// ============================================================================
// SEMANTIC METADATA STRIPPING (For UI display)
// ============================================================================

/**
 * Strips semantic metadata (Keywords and Production Tags) from description text.
 * Use this to prepare descriptions for UI display while keeping the full version
 * in the database for vector search and filtering.
 * 
 * @param description - The full StructuredDescription with embedded metadata
 * @returns DisplayDescription - Clean prose ready for UI
 */
export function stripSemanticMetadata(description: StructuredDescription): DisplayDescription {
    return {
        premise: description.premise,
        themes: stripKeywordsLine(description.themes),
        tone: description.tone,
        style: stripProductionTagsLine(description.style)
    };
}

/**
 * Removes the "Keywords: [tag1], [tag2]..." line from themes text
 */
function stripKeywordsLine(text: string): string {
    if (!text) return '';
    // Match "Keywords:" followed by bracketed tags until end of text or double newline
    return text
        .replace(/\n*Keywords:\s*\[.*$/gim, '')
        .trim();
}

/**
 * Removes the "Production Tags: [tag1], [tag2]..." line from style text
 */
function stripProductionTagsLine(text: string): string {
    if (!text) return '';
    // Match "Production Tags:" followed by bracketed tags until end of text or double newline
    return text
        .replace(/\n*Production Tags:\s*\[.*$/gim, '')
        .trim();
}


// ============================================================================
// PROMPTS
// ============================================================================

const PROMPTS = {
    premise: (ctx: GenerationContext) => {
        // Detect if this is a completed or canceled series
        const isEnded = ctx.status === 'Ended';
        const isCanceled = ctx.status === 'Canceled' || ctx.status === 'Cancelled';

        // Build status-specific constraints (v4.2 Enhanced)
        let spoilerConstraint = '';

        if (isEnded) {
            // Ended: Legacy framing - cultural impact without resolution spoilers
            spoilerConstraint = `

LEGACY FRAMING FOR COMPLETED SERIES:
This series has concluded. Frame your description around LEGACY and CULTURAL IMPACT, not plot resolution.

REQUIRED APPROACH:
1. Summarize the complete NARRATIVE ARC (beginning → middle → climax setup)
2. Emphasize THEMES and what made this show culturally significant
3. Describe the ATMOSPHERE and emotional journey
4. Mention any genre-defining or groundbreaking elements

ABSOLUTELY DO NOT REVEAL:
- Final episode events or how the story "ends"
- Character deaths, fates, or ultimate outcomes
- Final plot twists or revelations
- Who "wins" or "survives"

FRAMING EXAMPLES:
✅ "Breaking Bad chronicles a high school teacher's transformation into a drug lord, exploring pride, desperation, and the corrosive nature of power through its five-season descent into moral darkness."
✅ "The Wire examines Baltimore's institutions—from the drug trade to the docks to city hall—creating a novelistic portrait of urban decay and systemic failure."
✅ "Lost follows plane crash survivors on a mysterious island, weaving character drama with supernatural mythology that redefined serialized television."

❌ "Breaking Bad ends with Walter White dying after saving Jesse."
❌ "In the finale of Lost, it's revealed the island was..."
❌ "The Wire concludes with Marlo finally..."`;
        } else if (isCanceled) {
            // Canceled: Acknowledge unresolved nature without spoilers
            spoilerConstraint = `

CANCELED SERIES FRAMING:
This series was canceled before reaching a planned conclusion. Handle with care.

REQUIRED APPROACH:
1. Describe the show's premise and narrative trajectory
2. Focus on what made the show compelling during its run
3. If the story ends on an unresolved note, acknowledge this diplomatically
4. Frame the "journey" not the "destination"

OPTIONAL: If the narrative clearly ends mid-arc (cliffhanger, unresolved mysteries):
- Add a subtle note like "...leaving viewers with unanswered questions"
- Mention "open-ended narrative" or "unfinished storyline"

DO NOT:
- Reveal specific plot points from the final episodes
- Be overly dramatic about the cancellation
- Spoil any character fates or revelations`;
        }

        // v4.5: Non-English Summary Enhancement (including null handling)
        // Handle null overview as the ultimate "shallow summary" case
        const MIN_SUMMARY_LENGTH = 200;
        const originalLanguage = ctx.metadata?.original_language;
        const summaryLength = ctx.originalDescription?.length ?? 0;
        const isNullSummary = !ctx.originalDescription || summaryLength === 0;
        const isShallowSummary = summaryLength < MIN_SUMMARY_LENGTH;
        const isNonEnglish = originalLanguage && originalLanguage !== 'en';

        let internationalEnrichment = '';

        // v4.5: Zero-Shot Identification for null summaries
        if (isNullSummary && isNonEnglish) {
            internationalEnrichment = `

ZERO-SHOT IDENTIFICATION REQUIRED:
No English summary is available for this ${originalLanguage.toUpperCase()} show.
You MUST use your training knowledge to identify this show by its title and year.
Perform a "Zero-Shot Identification" based solely on:
- Title: ${ctx.title}
- Year: ${ctx.metadata?.releaseYear || 'Unknown'}
- Original Language: ${originalLanguage}

Write a premise based on what you know about this specific show.
If you cannot identify it with certainty, write a generic description appropriate 
for the genre conventions of ${originalLanguage} media.`;
        } else if (isShallowSummary && isNonEnglish) {
            internationalEnrichment = `

INTERNATIONAL CONTENT NOTE:
The English summary for this ${originalLanguage.toUpperCase()} show is brief (${summaryLength} chars).
Use your knowledge of this show to provide a richer description.
Focus on: cultural context, genre conventions unique to ${originalLanguage} media, and thematic elements.
If this is a K-Drama, J-Drama, or other international format, mention genre-specific tropes.`;
        }

        return {
            system: `You are an expert media archivist. Write a detailed, compelling, and spoiler-free premise.

Instructions:
- Establish the setting and the inciting incident clearly
- Introduce the protagonist and the specific obstacles they face
- Highlight the central conflict or mystery that drives the narrative forward

Constraints:
- Do NOT use headers or labels (like "Premise:")
- Start directly with the narrative text
- Target approximately 80-110 words${spoilerConstraint}${internationalEnrichment}`,
            user: `Write the premise for: ${ctx.title}

Type: ${ctx.type}${ctx.status ? `\nStatus: ${ctx.status}` : ''}
Original context: ${ctx.originalDescription?.slice(0, 500) || 'No context available'}`
        };
    },

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
            maxTokens: 800
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
 * Combine structured description into a single text block for human display
 * NOTE: Excludes 'themes' section as it contains vector-only tags/keywords
 */
export function combineDescription(parts: StructuredDescription): string {
    // Human-readable: Premise + Tone + Style (themes is for vector DB only)
    const sections = [
        parts.premise,
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
        keywords?: string[];
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

    // VECTOR DB PRIORITY: semanticSummary + themes (Section 5 + Section 2)
    // Per checklist: Embed only vector-optimized content, not human display text
    if (item.description_parts) {
        // PRIMARY: semanticSummary is the high-density super-sentence
        if (item.description_parts.semanticSummary) {
            parts.push(item.description_parts.semanticSummary);
        }
        // SECONDARY: themes contain structured tags/keywords optimized for vectors
        if (item.description_parts.themes) {
            parts.push(item.description_parts.themes);
        }
        // NOTE: premise/tone/style are for human display, NOT embedding
    } else if (item.description) {
        // Fallback for legacy items without structured parts
        parts.push(item.description);
    }

    // Genres
    if (item.genres?.length) {
        parts.push(`Genres: ${item.genres.join(', ')}`);
    }

    // Keywords (high value for vector search)
    if (item.keywords?.length) {
        parts.push(`Keywords: ${item.keywords.join(', ')}`);
    }

    // Production Tags from description_parts (e.g., Single-Camera, Prestige)
    if (item.description_parts?.productionTags?.length) {
        parts.push(`Production: ${item.description_parts.productionTags.join(', ')}`);
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
