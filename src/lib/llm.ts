import { getSettings } from '@/lib/actions/settings'

export function cleanLLMResponse(text: string): string {
    let cleaned = text.trim()

    // Step A: Strip markdown code blocks (more robust regex)
    // Matches ```json OR ``` followed by content, optionally ending with ```
    const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/i)
    if (codeBlockMatch && codeBlockMatch[1]) {
        cleaned = codeBlockMatch[1].trim()
    }

    // Step B: aggressive cleanup if it still doesn't look like JSON
    // If it doesn't start with { or [, try to find the first occurrence
    if (!cleaned.startsWith('{') && !cleaned.startsWith('[')) {
        const firstBrace = cleaned.indexOf('{')
        const firstBracket = cleaned.indexOf('[')

        let startIdx = -1
        if (firstBrace !== -1 && firstBracket !== -1) {
            startIdx = Math.min(firstBrace, firstBracket)
        } else if (firstBrace !== -1) {
            startIdx = firstBrace
        } else if (firstBracket !== -1) {
            startIdx = firstBracket
        }

        if (startIdx !== -1) {
            cleaned = cleaned.substring(startIdx)
        }
    }

    // Step C: reverse cleanup (find last } or ])
    if (!cleaned.endsWith('}') && !cleaned.endsWith(']')) {
        const lastBrace = cleaned.lastIndexOf('}')
        const lastBracket = cleaned.lastIndexOf(']')

        let endIdx = -1
        if (lastBrace !== -1 && lastBracket !== -1) {
            endIdx = Math.max(lastBrace, lastBracket)
        } else if (lastBrace !== -1) {
            endIdx = lastBrace
        } else if (lastBracket !== -1) {
            endIdx = lastBracket
        }

        if (endIdx !== -1) {
            cleaned = cleaned.substring(0, endIdx + 1)
        }
    }

    return cleaned
}

// LLM Options interface
export interface LLMOptions {
    userPrompt: string
    systemPrompt?: string
    apiKey: string           // REQUIRED
    provider: 'openai' | 'anthropic' | 'openrouter' | string
    model?: string           // Optional, uses defaults per provider
    endpoint?: string        // Optional custom endpoint
    jsonMode?: boolean       // Enable structured JSON output (OpenAI JSON mode)
    maxTokens?: number       // Max output tokens (default: 2048)
    timeoutMs?: number       // Request timeout in ms (default: 30000)
}

// Provider configurations with defaults
const PROVIDER_CONFIGS: Record<string, { endpoint: string; defaultModel: string }> = {
    openrouter: {
        endpoint: 'https://openrouter.ai/api/v1',
        defaultModel: 'mistralai/mistral-7b-instruct'
    },
    openai: {
        endpoint: 'https://api.openai.com/v1',
        defaultModel: 'gpt-4o'
    },
    anthropic: {
        endpoint: 'https://api.anthropic.com/v1',
        defaultModel: 'claude-3-sonnet-20240229'
    }
}

/**
 * Call LLM with explicit configuration
 * @param options - LLM options including apiKey, provider, model, prompts
 */
export async function callLLM(options: LLMOptions): Promise<string> {
    const {
        userPrompt,
        systemPrompt,
        apiKey,
        provider,
        model,
        endpoint,
        jsonMode,
        maxTokens = 2048,      // Default cap to control costs
        timeoutMs = 30000      // 30 second default timeout
    } = options

    if (!apiKey) {
        throw new Error('API Key is required. Please configure an API key in Settings.')
    }

    // Get provider config
    const providerConfig = PROVIDER_CONFIGS[provider] || PROVIDER_CONFIGS.openrouter
    const finalEndpoint = endpoint || providerConfig.endpoint
    const finalModel = model || providerConfig.defaultModel

    // Build API URL
    let apiUrl = finalEndpoint
    if (!apiUrl.endsWith('/chat/completions')) {
        apiUrl = apiUrl.replace(/\/$/, '')
        apiUrl = `${apiUrl}/chat/completions`
    }

    // Build headers based on provider
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    }

    // Set authorization header based on provider
    if (provider === 'anthropic') {
        headers['x-api-key'] = apiKey
        headers['anthropic-version'] = '2023-06-01'
    } else {
        // OpenAI, OpenRouter, and others use Bearer token
        headers['Authorization'] = `Bearer ${apiKey}`
    }

    // Add OpenRouter-specific headers
    if (provider === 'openrouter' || finalEndpoint.includes('openrouter')) {
        headers['HTTP-Referer'] = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        headers['X-Title'] = 'Curator App'
    }

    // Build request body
    const requestBody: Record<string, unknown> = {
        model: finalModel,
        messages: [
            {
                role: 'system',
                content: systemPrompt || 'You are a helpful assistant. Return ONLY JSON.'
            },
            {
                role: 'user',
                content: userPrompt
            }
        ],
        temperature: 0.7
    }

    // Add JSON mode for OpenAI-compatible APIs
    // This ensures the model outputs valid JSON without markdown code blocks
    if (jsonMode && provider !== 'anthropic') {
        requestBody.response_format = { type: 'json_object' }
    }

    // Add max_tokens to cap output and control costs
    requestBody.max_tokens = maxTokens

    // Create abort controller for timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(requestBody),
            signal: controller.signal
        })

        if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`LLM API Error: ${response.status} ${response.statusText} - ${errorText}`)
        }

        const data = await response.json()
        let content = data.choices[0].message.content

        // If JSON mode was requested, clean up any residual formatting
        // (Some providers may still include code blocks even with response_format)
        if (jsonMode) {
            content = cleanLLMResponse(content)
        }

        return content
    } catch (error: any) {
        if (error.name === 'AbortError') {
            throw new Error('LLM request timed out. Please try again.')
        }
        console.error('LLM Call Failed:', error)
        throw error
    } finally {
        clearTimeout(timeoutId)
    }
}

