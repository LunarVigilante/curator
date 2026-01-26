import { NextRequest, NextResponse } from 'next/server';
import { callLLM } from '@/lib/llm';
import { SystemConfigService } from '@/lib/services/SystemConfigService';

export async function POST(request: NextRequest) {
    console.log('[GenerateTags] Starting tag generation...');

    try {
        const body = await request.json();
        const { title, type, description } = body;

        console.log(`[GenerateTags] Request: title="${title}", type="${type}", description=${description ? `"${description.slice(0, 100)}..."` : 'null'}`);

        if (!title || !type) {
            console.error('[GenerateTags] Missing required fields: title or type');
            return NextResponse.json(
                { error: 'title and type are required' },
                { status: 400 }
            );
        }

        // Fetch LLM config from database
        console.log('[GenerateTags] Fetching LLM config from SystemConfigService...');
        const provider = await SystemConfigService.getDecryptedConfig('llm_provider') || 'openrouter';
        const apiKey = await SystemConfigService.getDecryptedConfig('llm_api_key');
        const endpoint = await SystemConfigService.getDecryptedConfig('llm_endpoint');
        const model = await SystemConfigService.getDecryptedConfig('llm_model');

        // Check all possible API key locations based on provider
        const anannasKey = await SystemConfigService.getDecryptedConfig('anannas_api_key');
        const openaiKey = await SystemConfigService.getDecryptedConfig('openai_api_key');
        const openrouterKey = await SystemConfigService.getDecryptedConfig('openrouter_api_key');
        const anthropicKey = await SystemConfigService.getDecryptedConfig('anthropic_api_key');
        const googleKey = await SystemConfigService.getDecryptedConfig('google_ai_api_key');

        const finalApiKey = apiKey || openrouterKey || anannasKey || openaiKey || anthropicKey || googleKey;

        console.log(`[GenerateTags] LLM Config: provider="${provider}", model="${model || 'default'}", endpoint="${endpoint || 'default'}", hasApiKey=${!!finalApiKey}`);

        if (!finalApiKey) {
            console.error('[GenerateTags] ❌ No LLM API Key configured');
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

        console.log('[GenerateTags] Calling LLM...');
        const response = await callLLM({
            userPrompt,
            systemPrompt,
            apiKey: finalApiKey,
            provider,
            model: model || undefined,
            endpoint: endpoint || undefined
        });

        console.log(`[GenerateTags] LLM response received: "${response.slice(0, 200)}..."`);

        // Parse comma-separated tags
        const tags = response
            .split(',')
            .map(tag => tag.trim())
            .filter(tag => tag.length > 0 && tag.length < 50)
            .slice(0, 8);

        console.log(`[GenerateTags] ✅ Generated ${tags.length} tags:`, tags);
        return NextResponse.json({ tags });

    } catch (e: any) {
        console.error('[GenerateTags] ❌ Error:', e);
        console.error('[GenerateTags] Error stack:', e.stack);
        console.error('[GenerateTags] Error name:', e.name);
        console.error('[GenerateTags] Error message:', e.message);
        const errorMessage = e.message || "Generation Failed"
        return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
}
