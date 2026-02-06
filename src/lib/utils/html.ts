/**
 * HTML Utilities
 * 
 * Functions for cleaning and decoding HTML content
 */

// Patterns to remove - only match at START of line or after newline
const HEADER_PATTERNS = [
    /(?:^|\n)\s*(?:\d+\.\s*)?PREMISE\s*:?\s*/gim,
    /(?:^|\n)\s*(?:\d+\.\s*)?THEMES?\s*(?:&|AND)?\s*TROPES?\s*:?\s*/gim,
    /(?:^|\n)\s*(?:\d+\.\s*)?TONE\s*(?:&|AND)?\s*APPEAL\s*:?\s*/gim,
    /(?:^|\n)\s*(?:\d+\.\s*)?CHARACTER\s*ARCHETYPES?\s*:?\s*/gim,
    /(?:^|\n)\s*(?:\d+\.\s*)?STORY\s*TROPES?\s*:?\s*/gim,
    /(?:^|\n)\s*(?:\d+\.\s*)?FOOTER\s*:?\s*/gim,
];

/**
 * Decode HTML entities (e.g., &#039; -> ')
 */
export function decodeHTMLEntities(text: string): string {
    if (!text) return '';
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&#39;/g, "'")
        .replace(/&#x27;/g, "'")
        .replace(/&ndash;/g, '–')
        .replace(/&mdash;/g, '—')
        .replace(/&hellip;/g, '…')
        .replace(/&#10;/g, ' ')
        .replace(/&nbsp;/g, ' ');
}

/**
 * Clean up LLM-generated descriptions
 * Removes section headers, normalizes whitespace
 */
export function cleanDescription(description: string): string {
    let cleaned = description;

    // 1. Remove Headers
    for (const pattern of HEADER_PATTERNS) {
        cleaned = cleaned.replace(pattern, '');
    }

    // 2. Fix Paragraphs
    // Replace 3+ newlines with 2 newlines (standard paragraph break)
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

    // Replace multiple spaces (NOT newlines) with single space
    cleaned = cleaned.replace(/[^\S\r\n]{2,}/g, ' ');

    // Trim lines
    cleaned = cleaned.split('\n').map(line => line.trim()).join('\n');

    return cleaned.trim();
}
