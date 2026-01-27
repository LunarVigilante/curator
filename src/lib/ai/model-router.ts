/**
 * Model Router with Fallback Support
 * 
 * Implements resilience patterns:
 * - Priority-based provider selection
 * - Automatic failover on errors
 * - Cost/complexity routing
 * - Circuit breaker pattern (distributed via Upstash)
 */

import { callLLM, type LLMOptions } from '@/lib/llm'
import { Redis } from '@upstash/redis'

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

const CIRCUIT_THRESHOLD = 3 // failures before opening
const CIRCUIT_RESET_MS = 60000 // 1 minute reset
const CIRCUIT_KEY_PREFIX = 'circuit:'

// Lazy-initialized Redis client for distributed circuit breaker
let redis: Redis | null = null

function getRedis(): Redis | null {
    if (redis) return redis

    const url = process.env.UPSTASH_REDIS_REST_URL
    const token = process.env.UPSTASH_REDIS_REST_TOKEN

    if (!url || !token) {
        console.warn('[ModelRouter] Upstash not configured, circuit breaker will be in-memory only')
        return null
    }

    redis = new Redis({ url, token })
    return redis
}

// In-memory fallback when Upstash not available
const inMemoryCircuitState = new Map<string, {
    failures: number
    lastFailure: number
    isOpen: boolean
}>()

/**
 * Check if circuit breaker is open for a provider (distributed)
 */
async function isCircuitOpen(provider: string): Promise<boolean> {
    const client = getRedis()

    if (!client) {
        // Fallback to in-memory
        const state = inMemoryCircuitState.get(provider)
        if (!state) return false

        if (state.isOpen && Date.now() - state.lastFailure > CIRCUIT_RESET_MS) {
            state.isOpen = false
            state.failures = 0
            return false
        }
        return state.isOpen
    }

    try {
        const key = `${CIRCUIT_KEY_PREFIX}${provider}`
        const data = await client.get<{ failures: number; lastFailure: number; isOpen: boolean }>(key)

        if (!data) return false

        // Check if we should reset
        if (data.isOpen && Date.now() - data.lastFailure > CIRCUIT_RESET_MS) {
            await client.del(key)
            return false
        }

        return data.isOpen
    } catch (error) {
        console.warn('[ModelRouter] Redis error, falling back to in-memory:', error)
        return false
    }
}

/**
 * Record a failure for circuit breaker (distributed)
 */
async function recordFailure(provider: string): Promise<void> {
    const client = getRedis()

    if (!client) {
        // Fallback to in-memory
        const state = inMemoryCircuitState.get(provider) || { failures: 0, lastFailure: 0, isOpen: false }
        state.failures++
        state.lastFailure = Date.now()

        if (state.failures >= CIRCUIT_THRESHOLD) {
            state.isOpen = true
            console.warn(`[ModelRouter] Circuit opened for ${provider}`)
        }

        inMemoryCircuitState.set(provider, state)
        return
    }

    try {
        const key = `${CIRCUIT_KEY_PREFIX}${provider}`
        const data = await client.get<{ failures: number; lastFailure: number; isOpen: boolean }>(key) ||
            { failures: 0, lastFailure: 0, isOpen: false }

        data.failures++
        data.lastFailure = Date.now()

        if (data.failures >= CIRCUIT_THRESHOLD) {
            data.isOpen = true
            console.warn(`[ModelRouter] Circuit opened for ${provider}`)
        }

        // Store with TTL of 2 minutes (auto-cleanup)
        await client.set(key, data, { ex: 120 })
    } catch (error) {
        console.warn('[ModelRouter] Redis error recording failure:', error)
    }
}

/**
 * Record a success (resets circuit breaker)
 */
async function recordSuccess(provider: string): Promise<void> {
    const client = getRedis()

    if (!client) {
        inMemoryCircuitState.delete(provider)
        return
    }

    try {
        await client.del(`${CIRCUIT_KEY_PREFIX}${provider}`)
    } catch (error) {
        console.warn('[ModelRouter] Redis error recording success:', error)
    }
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

    // Filter available providers (check circuits in parallel)
    const circuitChecks = await Promise.all(
        PROVIDERS.map(async p => ({
            provider: p,
            isOpen: await isCircuitOpen(p.name)
        }))
    )

    const sortedProviders = circuitChecks
        .filter(c => c.provider.isAvailable && !c.isOpen)
        .map(c => c.provider)
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
                await recordSuccess(provider.name)

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
        await recordFailure(provider.name)
    }

    // All providers failed - return static fallback
    console.error('[ModelRouter] All providers failed:', lastError?.message)

    return {
        response: getStaticFallback(),
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

function getStaticFallback(): string {
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
