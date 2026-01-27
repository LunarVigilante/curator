import { NextRequest, NextResponse } from 'next/server';
import { callLLM } from '@/lib/llm';
import { SystemConfigService } from '@/lib/services/SystemConfigService';
import { withAiApi, internalError, validationError } from '@/lib/middleware';
import { parseRequestBody, generateTagsSchema } from '@/lib/validation/api-schemas';
import { log } from 'next-axiom';

export const POST = withAiApi(async (request: NextRequest) => {
    log.info('[GenerateTags] Starting tag generation...');

    // Validate request body with Zod schema
    const validation = await parseRequestBody(request, generateTagsSchema);
    if (!validation.success) {
        return validationError(validation.error);
    }

    const { title, type, description } = validation.data;

    log.info('[GenerateTags] Request validated', { title, type, hasDescription: !!description });

    // Fetch LLM config from database
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

    if (!finalApiKey) {
        log.error('[GenerateTags] No LLM API Key configured');
        return internalError('LLM API Key not configured in System Settings');
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

    try {
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

        log.info('[GenerateTags] Generated tags', { count: tags.length, tags });
        return NextResponse.json({ tags });

    } catch (e: unknown) {
        const error = e instanceof Error ? e : new Error(String(e));
        log.error('[GenerateTags] LLM call failed', { error: error.message });
        return internalError('Tag generation failed', error);
    }
});
