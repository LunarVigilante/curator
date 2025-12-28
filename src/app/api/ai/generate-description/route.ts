import { NextRequest, NextResponse } from 'next/server';
import { callLLM } from '@/lib/llm';
import { SystemConfigService } from '@/lib/services/SystemConfigService';

export async function POST(request: NextRequest) {
    try {
        const { title, type, context } = await request.json();

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
            } catch (e) {
                // Not JSON, use as-is
            }
        }

        console.log('Generated description:', description.substring(0, 100) + '...');
        return NextResponse.json({ description });

    } catch (e: any) {
        console.error("Generate Description Error:", e)
        const errorMessage = e.message || "Generation Failed"
        return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
}

