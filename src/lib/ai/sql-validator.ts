/**
 * SQL Query Validator for AI-Generated Queries
 *
 * Prevents SQL injection and ensures AI queries only access allowed tables/columns.
 * Blocks dangerous operations like DELETE, DROP, UPDATE.
 */

// Allowed tables for AI queries (read-only access)
// Note: profiles table access is controlled via BLOCKED_COLUMNS which excludes
// sensitive fields (email, api_key, etc). All non-blocked columns are considered public.
const ALLOWED_TABLES = new Set([
    'global_items',
    'categories',
    'tags',
    'item_tags',
    'profiles',
])

// Blocked columns (sensitive data)
const BLOCKED_COLUMNS = new Set([
    'password',
    'email',
    'api_key',
    'secret',
    'token',
    'encryption_key',
])

// Dangerous SQL keywords (completely blocked)
const DANGEROUS_KEYWORDS = [
    /\bDELETE\b/i,
    /\bDROP\b/i,
    /\bTRUNCATE\b/i,
    /\bALTER\b/i,
    /\bCREATE\b/i,
    /\bINSERT\b/i,
    /\bUPDATE\b/i,
    /\bGRANT\b/i,
    /\bREVOKE\b/i,
    /\bEXEC\b/i,
    /\bEXECUTE\b/i,
    /\bCALL\b/i,
    /--/,          // SQL comments (potential injection)
    /\/\*/,        // Block comments
    /;\s*\w/,      // Multiple statements
]

export interface ValidationResult {
    valid: boolean
    errors: string[]
    sanitizedQuery?: string
}

/**
 * Validate an AI-generated SQL query
 * @param query - The SQL query to validate
 * @returns Validation result with errors if invalid
 */
export function validateAIQuery(query: string): ValidationResult {
    const errors: string[] = []
    const trimmedQuery = query.trim()

    // 1. Check for dangerous keywords
    for (const pattern of DANGEROUS_KEYWORDS) {
        if (pattern.test(trimmedQuery)) {
            errors.push(`Dangerous operation detected: ${pattern.toString()}`)
        }
    }

    // 2. Ensure query is SELECT only
    if (!trimmedQuery.toUpperCase().startsWith('SELECT')) {
        errors.push('Only SELECT queries are allowed')
    }

    // 3. Extract table names and validate
    const tableMatches = trimmedQuery.match(/\bFROM\s+(\w+)/gi) || []
    const joinMatches = trimmedQuery.match(/\bJOIN\s+(\w+)/gi) || []

    const allTables = [...tableMatches, ...joinMatches]
        .map(match => match.split(/\s+/).pop()?.toLowerCase())
        .filter(Boolean) as string[]

    for (const table of allTables) {
        if (!ALLOWED_TABLES.has(table)) {
            errors.push(`Access to table '${table}' is not allowed`)
        }
    }

    // 4. Check for blocked columns
    for (const column of BLOCKED_COLUMNS) {
        const columnPattern = new RegExp(`\\b${column}\\b`, 'i')
        if (columnPattern.test(trimmedQuery)) {
            errors.push(`Access to column '${column}' is blocked`)
        }
    }

    // 5. Check for subqueries (potential bypass)
    const subqueryCount = (trimmedQuery.match(/\bSELECT\b/gi) || []).length
    if (subqueryCount > 2) {
        errors.push('Nested subqueries are limited to 2 levels')
    }

    // 6. Limit query length
    if (trimmedQuery.length > 2000) {
        errors.push('Query exceeds maximum length of 2000 characters')
    }

    return {
        valid: errors.length === 0,
        errors,
        sanitizedQuery: errors.length === 0 ? trimmedQuery : undefined
    }
}

/**
 * Create a read-only wrapper for executing validated queries
 * This ensures the database connection uses read-only mode
 */
export function createReadOnlyQueryOptions() {
    return {
        // Supabase-specific: use the anon key (RLS enforced)
        // Never use service role for AI-generated queries
        useServiceRole: false,

        // Set statement timeout to prevent DoS
        statementTimeout: 5000, // 5 seconds

        // Limit result size
        maxRows: 100,
    }
}

/**
 * Sanitize user input before including in prompts
 * Prevents prompt injection via user-controlled content
 */
export function sanitizeForPrompt(input: string): string {
    return input
        // Remove potential prompt injection patterns
        .replace(/\[\/INST\]/gi, '')
        .replace(/\[INST\]/gi, '')
        .replace(/<\|.*?\|>/g, '')
        .replace(/system:/gi, '')
        .replace(/assistant:/gi, '')
        .replace(/user:/gi, '')
        // Limit length
        .slice(0, 5000)
        // Escape special characters
        .replace(/[<>]/g, '')
}
