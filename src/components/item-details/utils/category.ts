// Category utilities for ItemDetailView
// Extracted from ItemDetailView.tsx for reuse across category-specific components

import { Film, Tv, Sparkles, Gamepad2, Dice5, Music, BookOpen, type LucideIcon } from 'lucide-react'
import type { CategoryType } from '../types'

/**
 * Get the appropriate icon component for a category type
 */
export function getCategoryIcon(type: string | null): LucideIcon {
    const cat = type?.toUpperCase() || ''
    if (cat.includes('MOVIE')) return Film
    if (cat.includes('TV')) return Tv
    if (cat.includes('ANIME')) return Sparkles
    if (cat.includes('VIDEO') || (cat.includes('GAME') && !cat.includes('BOARD'))) return Gamepad2
    if (cat.includes('BOARD')) return Dice5
    if (cat.includes('MUSIC') || cat.includes('ALBUM')) return Music
    if (cat.includes('BOOK')) return BookOpen
    return Film
}

/**
 * Normalize category type to a standard enum value
 */
export function normalizeCategory(category: string | null): CategoryType {
    const cat = category?.toUpperCase() || ''
    if (cat.includes('MOVIE')) return 'MOVIE'
    if (cat.includes('TV')) return 'TV'
    if (cat.includes('ANIME')) return 'ANIME'
    if (cat.includes('VIDEO') || (cat.includes('GAME') && !cat.includes('BOARD'))) return 'VIDEO_GAME'
    if (cat.includes('BOARD')) return 'BOARD_GAME'
    if (cat.includes('BOOK')) return 'BOOK'
    if (cat.includes('MUSIC') || cat.includes('ALBUM')) return 'MUSIC_ALBUM'
    return 'UNKNOWN'
}

/**
 * Decode HTML entities in text (e.g., from API responses)
 */
export function decodeHTMLEntities(text: string): string {
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/<br\s*\/?>/gi, '\n')
}

/**
 * Category-specific color themes
 */
export const CATEGORY_COLORS: Record<CategoryType, string> = {
    MOVIE: 'blue',
    TV: 'purple',
    TV_SHOW: 'purple',
    ANIME: 'pink',
    VIDEO_GAME: 'green',
    BOARD_GAME: 'orange',
    BOOK: 'emerald',
    MUSIC_ALBUM: 'teal',
    MUSIC_ARTIST: 'emerald',
    MUSIC_TRACK: 'purple',
    UNKNOWN: 'zinc'
}
