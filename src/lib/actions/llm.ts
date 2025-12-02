'use server'

export async function getModels(apiKey: string, endpoint: string) {
    if (!apiKey) return []

    // Normalize endpoint: remove /chat/completions if present to get base URL for models
    // OpenRouter: https://openrouter.ai/api/v1/models
    // OpenAI: https://api.openai.com/v1/models

    let baseUrl = endpoint
    if (baseUrl.endsWith('/chat/completions')) {
        baseUrl = baseUrl.replace('/chat/completions', '')
    }
    // Remove trailing slash
    baseUrl = baseUrl.replace(/\/$/, '')

    const modelsUrl = `${baseUrl}/models`

    try {
        const response = await fetch(modelsUrl, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        })

        if (!response.ok) {
            console.error('Failed to fetch models:', await response.text())
            return []
        }

        const data = await response.json()
        return data.data || [] // OpenAI/OpenRouter return { data: [...] }
    } catch (error) {
        console.error('Error fetching models:', error)
        return []
    }
}
