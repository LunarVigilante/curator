/**
 * Input Sanitization & Validation Utilities
 * 
 * Centralized validation for all user input to prevent:
 * - SQL filter injection via Supabase .or()/.ilike()
 * - XSS attacks via user-generated content
 * - DoS via oversized payloads
 * - Type confusion attacks
 */

import { z } from 'zod'

// =============================================================================
// INPUT LENGTH LIMITS
// =============================================================================

/**
 * Standard maximum lengths for all input fields.
 * These should be enforced at both client and server.
 */
export const INPUT_LIMITS = {
    // Identity & Auth
    EMAIL: 255,
    USERNAME: 50,
    DISPLAY_NAME: 100,
    PASSWORD_MIN: 12,
    PASSWORD_MAX: 128,
    INVITE_CODE: 8,

    // Content
    TITLE: 500,
    DESCRIPTION: 10_000,
    COMMENT: 2_000,
    NOTE: 5_000,
    BIO: 500,

    // System
    SEARCH_QUERY: 200,
    TAG_NAME: 100,
    UUID: 36,
    CATEGORY_NAME: 100,

    // Files
    FILENAME: 255,
} as const

// =============================================================================
// VALIDATION RESULTS
// =============================================================================

export type ValidationResult<T> =
    | { success: true; data: T }
    | { success: false; error: string }

// =============================================================================
// SEARCH QUERY VALIDATION
// =============================================================================

/**
 * Characters that are NOT allowed in search queries.
 * These can be used to manipulate Supabase PostgREST filters.
 */
const DANGEROUS_SEARCH_CHARS = /[%_*.,()'"\\;]/g

/**
 * Validates and sanitizes a search query.
 * 
 * REJECTS queries containing special characters that could be used
 * to manipulate PostgREST filters (SQL filter injection).
 * 
 * @param query - The raw search query from user input
 * @returns Validation result with sanitized query or error message
 * 
 * @example
 * const result = validateSearchQuery("hello world")
 * if (!result.success) {
 *   toast.error(result.error) // Show user-friendly error
 *   return
 * }
 * // Use result.data safely
 */
export function validateSearchQuery(query: string): ValidationResult<string> {
    // Check length first
    if (query.length > INPUT_LIMITS.SEARCH_QUERY) {
        return {
            success: false,
            error: `Search query too long. Maximum ${INPUT_LIMITS.SEARCH_QUERY} characters allowed.`
        }
    }

    // Check for dangerous characters
    const dangerousMatch = query.match(DANGEROUS_SEARCH_CHARS)
    if (dangerousMatch) {
        const uniqueChars = [...new Set(dangerousMatch)].join(' ')
        return {
            success: false,
            error: `Search contains invalid characters: ${uniqueChars}. Please use only letters, numbers, and spaces.`
        }
    }

    // Trim whitespace
    const trimmed = query.trim()

    return { success: true, data: trimmed }
}

/**
 * Quick check if a search query is valid (for inline validation).
 */
export function isValidSearchQuery(query: string): boolean {
    return validateSearchQuery(query).success
}

// =============================================================================
// UUID VALIDATION
// =============================================================================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Validates that a string is a valid UUID v4 format.
 */
export function validateUUID(id: string, fieldName = 'ID'): ValidationResult<string> {
    if (!id || typeof id !== 'string') {
        return {
            success: false,
            error: `${fieldName} is required`
        }
    }

    if (id.length !== 36) {
        return {
            success: false,
            error: `Invalid ${fieldName} format`
        }
    }

    if (!UUID_REGEX.test(id)) {
        return {
            success: false,
            error: `Invalid ${fieldName} format`
        }
    }

    return { success: true, data: id.toLowerCase() }
}

/**
 * Quick check if a string is a valid UUID.
 */
export function isValidUUID(id: string): boolean {
    return validateUUID(id).success
}

// =============================================================================
// TEXT CONTENT VALIDATION
// =============================================================================

/**
 * Validates text content (comments, notes, descriptions) for length and basic sanitization.
 */
export function validateTextContent(
    content: string,
    fieldName: string,
    maxLength: number,
    minLength: number = 0
): ValidationResult<string> {
    if (typeof content !== 'string') {
        return {
            success: false,
            error: `${fieldName} must be text`
        }
    }

    const trimmed = content.trim()

    if (trimmed.length < minLength) {
        return {
            success: false,
            error: `${fieldName} must be at least ${minLength} characters`
        }
    }

    if (trimmed.length > maxLength) {
        return {
            success: false,
            error: `${fieldName} too long. Maximum ${maxLength} characters allowed.`
        }
    }

    return { success: true, data: trimmed }
}

// =============================================================================
// EMAIL VALIDATION
// =============================================================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateEmail(email: string): ValidationResult<string> {
    if (!email || typeof email !== 'string') {
        return { success: false, error: 'Email is required' }
    }

    const trimmed = email.trim().toLowerCase()

    if (trimmed.length > INPUT_LIMITS.EMAIL) {
        return {
            success: false,
            error: `Email too long. Maximum ${INPUT_LIMITS.EMAIL} characters.`
        }
    }

    if (!EMAIL_REGEX.test(trimmed)) {
        return { success: false, error: 'Invalid email format' }
    }

    return { success: true, data: trimmed }
}

// =============================================================================
// ZOD SCHEMA HELPERS
// =============================================================================

/**
 * Zod schema for UUID strings
 */
export const zodUUID = z.string().uuid()

/**
 * Zod schema for safe search queries (rejects special characters)
 */
export const zodSearchQuery = z.string()
    .max(INPUT_LIMITS.SEARCH_QUERY)
    .refine(
        (val) => !DANGEROUS_SEARCH_CHARS.test(val),
        { message: 'Search contains invalid characters. Use only letters, numbers, and spaces.' }
    )

/**
 * Zod schema for email
 */
export const zodEmail = z.string()
    .email()
    .max(INPUT_LIMITS.EMAIL)
    .transform(val => val.trim().toLowerCase())

/**
 * Zod schema for username
 */
export const zodUsername = z.string()
    .min(2, 'Username must be at least 2 characters')
    .max(INPUT_LIMITS.USERNAME)
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens')

/**
 * Zod schema for password
 */
export const zodPassword = z.string()
    .min(INPUT_LIMITS.PASSWORD_MIN, `Password must be at least ${INPUT_LIMITS.PASSWORD_MIN} characters`)
    .max(INPUT_LIMITS.PASSWORD_MAX)

/**
 * Zod schema for comment content
 */
export const zodComment = z.string()
    .min(1, 'Comment cannot be empty')
    .max(INPUT_LIMITS.COMMENT)

/**
 * Zod schema for title fields
 */
export const zodTitle = z.string()
    .min(1, 'Title is required')
    .max(INPUT_LIMITS.TITLE)

/**
 * Zod schema for description fields
 */
export const zodDescription = z.string()
    .max(INPUT_LIMITS.DESCRIPTION)
    .optional()
    .default('')
