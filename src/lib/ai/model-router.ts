/**
 * Model Router with Fallback Support
 * 
 * Implements resilience patterns:
 * - Priority-based provider selection
 * - Automatic failover on errors
 * - Cost/complexity routing
 * - Circuit breaker pattern
 */

import { callLLM, type LLMOptions } from '@/lib/llm'

export interface ProviderConfig {
    name: string
    apiKeyEnvVar: string
    model: string
    priority: number // Lower = higher priority
    maxTokens: number
    costPerMToken: number // Cost per million tokens
    isAvailable: boolean
}

export interface RouterOptions {
    prompt: string
    systemPrompt?: string
    jsonMode?: boolean
    maxTokens?: number
    complexity?: 'low' | 'medium' | 'high'
    maxRetries?: number
}

export interface RouterResult {
    response: string
    provider: string
    model: string
    fallbackUsed: boolean
    attempts: number
}

// Provider configurations (ordered by priority)
const PROVIDERS: ProviderConfig[] = [
    {
        name: 'openrouter',
        apiKeyEnvVar: 'OPENROUTER_API_KEY',
        model: 'anthropic/claude-3-5-haiku-20241022',
        priority: 1,
        maxTokens: 8192,
        costPerMToken: 1.0,
        isAvailable: true,
    },
    {
        name: 'openai',
        apiKeyEnvVar: 'OPENAI_API_KEY',
        model: 'gpt-4o-mini',
        priority: 2,
        maxTokens: 16384,
        costPerMToken: 0.15,
        isAvailable: true,
    },
    {
        name: 'anthropic',
        apiKeyEnvVar: 'ANTHROPIC_API_KEY',
        model: 'claude-3-5-haiku-20241022',
        priority: 3,
        maxTokens: 8192,
        costPerMToken: 1.0,
        isAvailable: true,
    },
]

// Circuit breaker state (in-memory, consider Upstash for distributed)
const circuitState = new Map<string, {
    failures: number
    lastFailure: number
    isOpen: boolean
}>()

const CIRCUIT_THRESHOLD = 3 // failures before opening
const CIRCUIT_RESET_MS = 60000 // 1 minute reset

/**
 * Check if circuit breaker is open for a provider
 */
function isCircuitOpen(provider: string): boolean {
    const state = circuitState.get(provider)
    if (!state) return false

    // Check if we should reset
    if (state.isOpen && Date.now() - state.lastFailure > CIRCUIT_RESET_MS) {
        state.isOpen = false
        state.failures = 0
        return false
    }

    return state.isOpen
}

/**
 * Record a failure for circuit breaker
 */
function recordFailure(provider: string): void {
    const state = circuitState.get(provider) || { failures: 0, lastFailure: 0, isOpen: false }
    state.failures++
    state.lastFailure = Date.now()

    if (state.failures >= CIRCUIT_THRESHOLD) {
        state.isOpen = true
        console.warn(`[ModelRouter] Circuit opened for ${provider}`)
    }

    circuitState.set(provider, state)
}

/**
 * Record a success (resets circuit breaker)
 */
function recordSuccess(provider: string): void {
    circuitState.delete(provider)
}

/**
 * Get model based on task complexity
 */
function getModelForComplexity(provider: ProviderConfig, complexity: 'low' | 'medium' | 'high'): string {
    // Route simple tasks to cheaper models
    if (complexity === 'low') {
        switch (provider.name) {
            case 'openrouter':
                return 'mistralai/mistral-7b-instruct'
            case 'openai':
                return 'gpt-4o-mini'
            default:
                return provider.model
        }
    }

    // Complex tasks get full-power models
    if (complexity === 'high') {
        switch (provider.name) {
            case 'openrouter':
                return 'anthropic/claude-3-5-sonnet-20241022'
            case 'openai':
                return 'gpt-4o'
            default:
                return provider.model
        }
    }

    return provider.model
}

/**
 * Route a request through available providers with fallback
 */
export async function routeWithFallback(options: RouterOptions): Promise<RouterResult> {
    const {
        prompt,
        systemPrompt,
        jsonMode = false,
        maxTokens = 2048,
        complexity = 'medium',
        maxRetries = 3
    } = options

    // Sort by priority
    const sortedProviders = [...PROVIDERS]
        .filter(p => p.isAvailable && !isCircuitOpen(p.name))
        .sort((a, b) => a.priority - b.priority)

    if (sortedProviders.length === 0) {
        throw new Error('No available LLM providers - all circuits are open')
    }

    let lastError: Error | null = null
    let attempts = 0

    for (const provider of sortedProviders) {
        const apiKey = process.env[provider.apiKeyEnvVar]
        if (!apiKey) continue

        const model = getModelForComplexity(provider, complexity)

        for (let retry = 0; retry < maxRetries; retry++) {
            attempts++

            try {
                const llmOptions: LLMOptions = {
                    userPrompt: prompt,
                    systemPrompt,
                    apiKey,
                    provider: provider.name,
                    model,
                    jsonMode,
                    maxTokens,
                    timeoutMs: 30000,
                }

                const response = await callLLM(llmOptions)

                // Success - reset circuit
                recordSuccess(provider.name)

                return {
                    response,
                    provider: provider.name,
                    model,
                    fallbackUsed: attempts > 1,
                    attempts,
                }
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error))

                // Check if retryable
                const isRetryable = isRetryableError(lastError)

                if (!isRetryable) {
                    // Non-retryable error - break and move to next provider
                    // Failure will be recorded after the retry loop
                    break
                }

                // Exponential backoff for retryable errors
                await sleep(Math.pow(2, retry) * 1000)
            }
        }

        // Provider exhausted after all retries, record failure and try next
        recordFailure(provider.name)
    }

    // All providers failed - return static fallback
    console.error('[ModelRouter] All providers failed:', lastError?.message)

    return {
        response: getStaticFallback(prompt),
        provider: 'static',
        model: 'none',
        fallbackUsed: true,
        attempts,
    }
}

function isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase()
    return (
        message.includes('timeout') ||
        message.includes('rate limit') ||
        message.includes('503') ||
        message.includes('502') ||
        message.includes('connection')
    )
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

function getStaticFallback(prompt: string): string {
    // Return a safe static response when all AI providers fail
    return JSON.stringify({
        error: false,
        fallback: true,
        message: 'AI service temporarily unavailable. Please try again later.',
        suggestion: 'Use the search feature to find what you\'re looking for.',
    })
}

// Re-export LLMOptions type
export type { LLMOptions }