/**
 * Helper function that fetches config from database and calls LLM
 * Use this for convenience when you want automatic config loading
 * @param userPrompt - The user prompt to send
 * @param systemPrompt - Optional system prompt
 * @param jsonMode - Enable JSON mode for structured output
 */
export async function callLLMWithConfig(
    userPrompt: string,
    systemPrompt?: string,
    jsonMode?: boolean,
    options?: { maxTokens?: number }
): Promise<string> {
    const { SystemConfigService } = await import('@/lib/services/SystemConfigService')

    // Fetch all configs in parallel (request-memoized, so deduped within request)
    const [provider, apiKey, endpoint, model, anannasKey, openaiKey] = await Promise.all([
        SystemConfigService.getDecryptedConfig('llm_provider'),
        SystemConfigService.getDecryptedConfig('llm_api_key'),
        SystemConfigService.getDecryptedConfig('llm_endpoint'),
        SystemConfigService.getDecryptedConfig('llm_model'),
        // Legacy fallback keys
        SystemConfigService.getDecryptedConfig('anannas_api_key'),
        SystemConfigService.getDecryptedConfig('openai_api_key'),
    ])

    const finalApiKey = apiKey || anannasKey || openaiKey

    if (!finalApiKey) {
        throw new Error('No LLM API Key configured. Please add an API key in Settings.')
    }

    return callLLM({
        userPrompt,
        systemPrompt,
        apiKey: finalApiKey,
        provider: provider || 'openrouter',
        model: model || undefined,
        endpoint: endpoint || undefined,
        jsonMode,
        maxTokens: options?.maxTokens // Pass through or use default in callLLM
    })
}

/**
 * Convenience function for calling LLM with JSON mode enabled.
 * Uses native JSON mode (response_format) and applies cleanup.
 * Best for structured data responses like analysis results.
 */
export async function callLLMForJSON(
    userPrompt: string,
    systemPrompt?: string,
    options?: { maxTokens?: number }
): Promise<string> {
    return callLLMWithConfig(userPrompt, systemPrompt, true, options)
}

/**
 * Test LLM connection with a lightweight "hello world" request.
 * Uses the same underlying API logic as the main application.
 * 
 * @param provider - LLM provider name (openai, anthropic, openrouter, gemini, etc.)
 * @param apiKey - API key to test
 * @param model - Optional model to use for the test
 * @param endpoint - Optional custom endpoint
 * @returns Object with success status and message
 */
export async function testLLMConnection(
    provider: string,
    apiKey: string,
    model?: string,
    endpoint?: string
): Promise<{ success: boolean; message: string }> {
    try {
        // Special handling for Gemini (different API format)
        if (provider === 'gemini') {
            const testModel = model || 'gemini-1.5-flash'
            const res = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${testModel}:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: 'Say "Verified"' }] }]
                    })
                }
            )
            const json = await res.json()
            if (!res.ok) {
                throw new Error(json.error?.message || 'Gemini Connection Failed')
            }
            return { success: true, message: 'Gemini: Connection Verified' }
        }

        // For OpenAI-compatible providers (OpenAI, Anthropic, OpenRouter, Ollama, etc.)
        // Use the standard callLLM function
        await callLLM({
            userPrompt: 'Say "Verified"',
            systemPrompt: 'You are a test assistant. Respond with exactly one word.',
            apiKey,
            provider,
            model,
            endpoint
        })

        const providerName = provider.charAt(0).toUpperCase() + provider.slice(1)
        return { success: true, message: `${providerName}: Connection Verified` }

    } catch (error: any) {
        console.error('LLM Test Connection Failed:', error)
        return {
            success: false,
            message: error.message || 'Connection test failed'
        }
    }
}

