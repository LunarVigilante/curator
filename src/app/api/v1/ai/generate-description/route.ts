import { NextRequest, NextResponse } from 'next/server';
import { callLLM, cleanLLMResponse } from '@/lib/llm';
import { SystemConfigService } from '@/lib/services/SystemConfigService';
import { withAiApi, internalError, validationError } from '@/lib/middleware';
import { parseRequestBody, generateDescriptionSchema } from '@/lib/validation/api-schemas';
import { log } from 'next-axiom';

export const POST = withAiApi(async (request: NextRequest) => {
    // Validate request body with Zod schema
    const validation = await parseRequestBody(request, generateDescriptionSchema);
    if (!validation.success) {
        return validationError(validation.error);
    }

    const { title, type, context } = validation.data;

    // Fetch LLM config from database
    const provider = await SystemConfigService.getDecryptedConfig('llm_provider') || 'openrouter';
    const apiKey = await SystemConfigService.getDecryptedConfig('llm_api_key');
    const endpoint = await SystemConfigService.getDecryptedConfig('llm_endpoint');
    const model = await SystemConfigService.getDecryptedConfig('llm_model');

    const anannasKey = await SystemConfigService.getDecryptedConfig('anannas_api_key');
    const openaiKey = await SystemConfigService.getDecryptedConfig('openai_api_key');
    const finalApiKey = apiKey || anannasKey || openaiKey;

    if (!finalApiKey) {
        return internalError('LLM API Key not configured in System Settings');
    }

    const systemPrompt = `You are an expert curator and critic. Generate a compelling description for the given item.

DESCRIPTION FORMAT:
1. Body: Maximum 50 words. Focus on plot summary first, then the vibe/atmosphere.
2. Footer: After the body, append exactly this format on a new line after a double newline:

Year: YYYY | Creator: [Name] | Notable Awards: [Awards or "None"]

Return ONLY the description text. No JSON, no markdown, no quotes.`;

    const userPrompt = `Generate a description for:
Title: ${title}
Type: ${type}
${context ? `Additional Context: ${context}` : ''}`;

    try {
        const response = await callLLM({
            userPrompt,
            systemPrompt,
            apiKey: finalApiKey,
            provider,
            model: model || undefined,
            endpoint: endpoint || undefined
        });

        // Clean up the response
        let description = response.trim();

        // Remove any accidental JSON wrapping
        if (description.startsWith('{') || description.startsWith('"')) {
            try {
                const parsed = JSON.parse(description);
                description = typeof parsed === 'string' ? parsed : parsed.description || description;
            } catch {
                // Not JSON, use cleaned response
                description = cleanLLMResponse(description);
            }
        }

        log.info('[GenerateDescription] Generated', { title, length: description.length });
        return NextResponse.json({ description });

    } catch (e: unknown) {
        const error = e instanceof Error ? e : new Error(String(e));
        log.error('[GenerateDescription] Failed', { error: error.message });
        return internalError('Description generation failed', error);
    }
});
