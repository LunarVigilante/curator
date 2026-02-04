/**
 * TV Show Structured Description Generation
 * 
 * "3-Bucket Strategy" for optimal Vector DB results:
 * Instead of dozens of genre-specific prompts, route to 3 structural engines:
 * 
 * 1. NARRATIVE (Scripted): Driven by Plot & Character
 *    - Drama, Sci-Fi, Comedy, Crime, Animation
 * 
 * 2. FORMAT (Competition/Rules): Driven by Mechanics & Winning  
 *    - Game Shows, Competitions, Talk Shows, Variety
 * 
 * 3. OBSERVATIONAL (Documentary): Driven by Topic & Access
 *    - Documentary, Docu-series, True Crime, News, "Vibe" Reality
 * 
 * Each bucket generates:
 * - Premise (60-110 words): Bucket-specific structure
 * - Themes & Tropes (70-100 words): TVTropes terminology
 * - Tone & Appeal (50-90 words): "For Fans Of" anchors
 * - Signature Style (40-60 words): Visual/audio fingerprint
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { callLLM } from '@/lib/llm';
import { getLLMConfig, type LLMConfig } from '@/lib/harvesters/shared';
import type { StructuredDescription, GenerationContext } from './structured-description';

// ============================================================================
// 3-BUCKET DETECTION SYSTEM
// ============================================================================

export type TvBucket = 'NARRATIVE' | 'FORMAT' | 'OBSERVATIONAL';

// Keywords that indicate FORMAT bucket (Game/Competition)
const FORMAT_KEYWORDS = [
    'game show', 'competition', 'elimination', 'quiz', 'contest',
    'talent show', 'cooking competition', 'singing competition',
    'dating competition', 'race', 'challenge', 'bake off', 'survivor',
    'winner', 'prize', 'judges', 'audition', 'panel show', 'variety'
];

// Genres that indicate FORMAT bucket
const FORMAT_GENRES = [
    'Game Show', 'Reality Competition', 'Talk Show', 'Variety', 'Talk'
];

// Genres that indicate OBSERVATIONAL bucket  
const OBSERVATIONAL_GENRES = [
    'Documentary', 'News', 'Docuseries', 'True Crime'
];

// Keywords that indicate non-competition reality (OBSERVATIONAL)
const OBSERVATIONAL_KEYWORDS = [
    'documentary', 'docuseries', 'true crime', 'investigation',
    'behind the scenes', 'real life', 'follows', 'chronicles'
];

/**
 * Determine which structural bucket a TV show belongs to
 */
export function detectTvBucket(
    genres?: string[],
    keywords?: string[],
    synopsis?: string
): TvBucket {
    const genresLower = genres?.map(g => g.toLowerCase()) || [];
    const keywordsLower = keywords?.map(k => k.toLowerCase()) || [];
    const synopsisLower = synopsis?.toLowerCase() || '';

    // 1. Check for FORMAT markers first (Competition/Game/Rules)
    const hasFormatKeyword = FORMAT_KEYWORDS.some(fk =>
        keywordsLower.some(k => k.includes(fk)) || synopsisLower.includes(fk)
    );
    const hasFormatGenre = FORMAT_GENRES.some(fg =>
        genresLower.some(g => g.includes(fg.toLowerCase()))
    );
    if (hasFormatKeyword || hasFormatGenre) {
        return 'FORMAT';
    }

    // 2. Check for OBSERVATIONAL markers (Documentary/News)
    const hasObservationalGenre = OBSERVATIONAL_GENRES.some(og =>
        genresLower.some(g => g.includes(og.toLowerCase()))
    );
    if (hasObservationalGenre) {
        return 'OBSERVATIONAL';
    }

    // 3. Check for Non-Competition Reality (e.g., Kardashians, Real Housewives)
    const isReality = genresLower.some(g => g.includes('reality'));
    const isCompetition = FORMAT_KEYWORDS.some(fk =>
        keywordsLower.some(k => k.includes(fk)) || synopsisLower.includes(fk)
    );
    if (isReality && !isCompetition) {
        // Reality but not competition = Observational (docu-soap)
        return 'OBSERVATIONAL';
    }

    // Check for observational keywords in synopsis
    const hasObservationalKeyword = OBSERVATIONAL_KEYWORDS.some(ok =>
        synopsisLower.includes(ok)
    );
    if (hasObservationalKeyword) {
        return 'OBSERVATIONAL';
    }

    // 4. Default to NARRATIVE for everything else (Drama, Comedy, Sci-Fi, etc.)
    return 'NARRATIVE';
}

// ============================================================================
// GENRE LENS DETECTION (NARRATIVE Sub-Classification)
// ============================================================================

export type GenreLens = 'SCI_FI_FANTASY' | 'CRIME_THRILLER' | 'DRAMA_ROMANCE' | 'GENERAL';

