/**
 * Franchise Classification System - "Save the Cat" Methodology
 * 
 * This module classifies TV shows into one of 8 franchise types based on the
 * "Save the Cat! Writes for TV" methodology by Blake Snyder and Jamie Nash.
 * 
 * A show's "Franchise" is its repeatable story engine - the mechanism that
 * generates conflict and narrative across episodes. Understanding franchise
 * type enables semantic similarity matching beyond surface-level genres.
 * 
 * Example: Both "Breaking Bad" and "Squid Game" are "Dude with a Problem"
 * franchise types (ordinary person in extraordinary peril), making them
 * semantically similar despite different genres (crime drama vs. thriller).
 */

import { callLLM } from '@/lib/llm';
import type { LLMConfig } from '@/lib/harvesters/shared';

// ============================================================================
// FRANCHISE TYPE DEFINITIONS (Extensible - add new types here)
// ============================================================================

/**
 * The 8 Save the Cat Franchise Types
 * Each represents a distinct story engine that generates conflict
 */
export type FranchiseType =
    | 'MONSTER_IN_THE_HOUSE'    // Survival horror, containment
    | 'GOLDEN_FLEECE'           // Quest, journey, team adventure
    | 'OUT_OF_THE_BOTTLE'       // Magic/supernatural meets mundane
    | 'DUDE_WITH_A_PROBLEM'     // Ordinary person, extraordinary crisis
    | 'RITES_OF_PASSAGE'        // Coming of age, life transitions
    | 'BUDDY_LOVE'              // Two people who need each other
    | 'WHYDUNIT'                // Mystery focused on human nature
    | 'FOOL_TRIUMPHANT'         // Underdog challenges establishment
    | 'UNKNOWN';

/**
 * Franchise definition with detection keywords and examples
 * Extensible: Add new franchise types by adding to this array
 */
export const FRANCHISE_DEFINITIONS: readonly {
    id: FranchiseType;
    label: string;
    engine: string;
    examples: readonly string[];
    keywords: readonly string[];
}[] = [
    {
        id: 'MONSTER_IN_THE_HOUSE',
        label: 'Monster in the House',
        engine: 'A confined space, a sin committed, a monster pursuing. Survival and containment.',
        examples: ['Stranger Things', 'The Walking Dead', 'Alien', 'The Haunting of Hill House'],
        keywords: ['monster', 'survival', 'horror', 'creature', 'trapped', 'escape', 'supernatural threat',
            'demon', 'haunted', 'possession', 'isolation', 'terror', 'stalked', 'hunted']
    },
    {
        id: 'GOLDEN_FLEECE',
        label: 'Golden Fleece',
        engine: 'A team on a quest or journey. The road and its obstacles ARE the story.',
        examples: ['Star Trek', 'The Mandalorian', 'One Piece', 'The Lord of the Rings'],
        keywords: ['quest', 'journey', 'mission', 'artifact', 'team', 'road trip', 'adventure',
            'exploration', 'crew', 'voyage', 'treasure', 'destination', 'fellowship']
    },
    {
        id: 'OUT_OF_THE_BOTTLE',
        label: 'Out of the Bottle',
        engine: 'Magic or supernatural affects normal life. The clash between mundane and extraordinary.',
        examples: ['The Good Place', 'Severance', 'Bewitched', 'Loki', 'What We Do in the Shadows'],
        keywords: ['wish', 'magic', 'curse', 'supernatural', 'afterlife', 'powers', 'alternate reality',
            'time loop', 'body swap', 'transformation', 'fantasy world', 'parallel universe']
    },
    {
        id: 'DUDE_WITH_A_PROBLEM',
        label: 'Dude with a Problem',
        engine: 'An ordinary person faces extraordinary peril. Immediate survival and problem-solving.',
        examples: ['Breaking Bad', '24', 'Squid Game', 'Prison Break', 'You'],
        keywords: ['crisis', 'survival', 'everyman', 'ticking clock', 'desperate', 'trapped',
            'ordinary person', 'life or death', 'escape', 'countdown', 'hostage', 'pursuit']
    },
    {
        id: 'RITES_OF_PASSAGE',
        label: 'Rites of Passage',
        engine: 'Life transitions, growing pains, internal conflict. Universal human experiences of change.',
        examples: ['Euphoria', 'This Is Us', 'The Wonder Years', 'Friday Night Lights', 'Parenthood'],
        keywords: ['coming of age', 'growing up', 'family', 'adolescence', 'midlife', 'divorce',
            'grief', 'transition', 'identity', 'generational', 'memoir', 'slice of life']
    },
    {
        id: 'BUDDY_LOVE',
        label: 'Buddy Love',
        engine: 'Two characters who need each other. Romance or platonic chemistry drives the narrative.',
        examples: ['The X-Files', 'Bridgerton', 'Sherlock', 'White Collar', 'Castle'],
        keywords: ['partners', 'romance', 'duo', 'chemistry', 'will they won\'t they', 'opposites attract',
            'odd couple', 'love story', 'relationship', 'lovers', 'bickering', 'tension']
    },
    {
        id: 'WHYDUNIT',
        label: 'Whydunit',
        engine: 'Investigating the dark side of human nature. The mystery reveals WHY people do terrible things.',
        examples: ['True Detective', 'Mindhunter', 'Mare of Easttown', 'The Killing', 'Broadchurch'],
        keywords: ['detective', 'mystery', 'psychological', 'dark secret', 'investigation', 'motive',
            'serial killer', 'crime', 'noir', 'obsession', 'moral ambiguity', 'trauma']
    },
    {
        id: 'FOOL_TRIUMPHANT',
        label: 'Fool Triumphant',
        engine: 'An underdog challenges the establishment. The "fool" has unique wisdom the system lacks.',
        examples: ['Ted Lasso', 'Abbott Elementary', 'Schitt\'s Creek', 'The Good Place', 'Parks and Recreation'],
        keywords: ['underdog', 'optimism', 'fish out of water', 'outsider', 'misfit', 'unlikely hero',
            'establishment', 'rebel', 'naive', 'heart of gold', 'clash of cultures', 'wholesome']
    }
] as const;

