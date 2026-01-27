/**
 * AI Request Logger for Axiom
 * 
 * Structured logging for AI requests with:
 * - Token usage tracking
 * - Prompt length monitoring
 * - Anomaly detection fields
 */

interface AILogEvent {
    // Request identification
    requestId: string
    timestamp: string

    // Provider info
    provider: string
    model: string

    // Token metrics
    promptTokens: number
    completionTokens: number
    totalTokens: number

    // Timing
    latencyMs: number

    // Content metrics (for anomaly detection)
    promptLength: number
    responseLength: number

    // Security flags
    containsCodeBlock: boolean
    containsSQLKeywords: boolean
    unusuallyLong: boolean // >10k chars

    // Status
    success: boolean
    errorMessage?: string
    fallbackUsed: boolean

    // User context (anonymized)
    userId?: string
    requestType: string // 'enrichment' | 'description' | 'query' | 'tags'
}

/**
 * Log an AI request to console (Axiom via Vercel Log Drain)
 */
export function logAIRequest(event: Partial<AILogEvent>): void {
    const fullEvent: AILogEvent = {
        requestId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        provider: 'unknown',
        model: 'unknown',
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        latencyMs: 0,
        promptLength: 0,
        responseLength: 0,
        containsCodeBlock: false,
        containsSQLKeywords: false,
        unusuallyLong: false,
        success: true,
        fallbackUsed: false,
        requestType: 'unknown',
        ...event,
    }

    // Detect anomalies
    fullEvent.unusuallyLong = fullEvent.promptLength > 10000 || fullEvent.responseLength > 50000

    // Log as structured JSON (Axiom will parse this)
    console.log(JSON.stringify({
        level: fullEvent.success ? 'info' : 'error',
        message: `AI Request: ${fullEvent.requestType}`,
        _axiom_category: 'ai_request',
        ...fullEvent,
    }))
}

/**
 * Analyze prompt for security concerns
 */
export function analyzePrompt(prompt: string): {
    containsCodeBlock: boolean
    containsSQLKeywords: boolean
    estimatedTokens: number
    riskLevel: 'low' | 'medium' | 'high'
} {
    const containsCodeBlock = /```[\s\S]*?```/g.test(prompt)
    const containsSQLKeywords = /\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE)\b/i.test(prompt)

    // Rough token estimation (1 token ≈ 4 chars)
    const estimatedTokens = Math.ceil(prompt.length / 4)

    // Risk assessment
    let riskLevel: 'low' | 'medium' | 'high' = 'low'

    if (containsSQLKeywords) riskLevel = 'medium'
    if (prompt.length > 10000) riskLevel = 'medium'
    if (prompt.includes('[INST]') || prompt.includes('</s>')) riskLevel = 'high'
    if (prompt.toLowerCase().includes('ignore previous')) riskLevel = 'high'
    if (prompt.toLowerCase().includes('system prompt')) riskLevel = 'high'

    return {
        containsCodeBlock,
        containsSQLKeywords,
        estimatedTokens,
        riskLevel,
    }
}

/**
 * Create a wrapped LLM caller with automatic logging
 */
export function createLoggedLLMCaller(
    baseCaller: (prompt: string, systemPrompt?: string) => Promise<string>,
    requestType: string
) {
    return async (prompt: string, systemPrompt?: string): Promise<string> => {
        const startTime = Date.now()
        const analysis = analyzePrompt(prompt)

        // Block high-risk prompts
        if (analysis.riskLevel === 'high') {
            logAIRequest({
                requestType,
                success: false,
                errorMessage: 'Blocked: High-risk prompt detected',
                promptLength: prompt.length,
                containsSQLKeywords: analysis.containsSQLKeywords,
            })
            throw new Error('Request blocked due to security concerns')
        }

        try {
            const response = await baseCaller(prompt, systemPrompt)
            const latencyMs = Date.now() - startTime

            logAIRequest({
                requestType,
                success: true,
                latencyMs,
                promptLength: prompt.length,
                responseLength: response.length,
                containsCodeBlock: analysis.containsCodeBlock,
                containsSQLKeywords: analysis.containsSQLKeywords,
                promptTokens: analysis.estimatedTokens,
                completionTokens: Math.ceil(response.length / 4),
                totalTokens: analysis.estimatedTokens + Math.ceil(response.length / 4),
            })

            return response
        } catch (error) {
            const latencyMs = Date.now() - startTime

            logAIRequest({
                requestType,
                success: false,
                latencyMs,
                promptLength: prompt.length,
                errorMessage: error instanceof Error ? error.message : 'Unknown error',
                containsSQLKeywords: analysis.containsSQLKeywords,
            })

            throw error
        }
    }
}