// Genre clusters for lens detection
const SCI_FI_FANTASY_GENRES = [
    'sci-fi', 'science fiction', 'fantasy', 'supernatural', 'horror',
    'action & adventure', 'animation'
];

const CRIME_THRILLER_GENRES = [
    'crime', 'thriller', 'mystery', 'action', 'war', 'espionage',
    'political', 'legal'
];

const DRAMA_ROMANCE_GENRES = [
    'drama', 'romance', 'family', 'soap', 'melodrama',
    'coming of age', 'slice of life'
];

/**
 * Detect the genre lens for NARRATIVE shows
 * Used to select genre-specific premise prompts
 */
export function detectGenreLens(genres?: string[]): GenreLens {
    if (!genres?.length) return 'GENERAL';

    const genresLower = genres.map(g => g.toLowerCase());

    // Count matches for each cluster
    const sciFiCount = SCI_FI_FANTASY_GENRES.filter(sg =>
        genresLower.some(g => g.includes(sg))
    ).length;

    const crimeCount = CRIME_THRILLER_GENRES.filter(cg =>
        genresLower.some(g => g.includes(cg))
    ).length;

    const dramaCount = DRAMA_ROMANCE_GENRES.filter(dg =>
        genresLower.some(g => g.includes(dg))
    ).length;

    // Return the cluster with most matches
    if (sciFiCount > crimeCount && sciFiCount > dramaCount) {
        return 'SCI_FI_FANTASY';
    }
    if (crimeCount > sciFiCount && crimeCount > dramaCount) {
        return 'CRIME_THRILLER';
    }
    if (dramaCount > 0) {
        return 'DRAMA_ROMANCE';
    }

    // Catchall for Comedy, Western, etc.
    return 'GENERAL';
}

/**
 * @deprecated Use detectTvBucket instead
 * Kept for backwards compatibility
 */
export function isUnscriptedTvShow(
    genres?: string[],
    keywords?: string[],
    description?: string
): boolean {
    const bucket = detectTvBucket(genres, keywords, description);
    return bucket !== 'NARRATIVE';
}

// ============================================================================
// TV SHOW PROMPT CONTEXT
// ============================================================================

interface TvPromptContext extends GenerationContext {
    bucket: TvBucket;
    castWithCharacters?: Array<{ name: string; character: string }>;
    keywords?: string[];
    genres?: string[];
    contentDescriptors?: string[];
    networks?: string[];
}

/**
 * Build context string with all available grounding data
 */
function buildGroundingContext(ctx: TvPromptContext): string {
    const parts: string[] = [];

    parts.push(`Title: ${ctx.title}`);

    if (ctx.originalDescription) {
        parts.push(`Synopsis: ${ctx.originalDescription.slice(0, 600)}`);
    }

    if (ctx.genres?.length) {
        parts.push(`Genres: ${ctx.genres.join(', ')}`);
    }

    if (ctx.keywords?.length) {
        parts.push(`Keywords: ${ctx.keywords.slice(0, 15).join(', ')}`);
    }

    if (ctx.networks?.length) {
        parts.push(`Network: ${ctx.networks.join(', ')}`);
    }

    if (ctx.castWithCharacters?.length) {
        const castStr = ctx.castWithCharacters
            .slice(0, 8)
            .map(c => c.character ? `${c.name} as ${c.character}` : c.name)
            .join(', ');
        parts.push(`Cast: ${castStr}`);
    }

    if (ctx.contentDescriptors?.length) {
        parts.push(`Content Warnings: ${ctx.contentDescriptors.join(', ')}`);
    }

    return parts.join('\n');
}

// ============================================================================
// BUCKET 1: NARRATIVE (Scripted) PREMISE - Genre Lens Variants
// ============================================================================

// Lens 1A: Sci-Fi & Fantasy
const PREMISE_NARRATIVE_SCI_FI = (ctx: TvPromptContext) => ({
    system: `You are an expert speculative fiction curator. Write a high-density, spoiler-free premise for this sci-fi/fantasy series.

Instructions:
- THE SETTING (Vector Anchor): Open with a 5-10 word phrase establishing the era, world-state, and atmosphere (e.g., "In a rain-slicked, near-future Tokyo..." or "In the war-torn kingdoms of the Seven Realms...").
- THE CONCEIT: Define the unique laws of this world. What supernatural, technological, or magical system underpins everything? (e.g., "Where magic is fueled by human memory" or "Where humanity shares space with sentient AI").
- THE PROTAGONIST: Identify the lead by name and a compound archetype (e.g., "Kira, a disgraced technomancer" or "Jon, a reluctant heir to an ancient bloodline").
- THE CONFLICT: Define the existential threat or prophecy driving the narrative.

CRITICAL CONSTRAINT: Do NOT invent characters. Use only the provided cast data. Focus on worldbuilding and stakes.

Target Length: 70-110 words.`,
    user: buildGroundingContext(ctx)
});