// ============================================================================
// HEURISTIC DETECTION (Fast, no LLM cost)
// ============================================================================

/**
 * Keyword-based franchise detection fallback
 * Use when LLM is unavailable or for initial filtering
 * 
 * @param genres - Show genres
 * @param keywords - TMDB keywords
 * @param synopsis - Show overview
 * @returns Best-match franchise type or UNKNOWN
 */
export function detectFranchiseHeuristic(
    genres?: string[],
    keywords?: string[],
    synopsis?: string
): FranchiseType {
    const allText = [
        ...(genres || []),
        ...(keywords || []),
        synopsis || ''
    ].join(' ').toLowerCase();

    // Score each franchise type by keyword matches
    const scores: { type: FranchiseType; score: number }[] = FRANCHISE_DEFINITIONS.map(def => {
        const matchCount = def.keywords.filter(kw => allText.includes(kw.toLowerCase())).length;
        return { type: def.id, score: matchCount };
    });

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    // Require at least 2 keyword matches for confidence
    if (scores[0].score >= 2) {
        return scores[0].type;
    }

    return 'UNKNOWN';
}

// ============================================================================
// LLM-BASED CLASSIFICATION (High accuracy)
// ============================================================================

/**
 * Classify a TV show into one of 8 franchise types using LLM
 * 
 * Uses the "Save the Cat" methodology to identify the show's narrative engine.
 * The franchise type enables cross-genre similarity matching based on story structure.
 * 
 * @param config - LLM configuration
 * @param title - Show title
 * @param overview - Show synopsis/overview
 * @param pilotOverview - Optional pilot episode synopsis for better accuracy
 * @returns Promise<FranchiseType>
 */
export async function classifyFranchiseType(
    config: { apiKey: string; provider: string; model?: string; endpoint?: string },
    title: string,
    overview: string,
    pilotOverview?: string
): Promise<FranchiseType> {
    // Build franchise definitions for prompt
    const franchiseDescriptions = FRANCHISE_DEFINITIONS
        .map(def => `- **${def.id}** (${def.label}): ${def.engine}\n  Examples: ${def.examples.join(', ')}`)
        .join('\n\n');

    const systemPrompt = `You are a narrative analyst trained in the "Save the Cat! Writes for TV" methodology by Blake Snyder. Your task is to classify TV shows into exactly ONE of 8 franchise types.

A show's FRANCHISE TYPE defines its repeatable story ENGINE - the mechanism that generates conflict across episodes. This is NOT about genre (action, comedy) but about NARRATIVE STRUCTURE.

## The 8 Franchise Types:

${franchiseDescriptions}

## Classification Rules:
1. Choose the SINGLE best-fitting franchise type
2. Focus on the show's REPEATABLE ENGINE, not individual plot points
3. Base your analysis on the protagonist's journey and source of conflict
4. If multiple types seem to fit, choose the one that defines the MAJORITY of episodes

## Output Format:
Respond with ONLY a JSON object:
{
    "franchise_type": "FRANCHISE_TYPE_ID",
    "confidence": "high" | "medium" | "low",
    "justification": "1-2 sentence explanation citing specific story elements"
}`;

    const userPrompt = `Classify this TV show into ONE franchise type:

**Title:** ${title}

**Overview:** ${overview}
${pilotOverview ? `\n**Pilot Episode:** ${pilotOverview}` : ''}

Analyze the narrative engine and output JSON.`;

    try {
        const response = await callLLM({
            userPrompt,
            systemPrompt,
            apiKey: config.apiKey,
            provider: config.provider,
            model: config.model,
            endpoint: config.endpoint,
            maxTokens: 300
        });

        // Parse JSON response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.warn(`⚠️ Franchise classification returned non-JSON for "${title}"`);
            return detectFranchiseHeuristic(undefined, undefined, overview);
        }

        const parsed = JSON.parse(jsonMatch[0]);
        const franchiseType = parsed.franchise_type?.toUpperCase() as FranchiseType;

        // Validate franchise type
        if (!FRANCHISE_DEFINITIONS.some(def => def.id === franchiseType)) {
            console.warn(`⚠️ Unknown franchise type "${franchiseType}" for "${title}", falling back to heuristic`);
            return detectFranchiseHeuristic(undefined, undefined, overview);
        }

        // Log for debugging
        console.log(`🎬 Franchise: ${title} → ${franchiseType} (${parsed.confidence})`);
        if (parsed.justification) {
            console.log(`   └─ ${parsed.justification.slice(0, 100)}...`);
        }

        return franchiseType;

    } catch (error) {
        console.warn(`⚠️ Franchise classification failed for "${title}":`, error);
        return detectFranchiseHeuristic(undefined, undefined, overview);
    }
}

