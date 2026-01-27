/**
 * Standardized API Error Responses
 * 
 * Provides consistent error formatting for all API endpoints.
 * Client receives user-safe messages, detailed errors are logged server-side only.
 */

import { NextResponse } from 'next/server'
import { log } from 'next-axiom'

// Standard API error codes
export const API_ERROR_CODES = {
    BAD_REQUEST: 'BAD_REQUEST',
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    NOT_FOUND: 'NOT_FOUND',
    RATE_LIMITED: 'RATE_LIMITED',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const

export type ApiErrorCode = keyof typeof API_ERROR_CODES

interface ApiErrorResponse {
    error: string
    code: ApiErrorCode
    requestId?: string
}

/**
 * Create a standardized API error response.
 * Logs detailed error server-side, returns generic message to client.
 */
export function apiError(
    status: number,
    userMessage: string,
    code: ApiErrorCode = 'INTERNAL_ERROR',
    internalError?: unknown,
    requestId?: string
): NextResponse<ApiErrorResponse> {
    // Log detailed error server-side only
    if (internalError) {
        const errorDetails = internalError instanceof Error
            ? { message: internalError.message, stack: internalError.stack }
            : { raw: String(internalError) }

        log.error('API Error', {
            status,
            code,
            userMessage,
            requestId,
            ...errorDetails,
        })
    }

    const body: ApiErrorResponse = {
        error: userMessage,
        code,
    }

    if (requestId) {
        body.requestId = requestId
    }

    return NextResponse.json(body, { status })
}

// Convenience methods for common errors

export function badRequest(message = 'Invalid request', error?: unknown): NextResponse {
    return apiError(400, message, 'BAD_REQUEST', error)
}

export function unauthorized(message = 'Authentication required'): NextResponse {
    return apiError(401, message, 'UNAUTHORIZED')
}

export function forbidden(message = 'Access denied'): NextResponse {
    return apiError(403, message, 'FORBIDDEN')
}

export function notFound(message = 'Resource not found'): NextResponse {
    return apiError(404, message, 'NOT_FOUND')
}

export function validationError(message: string): NextResponse {
    return apiError(400, message, 'VALIDATION_ERROR')
}

export function internalError(message = 'An unexpected error occurred', error?: unknown): NextResponse {
    return apiError(500, message, 'INTERNAL_ERROR', error)
}

/**
 * Generate a unique request ID for tracing
 */
export function generateRequestId(): string {
    return `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`
}