// Lens 1B: Crime & Thriller
const PREMISE_NARRATIVE_CRIME = (ctx: TvPromptContext) => ({
    system: `You are a crime fiction analyst specializing in procedurals and noir. Write a high-density, spoiler-free premise for this crime/thriller series.

Instructions:
- THE SETTING (Vector Anchor): Open with a 5-10 word phrase establishing location and atmosphere (e.g., "In the heroin-flooded streets of 1990s Baltimore..." or "Within the glass towers of corporate Manhattan...").
- THE INCITING CRIME: State the specific crime or case that drives the series (e.g., "A serial killer targeting prosecutors" or "A billion-dollar fraud implicating the FBI").
- THE INVESTIGATOR: Identify the lead by name and their unique angle or flaw (e.g., "Sarah, a forensic accountant with photographic memory" or "Marcus, a disgraced detective seeking redemption").
- THE STAKES: What happens if they fail? Who is protected by the conspiracy?

CRITICAL CONSTRAINT: Do NOT invent characters. Use only the provided cast data. Focus on the investigation and legal/criminal stakes.

Target Length: 70-110 words.`,
    user: buildGroundingContext(ctx)
});

// Lens 1C: Drama & Romance  
const PREMISE_NARRATIVE_DRAMA = (ctx: TvPromptContext) => ({
    system: `You are a prestige drama curator specializing in character studies and relationship dynamics. Write a high-density, spoiler-free premise for this drama/romance series.

Instructions:
- THE SETTING (Vector Anchor): Open with a 5-10 word phrase establishing setting and emotional temperature (e.g., "In the suffocating privilege of 1920s English aristocracy..." or "Across the fractured suburbs of modern Los Angeles...").
- THE FRICTION: Identify the core emotional wound, social barrier, or family tension (e.g., "Where inherited wealth masks generational trauma" or "Where class divides threaten forbidden love").
- THE PROTAGONIST: Identify the lead by name and their internal conflict (e.g., "Beth, a chess prodigy battling addiction" or "Anna, a wife whose perfect life conceals a secret past").
- THE QUESTION: What must they choose between, sacrifice, or confront?

CRITICAL CONSTRAINT: Do NOT invent characters. Use only the provided cast data. Focus on emotional complexity and relationship stakes.

Target Length: 70-110 words.`,
    user: buildGroundingContext(ctx)
});

// Lens 1D: General (Comedy, Western, Period, etc.)
const PREMISE_NARRATIVE_GENERAL = (ctx: TvPromptContext) => ({
    system: `You are an expert media curator. Write a high-density, spoiler-free premise for this scripted series.

Instructions:
- THE SETTING (Vector Anchor): Open with a 5-10 word phrase establishing the time, location, and atmosphere (e.g., "In 1960s Madison Avenue..." or "Across the dusty frontier of 19th-century Montana...").
- THE HOOK: What unique angle or premise drives this series? Define the show's central conceit in one clear sentence.
- THE PROTAGONIST: Identify the lead by name and a compound archetype (e.g., "Ted, an eternally optimistic soccer coach" or "Walter, a chemistry teacher turned drug kingpin").
- THE CONFLICT: Define the primary obstacle, antagonist, or situation preventing stability.

CRITICAL CONSTRAINT: Do NOT invent characters. Use only the provided cast data. Do NOT use "In a world where..." or "A story about..."

Target Length: 60-100 words.`,
    user: buildGroundingContext(ctx)
});

/**
 * Get the appropriate NARRATIVE premise prompt based on genre lens
 */
function getPremisePromptForLens(lens: GenreLens, ctx: TvPromptContext) {
    switch (lens) {
        case 'SCI_FI_FANTASY':
            return PREMISE_NARRATIVE_SCI_FI(ctx);
        case 'CRIME_THRILLER':
            return PREMISE_NARRATIVE_CRIME(ctx);
        case 'DRAMA_ROMANCE':
            return PREMISE_NARRATIVE_DRAMA(ctx);
        case 'GENERAL':
        default:
            return PREMISE_NARRATIVE_GENERAL(ctx);
    }
}

// ============================================================================
// BUCKET 2: FORMAT (Competition & Rules) PREMISE
// ============================================================================

const PREMISE_FORMAT = (ctx: TvPromptContext) => ({
    system: `You are a TV format analyst specializing in game mechanics and show structure.

Instructions:
- THE ENGINE: Define the format immediately (e.g., "Blind-audition singing competition," "Sudden-death baking gauntlet," "Celebrity panel show").
- THE MECHANICS: Explain the rules. What do participants physically do? (e.g., "Contestants must craft high-end furniture using only recycled scrap metal").
- THE STAKES: What is the win condition? (e.g., "A $250,000 cash prize," "The 'Golden Microphone' trophy").
- THE VIBE: Is it cutthroat and strategic (like Survivor) or wholesome and skill-based (like Bake Off)?

CRITICAL CONSTRAINT: Focus on the "game," not a narrative arc. Use terms like "contestants," "judges," and "hosts."

Target Length: 60-90 words.`,
    user: buildGroundingContext(ctx)
});

