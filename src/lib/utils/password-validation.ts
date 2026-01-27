/**
 * Password Validation Utility
 * 
 * Client-side password validation that matches Supabase Auth requirements.
 * These rules should mirror the dashboard configuration for consistent UX.
 */

export interface PasswordValidationResult {
    isValid: boolean
    errors: string[]
    strength: 'weak' | 'fair' | 'strong' | 'very-strong'
}

export interface PasswordRequirements {
    minLength: number
    requireLowercase: boolean
    requireUppercase: boolean
    requireDigits: boolean
    requireSymbols: boolean
}

// Default requirements matching Supabase dashboard settings
export const DEFAULT_PASSWORD_REQUIREMENTS: PasswordRequirements = {
    minLength: 12,
    requireLowercase: true,
    requireUppercase: true,
    requireDigits: true,
    requireSymbols: true,
}

/**
 * Validates a password against the specified requirements
 */
export function validatePassword(
    password: string,
    requirements: PasswordRequirements = DEFAULT_PASSWORD_REQUIREMENTS
): PasswordValidationResult {
    const errors: string[] = []

    // Length check
    if (password.length < requirements.minLength) {
        errors.push(`Password must be at least ${requirements.minLength} characters long`)
    }

    // Lowercase check
    if (requirements.requireLowercase && !/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter')
    }

    // Uppercase check
    if (requirements.requireUppercase && !/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter')
    }

    // Digit check
    if (requirements.requireDigits && !/[0-9]/.test(password)) {
        errors.push('Password must contain at least one number')
    }

    // Symbol check
    if (requirements.requireSymbols && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) {
        errors.push('Password must contain at least one special character (!@#$%^&*...)')
    }

    // Calculate strength
    const strength = calculatePasswordStrength(password)

    return {
        isValid: errors.length === 0,
        errors,
        strength,
    }
}

/**
 * Calculates password strength based on entropy
 */
function calculatePasswordStrength(password: string): 'weak' | 'fair' | 'strong' | 'very-strong' {
    let score = 0

    // Length scoring
    if (password.length >= 8) score += 1
    if (password.length >= 12) score += 1
    if (password.length >= 16) score += 1
    if (password.length >= 20) score += 1

    // Character variety scoring
    if (/[a-z]/.test(password)) score += 1
    if (/[A-Z]/.test(password)) score += 1
    if (/[0-9]/.test(password)) score += 1
    if (/[^a-zA-Z0-9]/.test(password)) score += 1

    // Bonus for mixed content
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1
    if (/[0-9]/.test(password) && /[^a-zA-Z0-9]/.test(password)) score += 1

    if (score <= 3) return 'weak'
    if (score <= 5) return 'fair'
    if (score <= 7) return 'strong'
    return 'very-strong'
}

/**
 * Returns a human-readable description of password requirements
 */
export function getPasswordRequirementsText(
    requirements: PasswordRequirements = DEFAULT_PASSWORD_REQUIREMENTS
): string {
    const parts: string[] = [`At least ${requirements.minLength} characters`]

    if (requirements.requireLowercase) parts.push('lowercase letter')
    if (requirements.requireUppercase) parts.push('uppercase letter')
    if (requirements.requireDigits) parts.push('number')
    if (requirements.requireSymbols) parts.push('special character')

    if (parts.length > 2) {
        return `${parts[0]} with at least one ${parts.slice(1).join(', ')}`
    }
    return parts.join(' with ')
}
