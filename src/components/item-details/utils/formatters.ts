// Formatting utilities for ItemDetailView
// Extracted from ItemDetailView.tsx for reuse across category-specific components

import { isValidValue } from './validation'

/**
 * Format runtime minutes into human-readable string (e.g., "2h 15m")
 */
export function formatRuntime(minutes: number | null): string | null {
    if (!minutes || minutes === 0) return null
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours === 0) return `${mins}m`
    if (mins === 0) return `${hours}h`
    return `${hours}h ${mins}m`
}

/**
 * Format currency value into USD format (e.g., "$150,000,000")
 */
export function formatCurrency(amount: number | string | null | undefined): string | null {
    if (amount === null || amount === undefined) return null
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    if (isNaN(num) || num === 0) return null

    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0
    }).format(num)
}

/**
 * Get full language name from ISO code (e.g., "en" -> "English")
 */
export function getLanguageName(code: string | null): string | null {
    if (!code || !isValidValue(code)) return null
    try {
        const name = new Intl.DisplayNames(['en'], { type: 'language' }).of(code)
        return name || null
    } catch {
        return null
    }
}

/**
 * Get full country name from ISO code (e.g., "US" -> "United States")
 */
export function getCountryName(code: string | null): string | null {
    if (!code || !isValidValue(code)) return null
    try {
        const name = new Intl.DisplayNames(['en'], { type: 'region' }).of(code.toUpperCase())
        return name || null
    } catch {
        return null
    }
}

/**
 * Format anime season string, avoiding duplicate year
 * e.g., "Winter 2024" or just "Winter" if year is passed separately
 */
export function formatAnimeSeason(season: string | null, year: number | null): string | null {
    if (!season && !year) return null
    if (!season) return String(year)

    // Check if the season string already contains a year (e.g., "Winter 2024")
    const seasonHasYear = /\d{4}/.test(season)
    if (seasonHasYear) return toTitleCase(season)

    // Combine season + year without duplication
    return `${toTitleCase(season)} ${year || ''}`.trim()
}

/**
 * Convert string to Title Case
 */
export function toTitleCase(str: string | null): string | null {
    if (!str) return null
    return str.replace(/\b\w/g, char => char.toUpperCase())
}

/**
 * Clean title - removes artifacts like "..." and trims whitespace
 */
export function cleanTitle(title: string | null): string {
    if (!title) return ''
    return title
        .replace(/^\.{2,}\s*/g, '') // Remove leading ellipses
        .replace(/\s*\.{2,}$/g, '') // Remove trailing ellipses
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim()
}

/**
 * Get complexity data for board games (1-5 weight scale from BGG)
 */
export function getComplexityData(weight: number | null): { label: string; color: string } {
    if (!weight) return { label: 'Unknown', color: 'text-zinc-400' }
    if (weight <= 1.2) return { label: 'Very Simple', color: 'text-green-300' }  // Party games
    if (weight <= 2.4) return { label: 'Light', color: 'text-green-400' }        // Gateway games
    if (weight <= 3.2) return { label: 'Medium', color: 'text-yellow-400' }      // Standard Euro
    if (weight <= 3.8) return { label: 'Hard', color: 'text-orange-400' }        // Heavy Strategy
    return { label: 'Expert', color: 'text-red-500' }                            // Wargames/18xx
}

/**
 * Format duration in milliseconds to mm:ss format
 */
export function formatDuration(ms: number | null): string {
    if (!ms) return '--:--'
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

/**
 * Get energy level label from Spotify energy value (0-1)
 */
export function getEnergyLevel(energy: number | undefined): string {
    if (energy === undefined) return 'N/A'
    if (energy >= 0.7) return 'High'
    if (energy >= 0.4) return 'Medium'
    return 'Low'
}