// ============================================================================
// BUCKET 3: OBSERVATIONAL (Documentary & Docu-Reality) PREMISE
// ============================================================================

const PREMISE_OBSERVATIONAL = (ctx: TvPromptContext) => ({
    system: `You are a social historian and documentary curator. Describe the subject and access of this program.

Instructions:
- THE SUBJECT: What is the specific topic or sub-culture being investigated? (e.g., "The global black market for rare antiquities" or "The high-pressure world of Hamptons real estate").
- THE LENS (Type Specific):
  * IF Documentary: What is the core question or "new truth" being uncovered?
  * IF Reality/Docu-soap: What are the interpersonal dynamics? (e.g., "Navigating the clash between family loyalty and corporate ambition").
- THE KEY FIGURES: Identify the subjects or "archetypes" (e.g., "Led by historian David Smith" or "Featuring the matriarch, Kris").
- THE ACCESS: What makes this unique? (e.g., "Never-before-seen archival footage," "Unfiltered access to the courtroom").

CRITICAL CONSTRAINT: Do not treat this as a fictional story. Focus on real-world observation and subject matter.

Target Length: 60-90 words.`,
    user: buildGroundingContext(ctx)
});

// ============================================================================
// THEMES & TAXONOMY PROMPT (Bucket-Aware Hybrid Output)
// ============================================================================

/**
 * Build bucket-specific trope context guidance
 */
function getTropeContext(bucket: TvBucket): string {
    switch (bucket) {
        case 'FORMAT':
            return 'Look for Game Theory and Reality TV editing tropes (e.g., "The Alliance", "The Floater", "The Villain Edit", "Underdog Story", "Vote Manipulation").';
        case 'OBSERVATIONAL':
            return 'Look for journalistic framing and bias tropes (e.g., "Unreliable Narrator", "Fly-on-the-Wall", "True Crime", "Cult of Personality").';
        case 'NARRATIVE':
        default:
            return 'Look for literary and cinematic tropes (e.g., "Enemies-to-Lovers", "The Anti-Hero", "Whodunit", "Found Family", "Dark and Troubled Past").';
    }
}

const THEMES_PROMPT = (ctx: TvPromptContext) => ({
    system: `You are a Cultural Taxonomist and Media Analyst. Identify the core narrative DNA of this show.

PART 1: THE ANALYSIS (For Humans)
Write a cohesive, 2-3 sentence insight that explains how this show uses its themes.

${ctx.bucket === 'NARRATIVE' ? `- Focus on the philosophical questions (e.g., "The corruption of power") and how specific tropes drive the plot.` : ''}${ctx.bucket === 'FORMAT' ? `- Focus on the strategic dynamics (e.g., "The tension between 'Social Strategy' and 'Physical Dominance'").` : ''}${ctx.bucket === 'OBSERVATIONAL' ? `- Focus on the sociological lens (e.g., "A 'Fly-on-the-Wall' examination of the American justice system").` : ''}

PART 2: THE SEMANTIC TAGS (For Indexing)
After your analysis, provide a structured list of 6-8 standardized tags.
- Macro Themes: Broad concepts (e.g., Revenge, Ambition, Survival, Family Dysfunction)
- Micro Tropes: Specific narrative devices from TVTropes.org or Reality TV terminology

CRITICAL CONSTRAINTS:
- Format the tags exactly as: **Keywords:** [Tag 1], [Tag 2], [Tag 3]...
- Ensure tropes are standard industry terms, not generic descriptions
- ${getTropeContext(ctx.bucket)}

Example Output:
"A Shakespearean tragedy wrapped in corporate satire, exploring how Generational Trauma poisons the pursuit of the American Dream. The narrative deconstructs the Magnificent Bastard archetype, using a King Lear structure where power is promised but never delivered."

**Keywords:** [Generational Trauma], [Corporate Intrigue], [Dysfunctional Family], [The Anti-Hero], [Power Struggle], [Dark Comedy], [Eat the Rich]`,
    user: `Show Bucket: ${ctx.bucket}\n\n${buildGroundingContext(ctx)}`
});

// ============================================================================
// TONE & APPEAL PROMPT (Vector Triangulation Strategy)
// ============================================================================

/**
 * Build bucket-specific tone hints to guide adjective selection
 */
function getToneHints(bucket: TvBucket): string {
    switch (bucket) {
        case 'FORMAT':
            return 'Tone Hints: [High-Stakes, Strategic, Skill-based, Chaotic, Drama-heavy, Cutthroat, Wholesome, Trashy-Fun, Campy, Paranoiac]';
        case 'OBSERVATIONAL':
            return 'Tone Hints: [Investigative, Salacious, Inspirational, Educational, Raw, Voyeuristic, Intimate, Haunting, Unflinching]';
        case 'NARRATIVE':
        default:
            return 'Tone Hints: [Cerebral, Kinetic, Slow-burn, Surreal, Gritty, Heartfelt, Claustrophobic, Operatic, Neon-Noir, Whimsical]';
    }
}

