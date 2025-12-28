import { NextRequest, NextResponse } from 'next/server';
import { callLLM } from '@/lib/llm';
import { SystemConfigService } from '@/lib/services/SystemConfigService';

export async function POST(request: NextRequest) {
    try {
        const { title, type, description } = await request.json();

        if (!title || !type) {
            return NextResponse.json(
                { error: 'title and type are required' },
                { status: 400 }
            );
        }

        // Fetch LLM config from database
        const provider = await SystemConfigService.getDecryptedConfig('llm_provider') || 'openrouter';
        const apiKey = await SystemConfigService.getDecryptedConfig('llm_api_key');
        const endpoint = await SystemConfigService.getDecryptedConfig('llm_endpoint');
        const model = await SystemConfigService.getDecryptedConfig('llm_model');

        const anannasKey = await SystemConfigService.getDecryptedConfig('anannas_api_key');
        const openaiKey = await SystemConfigService.getDecryptedConfig('openai_api_key');
        const finalApiKey = apiKey || anannasKey || openaiKey;

        if (!finalApiKey) {
            return NextResponse.json(
                { error: 'LLM API Key not configured in System Settings' },
                { status: 500 }
            );
        }

        const systemPrompt = `You are an expert curator. Generate 5-8 relevant tags for the given item.

TAG RULES:
- Generate 5-8 tags
- Include: Genre, Mood, Theme, Era/Period
- Be specific and useful for discovery
- Each tag should be 1-3 words

Return ONLY a comma-separated list of tags. No JSON, no quotes, no markdown.
Example: Action, Sci-Fi, Dark Atmosphere, 1990s, Cyberpunk, Neo-Noir`;

        const userPrompt = `Generate tags for:
Title: ${title}
Type: ${type}
${description ? `Description: ${description}` : ''}`;

        const response = await callLLM({
            userPrompt,
            systemPrompt,
            apiKey: finalApiKey,
            provider,
            model: model || undefined,
            endpoint: endpoint || undefined
        });

        // Parse comma-separated tags
        const tags = response
            .split(',')
            .map(tag => tag.trim())
            .filter(tag => tag.length > 0 && tag.length < 50)
            .slice(0, 8);

        console.log('Generated tags:', tags);
        return NextResponse.json({ tags });

    } catch (e: any) {
        console.error("Generate Tags Error:", e)
        const errorMessage = e.message || "Generation Failed"
        return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
}