// ============================================================================
// PILOT BEAT SHEET EXTRACTION (For high-value shows)
// ============================================================================

/**
 * Pilot beat structure from Save the Cat methodology
 */
export interface PilotBeats {
    catalyst?: string;       // The moment life changes (Walter's diagnosis)
    breakIntoTwo?: string;   // Hero enters "new world" (first cook)
    midpoint?: string;       // Stakes raise (false victory/defeat)
    allIsLost?: string;      // Lowest point, everything lost
    finalImage?: string;     // Closing shot summarizing change
}

/**
 * Extract narrative beats from a pilot episode
 * Only use for high-value shows (top 10% popularity) due to LLM cost
 * 
 * @param config - LLM configuration
 * @param title - Show title
 * @param pilotSynopsis - Detailed pilot episode synopsis
 * @returns Promise<PilotBeats>
 */
export async function extractPilotBeats(
    config: { apiKey: string; provider: string; model?: string; endpoint?: string },
    title: string,
    pilotSynopsis: string
): Promise<PilotBeats> {
    const systemPrompt = `You are a story structure analyst trained in the "Save the Cat" beat sheet methodology. Extract the key narrative beats from a TV pilot episode.

## Beats to Extract:
1. **CATALYST**: The moment that changes the protagonist's life forever (inciting incident)
2. **BREAK INTO TWO**: When the hero decides to enter the "new world" or accept the call
3. **MIDPOINT**: The moment stakes raise - often a false victory or false defeat
4. **ALL IS LOST**: The lowest point where the hero seems to lose everything
5. **FINAL IMAGE**: The closing shot/moment that shows how the world has changed

## Output Format:
{
    "catalyst": "Brief description of the catalyst moment",
    "breakIntoTwo": "Brief description of the break into act two",
    "midpoint": "Brief description of the midpoint or null if not present",
    "allIsLost": "Brief description of all is lost moment or null",
    "finalImage": "Brief description of the final image"
}

If a beat is not clearly present in the synopsis, use null.`;

    const userPrompt = `Extract narrative beats from this TV pilot:

**Show:** ${title}
**Pilot Synopsis:** ${pilotSynopsis}`;

    try {
        const response = await callLLM({
            userPrompt,
            systemPrompt,
            apiKey: config.apiKey,
            provider: config.provider,
            model: config.model,
            endpoint: config.endpoint,
            maxTokens: 400
        });

        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.warn(`⚠️ Beat extraction returned non-JSON for "${title}"`);
            return {};
        }

        return JSON.parse(jsonMatch[0]) as PilotBeats;

    } catch (error) {
        console.warn(`⚠️ Beat extraction failed for "${title}":`, error);
        return {};
    }
}

// ============================================================================
// UTILITY: Get franchise label for display
// ============================================================================

/**
 * Get human-readable label for a franchise type
 */
export function getFranchiseLabel(franchiseType: FranchiseType): string {
    const def = FRANCHISE_DEFINITIONS.find(d => d.id === franchiseType);
    return def?.label || 'Unknown';
}

/**
 * Get franchise engine description
 */
export function getFranchiseEngine(franchiseType: FranchiseType): string {
    const def = FRANCHISE_DEFINITIONS.find(d => d.id === franchiseType);
    return def?.engine || '';
}