const TONE_PROMPT = (ctx: TvPromptContext) => ({
    system: `You are a Content Recommendation Engine and "Vibe" Curator. Construct a psychological and emotional profile of this show.

1. THE ATMOSPHERE (Adjective Bank)
Select exactly 3 high-precision adjectives that define the "Texture" of the show.
- CONSTRAINT: Do NOT use generic words like "Dramatic" or "Funny"
${ctx.bucket === 'NARRATIVE' ? '- Focus on cinematography and mood (e.g., Claustrophobic, Neon-Noir, Whimsical, Gritty, Operatic)' : ''}${ctx.bucket === 'FORMAT' ? '- Focus on energy and social dynamics (e.g., Cutthroat, Wholesome, Trashy-Fun, Paranoiac, Campy)' : ''}${ctx.bucket === 'OBSERVATIONAL' ? '- Focus on emotional texture and access (e.g., Voyeuristic, Educational, Raw, Haunting, Intimate)' : ''}

2. THE EXPERIENCE (One Sentence)
Write one sentence describing the emotional aftertaste. How does the viewer feel while watching?
- Example: "A high-anxiety watch that leaves you paranoid about technology."
- Example: "A 'comfort food' series designed to be watched with a glass of wine."

3. VECTOR TRIANGULATION (For Fans Of)
Identify 3 distinct media properties to anchor this show in the recommendation space. You MUST state WHY for each:
- **Anchor A (Structure):** "For fans of [Show X]'s pacing and format."
- **Anchor B (Tone):** "Combines the mood/humor of [Show Y]..."
- **Anchor C (Audience):** "...with the target demographic of [Show Z]."

4. THE AUDIENCE TARGET
Define the specific niche tribe this appeals to.
- Example: "Hardcore history buffs," "Gen-Z dating show addicts," "Lovers of slow-burn Nordic Noir"

Format your response with clear section headers: **Atmosphere:**, **Experience:**, **For Fans Of:**, **Target Audience:**`,
    user: `Show Bucket: ${ctx.bucket}\n${getToneHints(ctx.bucket)}\n\n${buildGroundingContext(ctx)}`
});

// ============================================================================
// SIGNATURE STYLE PROMPT (Sensory Fingerprint Strategy)
// ============================================================================

/**
 * Build network-aware production inference hints
 */
function getProductionHints(networks?: string[], bucket?: TvBucket): string {
    const networkStr = networks?.join(', ').toLowerCase() || '';
    const hints: string[] = [];

    // Network-based production tier inference
    if (networkStr.includes('hbo') || networkStr.includes('fx') || networkStr.includes('amc')) {
        hints.push('Likely Prestige TV: Cinematic single-camera, high production value');
    } else if (networkStr.includes('netflix') || networkStr.includes('amazon') || networkStr.includes('apple')) {
        hints.push('Streaming-era production: Likely cinematic, may have blockbuster budget');
    } else if (networkStr.includes('cbs') || networkStr.includes('abc') || networkStr.includes('nbc') || networkStr.includes('fox')) {
        hints.push('Broadcast network: Could be multi-camera studio or polished single-camera');
    } else if (networkStr.includes('discovery') || networkStr.includes('tlc') || networkStr.includes('bravo') || networkStr.includes('mtv')) {
        hints.push('Reality/Cable: Glossy produced reality or raw documentary style');
    }

    // Bucket-based hints
    if (bucket === 'FORMAT') {
        hints.push('Competition/Talk format: Consider studio lighting, graphics, host staging');
    } else if (bucket === 'OBSERVATIONAL') {
        hints.push('Documentary style: Consider handheld vs. produced, interview setups');
    }

    return hints.length > 0 ? `Production Context: ${hints.join('. ')}` : '';
}

const STYLE_PROMPT = (ctx: TvPromptContext) => ({
    system: `You are a Technical Art Critic and Production Analyst. Based on the network, genre, and content, describe the audio-visual identity of this show.

1. THE VISUAL AESTHETIC (The Look)
Describe the camera work and color grading.
${ctx.bucket === 'NARRATIVE' ? `- Is it "Cinematic Single-Camera" (like a movie) or "Multi-Camera Studio" (like a stage play)?
- Is the lighting "Naturalistic and Gritty" or "Glossy and High-Key"?
- Be specific about the "Temperature" (e.g., "Cold blue filters," "Warm nostalgic sepia," "Neon-soaked")` : ''}${ctx.bucket === 'FORMAT' ? `- Is it "Glossy Studio Production" with branded graphics, or "Intimate Stage Setup"?
- Describe the competition staging, judge panels, or talk show set design` : ''}${ctx.bucket === 'OBSERVATIONAL' ? `- Is it "Glossy/Produced" (like The Bachelor) or "Raw/Handheld" (like Cops)?
- Describe interview setups, b-roll style, archival footage usage` : ''}

2. THE AUDIO & PACING (The Pulse)
Describe the sound design and editing rhythm.
- Keywords to consider: Rapid-fire dialogue, Meditative, Frenetic cuts, Synth-heavy score, Orchestral swell, Minimalist, Laugh track, Reality confessionals, Dramatic stings

3. PRODUCTION TAGS (For Indexing)
Provide exactly 3-5 technical keywords that categorize the production format.
- Format as: **Production Tags:** [Tag 1], [Tag 2], [Tag 3]...
- Examples: [Single-Camera], [Multi-Camera], [Mockumentary Style], [CGI-Heavy], [Period Accurate], [Lo-Fi], [Blockbuster Budget], [Laugh Track], [No Score], [Handheld], [Studio Set], [On-Location]

CRITICAL: The Production Tags are essential for Vector indexing. They separate "Prestige TV" from "Broadcast TV" from "Indie/Web" productions.`,
    user: `Show Bucket: ${ctx.bucket}\n${getProductionHints(ctx.networks, ctx.bucket)}\n\n${buildGroundingContext(ctx)}`
});

