/**
 * LLM Refusal Detection
 * 
 * Detects when an LLM refuses to generate content
 */

// Patterns that indicate the AI is refusing to generate content
export const REFUSAL_PATTERNS = [
    // Direct refusals
    "I can't generate", "I cannot generate", "I am unable to",
    "I'm not able to", "I apologize, but", "I can't help with",
    "I won't be able to", "I must decline", "I cannot create",
    "I can't create", "I cannot provide", "I can't provide",
    // Content policy triggers
    "sexually explicit", "adult content", "harmful content",
    "violates my safety", "inappropriate content", "explicit content",
    "mature content", "NSFW", "not appropriate",
    // Soft refusals (offers to help with something else)
    "I'm happy to help with other", "happy to help with those instead",
    "If you have other", "I'd be glad to help with",
    // Meta-commentary
    "As an AI", "I cannot fulfill", "against my guidelines",
    "content policy", "safety guidelines"
];

// Fallback model for mature/controversial content
export const GROK_MODEL = 'x-ai/grok-4.1-fast';

/**
 * Check if a response contains refusal patterns
 */
export function isRefusal(response: string): boolean {
    const lowerResponse = response.toLowerCase();

    // Check for explicit refusal patterns
    const hasRefusalPattern = REFUSAL_PATTERNS.some(pattern =>
        lowerResponse.includes(pattern.toLowerCase())
    );

    if (hasRefusalPattern) return true;

    // Heuristic: If response mentions "help" near the end and is very long, it's likely a refusal
    if (lowerResponse.includes("help") && response.length > 200 &&
        (lowerResponse.includes("instead") || lowerResponse.includes("other"))) {
        return true;
    }

    return false;
}
