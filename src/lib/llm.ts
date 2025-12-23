import { getSettings } from '@/lib/actions/settings'


export function cleanLLMResponse(text: string): string {
    let cleaned = text.trim()

    // Step A: Strip markdown code blocks
    const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    if (codeBlockMatch) {
        cleaned = codeBlockMatch[1].trim()
    }

    // Step B & C: Attempt JSON parse
    try {
        const parsed = JSON.parse(cleaned)

        if (typeof parsed === 'object' && parsed !== null) {
            // If it has a description property, use that
            if ('description' in parsed && typeof parsed.description === 'string') {
                return parsed.description.trim()
            }
            // Fallback: return the first string value found
            for (const value of Object.values(parsed)) {
                if (typeof value === 'string') return value.trim()
            }
        }

        // If it's a string, it might have been JSON-wrapped string
        if (typeof parsed === 'string') return parsed.trim()
    } catch (e) {
        // Parsing failed, return as-is (already plain text or malformed JSON)
    }

    return cleaned
}

export async function callLLM(prompt: string, systemPrompt?: string) {
    const { SystemConfigService } = await import('@/lib/services/SystemConfigService')

    // Fetch configs safely from Vault
    // Prioritize Anannas
    const anannasKey = await SystemConfigService.getDecryptedConfig('anannas_api_key');
    const openaiKey = await SystemConfigService.getDecryptedConfig('openai_api_key');

    // Default to Anannas if available, otherwise Fallback to OpenRouter/OpenAI? 
    // User requested "Replace OpenRouter... Keep OpenRouter... uncommented or as backup".

    let apiKey = anannasKey || openaiKey;
    let endpoint = 'https://api.anannas.ai/v1'; // Hypothetical Anannas Endpoint
    let model = 'anannas-core'; // Hypothetical Model

    // Verify logic
    if (anannasKey) {
        endpoint = await SystemConfigService.getDecryptedConfig('anannas_endpoint') || 'https://api.anannas.ai/v1';
        model = await SystemConfigService.getDecryptedConfig('anannas_model') || 'anannas-v1';
    } else if (openaiKey) {
        // Fallback
        endpoint = await SystemConfigService.getDecryptedConfig('llm_endpoint') || 'https://openrouter.ai/api/v1';
        model = await SystemConfigService.getDecryptedConfig('llm_model') || 'openai/gpt-4o';
    } else {
        throw new Error('No LLM API Key configured (Anannas or OpenAI). Please check System Settings.');
    }

    // Ensure endpoint ends with /chat/completions
    let apiUrl = endpoint
    if (!apiUrl.endsWith('/chat/completions')) {
        // Remove trailing slash if present
        apiUrl = apiUrl.replace(/\/$/, '')
        apiUrl = `${apiUrl}/chat/completions`
    }

    // Simple heuristic for other providers if needed in future
    // if (provider === 'anthropic') apiUrl = '...'

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': 'https://universal-ranking-system.local', // Required by OpenRouter
                'X-Title': 'Curator'
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    {
                        role: 'system',
                        content: systemPrompt || 'You are a helpful assistant that recommends items based on user preferences. Return ONLY JSON.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.7
            })
        })

        if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`LLM API Error: ${response.status} ${response.statusText} - ${errorText}`)
        }

        const data = await response.json()
        const content = data.choices[0].message.content
        return content
    } catch (error) {
        console.error('LLM Call Failed:', error)
        throw error
    }
}
