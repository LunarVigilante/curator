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
        releaseYear: z.string(),
        medium: z.string(),
        warning: z.string(),
        matchScore: z.number()
    })),
    suggested_metadata_updates: z.array(z.object({
        item_id: z.string(),
        item_name: z.string(),
        suggested_tags: z.array(z.string()),
        suggested_description: z.string()
    }))
})

export type TasteAnalysis = z.infer<typeof TasteAnalysisSchema>

export class AnalysisFailedError extends Error {
    constructor(public rawResponse: string, message: string = "Failed to parse analysis results") {
        super(message)
        this.name = 'AnalysisFailedError'
    }
}
