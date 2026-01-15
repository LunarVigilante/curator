/**
 * Agent Types and Zod Schemas
 * 
 * Structured output schemas for multi-agent communication.
 * Uses Zod for runtime validation of LLM responses.
 */

import { z } from 'zod';

// ============================================================================
// Analyst Agent Schemas
// ============================================================================

export const AnalysisResultSchema = z.object({
    summary: z.string().describe('2-3 sentence summary of the item'),
    themes: z.array(z.string()).describe('Key themes/tags identified'),
    sentiment: z.enum(['POSITIVE', 'NEUTRAL', 'NEGATIVE']),
    rating_prediction: z.number().min(0).max(100).optional().describe('Predicted rating 0-100')
});

export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

// ============================================================================
// Enrichment Agent Schemas
// ============================================================================

export const EnrichmentResultSchema = z.object({
    description: z.string().describe('Rich UI description (4 paragraphs)'),
    tags: z.array(z.string()).describe('Extracted/generated tags'),
    embedding_text: z.string().describe('Dense text optimized for vector embedding')
});

export type EnrichmentResult = z.infer<typeof EnrichmentResultSchema>;

// ============================================================================
// Mathematician Agent Schemas
// ============================================================================

export const RankingDecisionSchema = z.object({
    recommended_tier: z.enum(['S', 'A', 'B', 'C', 'D', 'E', 'F']),
    confidence: z.number().min(0).max(1).describe('Confidence in recommendation'),
    borda_influence: z.number().min(0).max(1).describe('How much Borda affected decision'),
    topsis_influence: z.number().min(0).max(1).describe('How much TOPSIS affected decision'),
    reasoning: z.string().describe('Brief explanation of ranking logic')
});

export type RankingDecision = z.infer<typeof RankingDecisionSchema>;

export const ConflictResolutionSchema = z.object({
    has_conflict: z.boolean(),
    borda_tier: z.string().nullable(),
    topsis_tier: z.string().nullable(),
    resolved_tier: z.string(),
    resolution_method: z.enum(['BORDA_DOMINANT', 'TOPSIS_DOMINANT', 'WEIGHTED_MERGE', 'REVIEWER_OVERRIDE']),
    explanation: z.string()
});

export type ConflictResolution = z.infer<typeof ConflictResolutionSchema>;

// ============================================================================
// Reviewer Agent Schemas
// ============================================================================

export const ReviewResultSchema = z.object({
    approved: z.boolean(),
    issues: z.array(z.object({
        severity: z.enum(['WARNING', 'ERROR']),
        field: z.string(),
        message: z.string()
    })),
    suggestions: z.array(z.string()).optional(),
    should_rerun: z.boolean().describe('True if agent should retry with corrections')
});

export type ReviewResult = z.infer<typeof ReviewResultSchema>;

// ============================================================================
// Shared Types
// ============================================================================

export interface AgentContext {
    itemId: string;
    itemName: string;
    categoryType: string;
    existingData?: Record<string, unknown>;
    similarItems?: Array<{ id: string; title: string; similarity: number }>;
}

export interface AgentResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    retryable?: boolean;
}

// ============================================================================
// Utility: Safe JSON Parse with Zod
// ============================================================================

export function parseAgentResponse<T>(
    schema: z.ZodSchema<T>,
    rawResponse: string
): AgentResponse<T> {
    try {
        // Clean common LLM response artifacts
        let cleaned = rawResponse
            .replace(/```json\s*/gi, '')
            .replace(/```\s*/gi, '')
            .trim();

        // Handle potential leading/trailing text
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            cleaned = jsonMatch[0];
        }

        const parsed = JSON.parse(cleaned);
        const validated = schema.parse(parsed);

        return { success: true, data: validated };
    } catch (e) {
        const error = e instanceof Error ? e.message : 'Unknown parsing error';
        return { success: false, error, retryable: true };
    }
}
