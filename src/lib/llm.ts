import { getSettings } from '@/lib/actions/settings'

export async function callLLM(prompt: string) {
    const settings = await getSettings()
    const apiKey = settings.llm_api_key
    const model = settings.llm_model || 'openai/gpt-4o'
    const endpoint = settings.llm_endpoint || 'https://openrouter.ai/api/v1'

    if (!apiKey) {
        throw new Error('LLM API Key is not configured. Please go to Settings to configure it.')
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
                        content: 'You are a helpful assistant that recommends items based on user preferences. Return ONLY JSON.'
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