// ============================================================================
// SEMANTIC SUMMARY PROMPT (Vector DB Super-Sentence)
// ============================================================================

/**
 * High-density metadata sentence for Vector DB indexing
 * Hidden from users, used to create strong embedding "center of gravity"
 */
const SEMANTIC_SUMMARY_PROMPT = (ctx: TvPromptContext) => ({
    system: `You are a Semantic SEO Specialist for a video search engine.

Task: Create a single, high-density "Semantic Super-Sentence" (max 60 words) designed for vector retrieval.

IMPORTANT: This will NOT be shown to users. It is purely for search indexing.

${ctx.bucket === 'NARRATIVE' ? `FORMULA (Scripted/Narrative):
[Adjective] + [Time/Setting] + [Sub-Genre] + focusing on + [Core Conflict] + combining the [Attribute A] of [Comp 1] + with the [Attribute B] of [Comp 2].

Example: "A claustrophobic, near-future dystopian thriller focusing on a corporate severance procedure that splits memories, combining the surreal workplace satire of The Office with the psychological horror of Black Mirror."` : ''}${ctx.bucket === 'FORMAT' ? `FORMULA (Competition/Format):
[Adjective] + [Format Type] + where + [Participant Type] + must + [Core Mechanic] + for + [Prize], similar to [Comp 1] meets [Comp 2].

Example: "A cutthroat fashion design competition where professional tailors must create runway looks under extreme time constraints for a cash prize, acting as a high-stakes fusion of Project Runway meets Squid Game."` : ''}${ctx.bucket === 'OBSERVATIONAL' ? `FORMULA (Documentary/Observational):
[Adjective] + [Topic/Subject] + docu-series + following + [Key Figures/Archetypes] + as they navigate + [Central Tension], appealing to fans of [Comp 1].

Example: "A scandalous, fly-on-the-wall true crime docu-series following the bizarre feud between exotic animal zoo owners, appealing to fans of the eccentric character study found in Tiger King."` : ''}

CRITICAL CONSTRAINTS:
- Start with a strong adjective (this weights heavily in embeddings)
- Include at least 2 comparison shows using "combines X with Y" or "similar to X meets Y"
- No fluff words like "The show is about..." - every word must carry meaning
- Max 60 words`,
    user: `Show Bucket: ${ctx.bucket}\n\n${buildGroundingContext(ctx)}`
});

// ============================================================================
// MAIN GENERATION FUNCTION
// ============================================================================

/**
 * Generate structured description specifically for TV shows
 * Uses Semantic Weaving prompts with 3-bucket detection
 * Generates 5 parts: premise, themes, tone, style, semanticSummary
 */
export async function generateTvShowDescription(
    supabase: ReturnType<typeof createServiceRoleClient>,
    context: GenerationContext & {
        castWithCharacters?: Array<{ name: string; character: string }>;
        keywords?: string[];
        genres?: string[];
        contentDescriptors?: string[];
        networks?: string[];
    }
): Promise<StructuredDescription> {
    const config = await getLLMConfig(supabase);

    if (!config.apiKey) {
        console.warn('No LLM API key configured');
        return { premise: '', themes: '', tone: '', style: '' };
    }

    // Detect which structural bucket this show belongs to
    const bucket = detectTvBucket(
        context.genres,
        context.keywords,
        context.originalDescription
    );

    console.log(`[TV Description] "${context.title}" detected as bucket: ${bucket}`);

    const tvContext: TvPromptContext = {
        ...context,
        bucket
    };

    // Select appropriate premise prompt based on bucket
    let premisePrompt;
    switch (bucket) {
        case 'FORMAT':
            premisePrompt = PREMISE_FORMAT(tvContext);
            break;
        case 'OBSERVATIONAL':
            premisePrompt = PREMISE_OBSERVATIONAL(tvContext);
            break;
        case 'NARRATIVE':
        default:
            // Use Genre Lens to select appropriate NARRATIVE sub-prompt
            const lens = detectGenreLens(context.genres);
            console.log(`[TV Description] NARRATIVE lens: ${lens}`);
            premisePrompt = getPremisePromptForLens(lens, tvContext);
            break;
    }

    // Generate all 5 parts in parallel (semanticSummary is hidden from users)
    const [premise, themes, tone, style, semanticSummary] = await Promise.all([
        callLLMWithConfig(config, premisePrompt),
        callLLMWithConfig(config, THEMES_PROMPT(tvContext)),
        callLLMWithConfig(config, TONE_PROMPT(tvContext)),
        callLLMWithConfig(config, STYLE_PROMPT(tvContext)),
        callLLMWithConfig(config, SEMANTIC_SUMMARY_PROMPT(tvContext))
    ]);

    // Extract production tags from style output (e.g., [Single-Camera], [Prestige])
    const productionTags = extractProductionTags(style);

    return {
        premise,
        themes,
        tone,
        style,
        semanticSummary,
        productionTags,
        bucketType: bucket
    };
}

