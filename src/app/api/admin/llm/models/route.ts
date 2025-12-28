import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

// Provider-specific model fetching logic
async function fetchModelsFromProvider(provider: string, apiKey: string): Promise<string[]> {
    switch (provider) {
        case 'openai':
            return await fetchOpenAIModels(apiKey);
        case 'anthropic':
            return await fetchAnthropicModels(apiKey);
        case 'gemini':
            return await fetchGeminiModels(apiKey);
        case 'ollama':
            return await fetchOllamaModels();
        case 'mistral':
            return await fetchMistralModels(apiKey);
        case 'anannas':
            return await fetchAnannasModels(apiKey);
        default:
            return [];
    }
}

async function fetchOpenAIModels(apiKey: string): Promise<string[]> {
    try {
        const res = await fetch('https://api.openai.com/v1/models', {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        if (!res.ok) throw new Error('Failed to fetch OpenAI models');
        const data = await res.json();
        // Filter to chat/completion models
        return data.data
            .filter((m: any) => m.id.includes('gpt') || m.id.includes('o1') || m.id.includes('o3'))
            .map((m: any) => m.id)
            .sort();
    } catch (e) {
        console.error('OpenAI fetch error:', e);
        return ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'];
    }
}

async function fetchAnthropicModels(apiKey: string): Promise<string[]> {
    // Anthropic doesn't have a public models endpoint, return known models
    return [
        'claude-3-5-sonnet-20241022',
        'claude-3-5-haiku-20241022',
        'claude-3-opus-20240229',
        'claude-3-sonnet-20240229',
        'claude-3-haiku-20240307'
    ];
}

async function fetchGeminiModels(apiKey: string): Promise<string[]> {
    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (!res.ok) throw new Error('Failed to fetch Gemini models');
        const data = await res.json();
        return data.models
            .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
            .map((m: any) => m.name.replace('models/', ''))
            .sort();
    } catch (e) {
        console.error('Gemini fetch error:', e);
        return ['gemini-2.0-flash-exp', 'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.0-pro'];
    }
}

async function fetchOllamaModels(): Promise<string[]> {
    try {
        // Ollama runs locally, try localhost
        const res = await fetch('http://localhost:11434/api/tags');
        if (!res.ok) throw new Error('Failed to fetch Ollama models');
        const data = await res.json();
        return data.models?.map((m: any) => m.name) || [];
    } catch (e) {
        console.error('Ollama fetch error:', e);
        return ['llama3.2', 'llama3.1', 'mistral', 'codellama', 'phi3'];
    }
}

async function fetchMistralModels(apiKey: string): Promise<string[]> {
    try {
        const res = await fetch('https://api.mistral.ai/v1/models', {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        if (!res.ok) throw new Error('Failed to fetch Mistral models');
        const data = await res.json();
        return data.data?.map((m: any) => m.id).sort() || [];
    } catch (e) {
        console.error('Mistral fetch error:', e);
        return ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest', 'open-mixtral-8x22b'];
    }
}

async function fetchAnannasModels(apiKey: string): Promise<string[]> {
    // Anannas AI - return known models
    return [
        'meta-llama/llama-3-70b-instruct',
        'meta-llama/llama-3-8b-instruct',
        'mistralai/mixtral-8x7b-instruct',
        'anthropic/claude-3-haiku'
    ];
}

export async function POST(req: NextRequest) {
    try {
        // Auth check
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session || (session.user as any).role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { provider, apiKey } = await req.json();

        if (!provider) {
            return NextResponse.json({ error: 'Provider is required' }, { status: 400 });
        }

        const models = await fetchModelsFromProvider(provider, apiKey || '');

        return NextResponse.json({ models });
    } catch (error) {
        console.error('Error fetching models:', error);
        return NextResponse.json({ error: 'Failed to fetch models' }, { status: 500 });
    }
}
