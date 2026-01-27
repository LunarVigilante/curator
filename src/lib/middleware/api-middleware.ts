/**
 * API Middleware Wrapper
 * 
 * Composable middleware for API routes that handles:
 * - Authentication
 * - Rate limiting
 * - Request logging
 * - Error handling
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession, requireAuth, requireAdmin } from '@/lib/auth'
import { checkRateLimit, getClientIdentifier, rateLimitResponse, RateLimitType } from './rate-limiter'
import { logRequest, startRequestTimer } from './request-logger'
import { internalError, unauthorized, forbidden } from './api-errors'

export interface ApiMiddlewareOptions {
    /** Require authentication (default: true) */
    requireAuth?: boolean
    /** Require admin role (default: false) */
    requireAdmin?: boolean
    /** Rate limit type (default: 'authenticated') */
    rateLimit?: RateLimitType | false
}

export interface ApiContext {
    userId: string | null
    isAdmin: boolean
    startTime: number
}

type ApiHandler<T = unknown> = (
    request: NextRequest,
    context: ApiContext
) => Promise<NextResponse<T>>

/**
 * Wrap an API route handler with security middleware.
 * 
 * @example
 * // Authenticated route with default rate limiting
 * export const POST = withApiMiddleware(async (request, { userId }) => {
 *   // userId is guaranteed to be set
 *   return NextResponse.json({ success: true })
 * })
 * 
 * @example
 * // Admin-only route with AI rate limiting
 * export const POST = withApiMiddleware(async (request, { userId }) => {
 *   return NextResponse.json({ success: true })
 * }, { requireAdmin: true, rateLimit: 'ai' })
 * 
 * @example
 * // Public route (no auth, anonymous rate limit)
 * export const GET = withApiMiddleware(async (request) => {
 *   return NextResponse.json({ data: 'public' })
 * }, { requireAuth: false, rateLimit: 'anonymous' })
 */
export function withApiMiddleware<T = unknown>(
    handler: ApiHandler<T>,
    options: ApiMiddlewareOptions = {}
): (request: NextRequest) => Promise<NextResponse> {
    const {
        requireAuth: needsAuth = true,
        requireAdmin: needsAdmin = false,
        rateLimit = 'authenticated',
    } = options

    return async (request: NextRequest): Promise<NextResponse> => {
        const startTime = startRequestTimer()
        let userId: string | null = null
        let isAdmin = false

        try {
            // 1. Authentication check
            if (needsAuth || needsAdmin) {
                try {
                    if (needsAdmin) {
                        const session = await requireAdmin()
                        userId = session.user.id
                        isAdmin = true
                    } else {
                        const session = await requireAuth()
                        userId = session.user.id
                        isAdmin = session.profile?.role === 'ADMIN'
                    }
                } catch {
                    logRequest(request, 401, startTime, null)
                    return needsAdmin ? forbidden('Admin access required') : unauthorized()
                }
            } else {
                // Optional auth - get user if available
                const session = await getSession()
                if (session) {
                    userId = session.user.id
                    isAdmin = session.profile?.role === 'ADMIN'
                }
            }

            // 2. Rate limiting
            if (rateLimit !== false) {
                const identifier = getClientIdentifier(request, userId)
                const result = await checkRateLimit(identifier, rateLimit)

                if (!result.success) {
                    logRequest(request, 429, startTime, userId)
                    return rateLimitResponse(result)
                }
            }

            // 3. Execute handler
            const context: ApiContext = { userId, isAdmin, startTime }
            const response = await handler(request, context)

            // 4. Log successful request
            const status = response.status || 200
            logRequest(request, status, startTime, userId)

            return response

        } catch (error) {
            // 5. Handle unexpected errors
            logRequest(request, 500, startTime, userId)
            return internalError('An unexpected error occurred', error)
        }
    }
}

/**
 * Shorthand for public routes (no auth, anonymous rate limit)
 */
export function withPublicApi<T = unknown>(handler: ApiHandler<T>) {
    return withApiMiddleware(handler, {
        requireAuth: false,
        rateLimit: 'anonymous',
    })
}

/**
 * Shorthand for admin routes (admin required, authenticated rate limit)
 */
export function withAdminApi<T = unknown>(handler: ApiHandler<T>) {
    return withApiMiddleware(handler, {
        requireAdmin: true,
        rateLimit: 'authenticated',
    })
}

/**
 * Shorthand for AI routes (auth required, AI rate limit)
 */
export function withAiApi<T = unknown>(handler: ApiHandler<T>) {
    return withApiMiddleware(handler, {
        requireAuth: true,
        rateLimit: 'ai',
    })
}