/**
 * Extract bracketed production tags from style text
 * e.g., "[Single-Camera], [Prestige]" -> ["Single-Camera", "Prestige"]
 */
function extractProductionTags(styleText: string): string[] {
    const tagPattern = /\[([^\]]+)\]/g;
    const tags: string[] = [];
    let match;

    while ((match = tagPattern.exec(styleText)) !== null) {
        const tag = match[1].trim();
        if (tag && tag.length > 1 && tag.length < 50) {
            tags.push(tag);
        }
    }

    return tags;
}

async function callLLMWithConfig(
    config: LLMConfig,
    prompt: { system: string; user: string }
): Promise<string> {
    try {
        const response = await callLLM({
            provider: config.provider as 'openai' | 'openrouter' | 'anthropic',
            apiKey: config.apiKey,
            model: config.model || 'anthropic/claude-sonnet-4',
            endpoint: config.endpoint,
            userPrompt: prompt.user,
            systemPrompt: prompt.system,
            maxTokens: 600
        });
        return response.trim();
    } catch (error) {
        console.error('Failed to generate TV description part:', error);
        return '';
    }
}

// ============================================================================
// EMBEDDING TEXT BUILDER (Comprehensive Schema)
// ============================================================================

/**
 * Complete TV show data for embedding generation
 * Includes all fields needed for the comprehensive schema
 */
export interface TvShowEmbeddingData {
    // Core identity
    title: string;
    release_year?: number;
    end_year?: number;

    // Type info
    status?: string;              // "Returning Series", "Ended", etc.
    content_rating?: string;      // "TV-MA", "TV-14", etc.
    runtime?: number;             // Average episode runtime in minutes

    // Categorical
    genres?: string[];
    keywords?: string[];          // TMDB keywords

    // AI-generated tags (from 4-bucket taxonomy)
    tags?: {
        sub_genres?: string[];
        tropes?: string[];
        mood?: string[];
        format?: string[];
    };

    // AI-generated descriptions (cached LLM output)
    description_parts?: {
        premise?: string;
        themes?: string;
        tone?: string;
        style?: string;
    };

    // Tagline
    tagline?: string;

    // Stats
    number_of_seasons?: number;
    number_of_episodes?: number;

    // Production
    networks?: string[];
    production_companies?: string[];
    created_by?: string[];

    // Cast with roles
    cast_with_characters?: Array<{ name: string; character: string }>;

    // Ratings & Awards
    awards?: string;
    imdb_rating?: number;
    imdb_votes?: number;
    rt_score?: number;
}

/**
 * Build comprehensive embedding text for TV shows
 * 
 * Schema Design Principles:
 * - "Topic Lock" keywords in first ~50 tokens for semantic anchoring
 * - Structured sections for different signal types
 * - "Vibe Match" tags (tropes, mood) for similarity clustering
 * - Credits at end for entity matching without dominating
 * 
 * Used by:
 * - Initial harvesting (full generation)
 * - Re-hydration (cached descriptions + fresh stats)
 */
