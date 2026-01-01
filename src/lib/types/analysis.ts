import { z } from 'zod'

// Define the schema using Zod
export const TasteAnalysisSchema = z.object({
    profile: z.object({
        summary: z.string(),
        top_genres: z.array(z.string()),
        visual_style: z.string(),
        narrative_preference: z.string()
    }),
    analysis: z.object({
        high_rated_patterns: z.string(),
        low_rated_patterns: z.string().optional(),
        unexplored_themes: z.string().optional(),
        outliers: z.string()
    }),
    recommendations: z.array(z.object({
        name: z.string(),
        releaseYear: z.string(),
        medium: z.string(),
        reason: z.string(),
        matchScore: z.number()
    })),
    anti_recommendations: z.array(z.object({
        name: z.string(),
        releaseYear: z.string().optional().default(''),
        medium: z.string().optional().default(''),
        warning: z.string().optional().default('May not match your preferences'),
        reason: z.string().optional(), // Some LLMs use 'reason' instead of 'warning'
        matchScore: z.number().optional().default(50)
    })).optional().default([]),
    suggested_metadata_updates: z.array(z.object({
        item_id: z.string(),
        item_name: z.string(),
        suggested_tags: z.array(z.string()),
        suggested_description: z.string()
    })).optional().default([])
})

export type TasteAnalysis = z.infer<typeof TasteAnalysisSchema>

export class AnalysisFailedError extends Error {
    constructor(public rawResponse: string, message: string = "Failed to parse analysis results") {
        super(message)
        this.name = 'AnalysisFailedError'
    }
}
