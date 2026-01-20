/**
 * Centralized Error Handling Utilities
 * 
 * This module provides:
 * - `AppError`: Custom error class with code and status
 * - `handleSupabaseError`: Converts Supabase errors to AppError
 * - `safeAction`: Wrapper for server actions that catches errors and returns safe responses
 * - `ActionResult<T>`: Type-safe result type for server actions
 */

// =============================================================================
// TYPES
// =============================================================================

/**
 * Standard result type for server actions.
 * Use this instead of throwing errors to prevent information leakage.
 */
export type ActionResult<T = void> =
    | { success: true; data: T }
    | { success: false; error: string }

/**
 * Helper to create success result
 */
export function success<T>(data: T): ActionResult<T> {
    return { success: true, data }
}

/**
 * Helper to create failure result
 */
export function failure(error: string): ActionResult<never> {
    return { success: false, error }
}

// =============================================================================
// ERROR CLASSES
// =============================================================================

/**
 * Application-level error with code and status.
 * Use for errors that should be communicated to users.
 */
export class AppError extends Error {
    constructor(
        public code: string,
        message: string,
        public statusCode: number = 500
    ) {
        super(message)
        this.name = 'AppError'
    }
}

// =============================================================================
// ERROR MAPPINGS
// =============================================================================

/**
 * Supabase/PostgreSQL error code mappings to user-friendly messages
 */
const SUPABASE_ERROR_MAP: Record<string, { message: string; status: number }> = {
    // PostgreSQL errors
    'PGRST116': { message: 'Resource not found', status: 404 },
    '23505': { message: 'Resource already exists', status: 409 },
    '23503': { message: 'Related resource not found', status: 400 },
    '42501': { message: 'Permission denied', status: 403 },
    '22P02': { message: 'Invalid input format', status: 400 },

    // Auth errors
    'invalid_credentials': { message: 'Invalid email or password', status: 401 },
    'email_not_confirmed': { message: 'Please verify your email', status: 401 },
    'user_not_found': { message: 'User not found', status: 404 },
}

// =============================================================================
// ERROR HANDLERS
// =============================================================================

/**
 * Convert Supabase error to AppError with user-friendly message.
 * Logs the full error server-side before sanitizing.
 * @throws AppError always
 */
export function handleSupabaseError(error: unknown, context: string): never {
    // Log full error server-side for debugging
    console.error(`[${context}] Supabase error:`, error)

    if (error && typeof error === 'object' && 'code' in error) {
        const code = (error as { code: string }).code
        const mapping = SUPABASE_ERROR_MAP[code]
        if (mapping) {
            throw new AppError(code, mapping.message, mapping.status)
        }
    }

    throw new AppError('INTERNAL', 'An unexpected error occurred', 500)
}

/**
 * Wrap a server action function to catch errors and return safe ActionResult.
 * 
 * Features:
 * - Catches all errors and logs them server-side
 * - Returns generic error message to client (prevents information leakage)
 * - Preserves AppError messages (these are safe to show)
 * 
 * @example
 * export const createItem = safeAction('createItem', async (input: ItemInput) => {
 *     const data = await db.insert(input)
 *     return data
 * })
 */
export function safeAction<TArgs extends unknown[], TResult>(
    name: string,
    fn: (...args: TArgs) => Promise<TResult>
): (...args: TArgs) => Promise<ActionResult<TResult>> {
    return async (...args: TArgs): Promise<ActionResult<TResult>> => {
        try {
            const result = await fn(...args)
            return { success: true, data: result }
        } catch (error) {
            // Log full error server-side
            console.error(`[${name}] Action error:`, error)

            // If it's an AppError, the message is safe to return
            if (error instanceof AppError) {
                return { success: false, error: error.message }
            }

            // For all other errors, return generic message
            return { success: false, error: 'An unexpected error occurred' }
        }
    }
}

/**
 * Simple wrapper to handle a Supabase query result.
 * Use when you just need to check if there was an error.
 * 
 * @example
 * const { data, error } = await supabase.from('items').select()
 * if (error) throwIfError(error, 'getItems')
 */
export function throwIfError(error: unknown, context: string): void {
    if (error) {
        handleSupabaseError(error, context)
    }
}