export function buildTvShowEmbeddingText(item: TvShowEmbeddingData): string {
    const lines: string[] = [];

    // =========================================================================
    // TITLE LINE: Identity with temporal context
    // =========================================================================
    const yearRange = item.end_year && item.end_year !== item.release_year
        ? `${item.release_year || '?'}-${item.end_year}`
        : item.release_year
            ? `${item.release_year}-`
            : '';

    lines.push(`Title: ${item.title}${yearRange ? ` (${yearRange})` : ''}`);

    // =========================================================================
    // TYPE LINE: Quick classification signals
    // =========================================================================
    const typeParts: string[] = ['TV Show'];
    if (item.status) typeParts.push(item.status);
    if (item.content_rating) typeParts.push(item.content_rating);
    if (item.runtime) typeParts.push(`${item.runtime}min avg`);
    lines.push(`Type: ${typeParts.join(' | ')}`);

    // =========================================================================
    // GENRES LINE
    // =========================================================================
    if (item.genres?.length) {
        lines.push(`Genres: ${item.genres.join(', ')}`);
    }

    // =========================================================================
    // KEYWORDS (TOPIC LOCK) - Critical first ~50 tokens
    // Combines sub_genres, format tags, and TMDB keywords for semantic anchoring
    // =========================================================================
    const keywordParts: string[] = [];
    if (item.tags?.sub_genres?.length) {
        keywordParts.push(...item.tags.sub_genres);
    }
    if (item.tags?.format?.length) {
        keywordParts.push(...item.tags.format);
    }
    if (item.keywords?.length) {
        // Add TMDB keywords, avoiding duplicates
        const existing = new Set(keywordParts.map(k => k.toLowerCase()));
        const tmdbKeywords = item.keywords
            .filter(k => !existing.has(k.toLowerCase()))
            .slice(0, 10);
        keywordParts.push(...tmdbKeywords);
    }
    if (keywordParts.length) {
        lines.push(`Keywords: ${keywordParts.join(', ')}`);
    }

    // =========================================================================
    // [THE HOOK] - Tagline and Premise
    // =========================================================================
    lines.push('');
    lines.push('[THE HOOK]');

    if (item.tagline) {
        lines.push(`Tagline: ${item.tagline}`);
    }
    if (item.description_parts?.premise) {
        lines.push(`Premise: ${item.description_parts.premise}`);
    }

    // =========================================================================
    // [ANALYSIS] - Vibe Match tags and thematic content
    // =========================================================================
    lines.push('');
    lines.push('[ANALYSIS]');

    // Tropes (narrative DNA - critical for similarity)
    if (item.tags?.tropes?.length) {
        lines.push(`Tropes: ${item.tags.tropes.join(', ')}`);
    }

    // Mood (emotional signature - critical for vibe matching)
    if (item.tags?.mood?.length) {
        lines.push(`Mood: ${item.tags.mood.join(', ')}`);
    }

    // AI-generated thematic analysis
    if (item.description_parts?.themes) {
        lines.push(`Themes: ${item.description_parts.themes}`);
    }
    if (item.description_parts?.tone) {
        lines.push(`Tone: ${item.description_parts.tone}`);
    }
    if (item.description_parts?.style) {
        lines.push(`Style: ${item.description_parts.style}`);
    }

    // =========================================================================
    // [FORMAT] - Stats and production context
    // =========================================================================
    lines.push('');
    lines.push('[FORMAT]');

    const statsParts: string[] = [];
    if (item.number_of_seasons) statsParts.push(`${item.number_of_seasons} Seasons`);
    if (item.number_of_episodes) statsParts.push(`${item.number_of_episodes} Episodes`);
    if (statsParts.length) {
        lines.push(`Stats: ${statsParts.join(', ')}`);
    }

    if (item.networks?.length) {
        lines.push(`Network: ${item.networks.join(', ')}`);
    }
    if (item.production_companies?.length) {
        lines.push(`Studio: ${item.production_companies.slice(0, 3).join(', ')}`);
    }

    // =========================================================================
    // [ACCLAIM] - Ratings and awards
    // =========================================================================
    const hasAcclaim = item.awards || item.imdb_rating || item.rt_score;
    if (hasAcclaim) {
        lines.push('');
        lines.push('[ACCLAIM]');

        if (item.awards) {
            lines.push(`Awards: ${item.awards}`);
        }

        const ratingParts: string[] = [];
        if (item.imdb_rating) {
            const votes = item.imdb_votes
                ? ` (${item.imdb_votes.toLocaleString()})`
                : '';
            ratingParts.push(`IMDb ${item.imdb_rating}${votes}`);
        }
        if (item.rt_score) {
            ratingParts.push(`RT ${item.rt_score}%`);
        }
        if (ratingParts.length) {
            lines.push(`Ratings: ${ratingParts.join(' | ')}`);
        }
    }

    // =========================================================================
    // [CREDITS] - Entity names for relationship clustering
    // =========================================================================
    const hasCredits = item.created_by?.length || item.cast_with_characters?.length;
    if (hasCredits) {
        lines.push('');
        lines.push('[CREDITS]');

        if (item.created_by?.length) {
            lines.push(`Created By: ${item.created_by.join(', ')}`);
        }

        if (item.cast_with_characters?.length) {
            const castStr = item.cast_with_characters
                .slice(0, 8)
                .map(c => c.character ? `${c.name} as ${c.character}` : c.name)
                .join(', ');
            lines.push(`Cast: ${castStr}`);
        }
    }

    // Filter empty lines at start/end and join
    return lines.filter((line, i) => {
        // Keep non-empty lines
        if (line.trim()) return true;
        // Keep empty lines only if they're between sections
        return i > 0 && i < lines.length - 1;
    }).join('\n');
}
