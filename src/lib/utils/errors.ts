/**
 * Centralized error handling utilities for server actions.
 * Provides consistent error messages and prevents exposing internal details.
 */

/**
 * Application error codes for structured error handling
 */
export const ErrorCode = {
    // Authentication errors
    UNAUTHORIZED: 'UNAUTHORIZED',
    NOT_AUTHENTICATED: 'NOT_AUTHENTICATED',

    // Authorization errors  
    FORBIDDEN: 'FORBIDDEN',
    NOT_OWNER: 'NOT_OWNER',

    // Resource errors
    NOT_FOUND: 'NOT_FOUND',
    ALREADY_EXISTS: 'ALREADY_EXISTS',

    // Validation errors
    INVALID_INPUT: 'INVALID_INPUT',

    // Server errors
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    DATABASE_ERROR: 'DATABASE_ERROR',
} as const

export type ErrorCode = typeof ErrorCode[keyof typeof ErrorCode]

/**
 * Application error with code and user-friendly message
 */
export class AppError extends Error {
    code: ErrorCode

    constructor(code: ErrorCode, message: string) {
        super(message)
        this.name = 'AppError'
        this.code = code
    }
}

/**
 * Create an AppError with a standard message pattern
 */
export function createError(code: ErrorCode, message?: string): AppError {
    const defaultMessages: Record<ErrorCode, string> = {
        UNAUTHORIZED: 'You are not authorized to perform this action',
        NOT_AUTHENTICATED: 'Please sign in to continue',
        FORBIDDEN: 'Access denied',
        NOT_OWNER: 'You do not own this resource',
        NOT_FOUND: 'Resource not found',
        ALREADY_EXISTS: 'Resource already exists',
        INVALID_INPUT: 'Invalid input provided',
        INTERNAL_ERROR: 'An unexpected error occurred',
        DATABASE_ERROR: 'Database operation failed',
    }

    return new AppError(code, message || defaultMessages[code])
}

/**
 * Wrap a database error with a user-friendly message
 */
export function handleDatabaseError(error: unknown, context?: string): never {
    console.error(`[Database Error${context ? ` in ${context}` : ''}]:`, error)

    // Check for specific PostgreSQL error codes
    if (error && typeof error === 'object' && 'code' in error) {
        const pgError = error as { code: string; message?: string }

        // Unique violation
        if (pgError.code === '23505') {
            throw createError('ALREADY_EXISTS', 'This item already exists')
        }

        // Foreign key violation
        if (pgError.code === '23503') {
            throw createError('INVALID_INPUT', 'Related resource not found')
        }

        // PGRST116 = row not found (Supabase PostgREST)
        if (pgError.code === 'PGRST116') {
            throw createError('NOT_FOUND', 'Resource not found')
        }
    }

    throw createError('DATABASE_ERROR', 'An error occurred while processing your request')
}

/**
 * Assert that a user is authenticated, throws if not
 */
export function requireAuth(userId: string | null | undefined): asserts userId is string {
    if (!userId) {
        throw createError('NOT_AUTHENTICATED')
    }
}

/**
 * Assert that a user owns a resource, throws if not
 */
export function requireOwnership(resourceOwnerId: string, currentUserId: string): void {
    if (resourceOwnerId !== currentUserId) {
        throw createError('NOT_OWNER', 'You do not own this item')
    }
}

/**
 * Assert that a resource exists, throws if not
 */
export function requireResource<T>(resource: T | null | undefined, name = 'Resource'): asserts resource is T {
    if (resource === null || resource === undefined) {
        throw createError('NOT_FOUND', `${name} not found`)
    }
}
