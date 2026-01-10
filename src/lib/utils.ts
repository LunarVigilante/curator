import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Normalizes a search query by removing "noise" characters like punctuation.
 * Useful for APIs with strict search parsers (e.g., BoardGameGeek, TMDB).
 * 
 * Example: "Marvel's Spider-Man: Miles Morales" -> "Marvels Spider Man Miles Morales"
 */
export function cleanSearchQuery(input: string): string {
  if (!input) return ''

  return input
    // Remove apostrophes entirely (O'Reilly -> OReilly) to keep words together if needed, 
    // OR replace with space? The user example shows "Marvel's" -> "Marvels", so remove them.
    .replace(/['’]/g, '')
    // Replace other punctuation with spaces (colons, dashes, etc.)
    .replace(/[^\w\s]/g, ' ')
    // Collapse multiple spaces
    .replace(/\s+/g, ' ')
    .trim()
}
