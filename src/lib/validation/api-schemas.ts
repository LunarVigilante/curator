/**
 * API Route Validation Schemas
 * 
 * Zod schemas for all API route request bodies.
 * These ensure type-safe validation at the API boundary.
 */

import { z } from 'zod'
import { INPUT_LIMITS, zodUUID, zodTitle, zodDescription } from '@/lib/utils/input-sanitization'

// =============================================================================
// AI ENDPOINTS
// =============================================================================

/**
 * POST /api/ai/regenerate-description
 */
export const regenerateDescriptionSchema = z.object({
    itemId: zodUUID,
    title: zodTitle,
    type: z.string().min(1).max(50),
    includeTags: z.boolean().optional().default(true),
})

export type RegenerateDescriptionInput = z.infer<typeof regenerateDescriptionSchema>

/**
 * POST /api/ai/generate-tags
 */
export const generateTagsSchema = z.object({
    itemId: zodUUID.optional(),
    title: zodTitle,
    description: zodDescription,
    type: z.string().min(1).max(50),
    genres: z.array(z.string().max(100)).optional(),
})

export type GenerateTagsInput = z.infer<typeof generateTagsSchema>

/**
 * POST /api/ai/generate-description
 */
export const generateDescriptionSchema = z.object({
    title: zodTitle,
    type: z.string().min(1).max(50),
    context: z.string().max(INPUT_LIMITS.DESCRIPTION).optional(),
})

export type GenerateDescriptionInput = z.infer<typeof generateDescriptionSchema>

/**
 * POST /api/ai/generate-details
 */
export const generateDetailsSchema = z.object({
    title: zodTitle,
    type: z.string().min(1).max(50),
    context: z.string().max(INPUT_LIMITS.DESCRIPTION).optional(),
})

export type GenerateDetailsInput = z.infer<typeof generateDetailsSchema>

/**
 * POST /api/ai/enrich-metadata
 */
export const enrichMetadataSchema = z.object({
    itemId: zodUUID,
    title: zodTitle,
    _type: z.string().max(50).optional(),
    force: z.boolean().optional().default(false),
})

export type EnrichMetadataInput = z.infer<typeof enrichMetadataSchema>

/**
 * POST /api/ai/cluster
 */
export const clusterSchema = z.object({
    categoryId: zodUUID,
    itemIds: z.array(zodUUID).min(1).max(500),
    numClusters: z.number().int().min(2).max(20).optional().default(5),
})

export type ClusterInput = z.infer<typeof clusterSchema>

// =============================================================================
// ADMIN ENDPOINTS
// =============================================================================

/**
 * POST /api/admin/invites
 */
export const createInviteSchema = z.object({
    maxUses: z.number().int().min(1).max(100).optional().default(1),
})

export type CreateInviteInput = z.infer<typeof createInviteSchema>

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Safely parse and validate API request body.
 * Returns a standardized error response if validation fails.
 * 
 * @example
 * const result = await parseRequestBody(request, regenerateDescriptionSchema)
 * if (!result.success) {
 *     return NextResponse.json({ error: result.error }, { status: 400 })
 * }
 * const { itemId, title, type } = result.data
 */
export async function parseRequestBody<T extends z.ZodType>(
    request: Request,
    schema: T
): Promise<{ success: true; data: z.infer<T> } | { success: false; error: string }> {
    try {
        const body = await request.json()
        const result = schema.safeParse(body)

        if (!result.success) {
            // Get first error message for user-friendly response
            const firstError = result.error.issues[0]
            const field = firstError.path.join('.')
            const message = firstError.message
            return {
                success: false,
                error: field ? `${field}: ${message}` : message
            }
        }

        return { success: true, data: result.data }
    } catch (error) {
        return { success: false, error: 'Invalid JSON body' }
    }
}

/**
 * Validate URL search params against a schema.
 */
export function parseSearchParams<T extends z.ZodType>(
    searchParams: URLSearchParams,
    schema: T
): { success: true; data: z.infer<T> } | { success: false; error: string } {
    const params: Record<string, string> = {}
    searchParams.forEach((value, key) => {
        params[key] = value
    })

    const result = schema.safeParse(params)

    if (!result.success) {
        const firstError = result.error.issues[0]
        const field = firstError.path.join('.')
        const message = firstError.message
        return {
            success: false,
            error: field ? `${field}: ${message}` : message
        }
    }

    return { success: true, data: result.data }
}
