import { NextRequest, NextResponse } from 'next/server';
import { callLLM, cleanLLMResponse } from '@/lib/llm';
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

        // Legacy fallback keys
        const anannasKey = await SystemConfigService.getDecryptedConfig('anannas_api_key');
        const openaiKey = await SystemConfigService.getDecryptedConfig('openai_api_key');

        const finalApiKey = apiKey || anannasKey || openaiKey;

        if (!finalApiKey) {
            return NextResponse.json(
                { error: 'LLM API Key not configured in System Settings' },
                { status: 500 }
            );
        }

        const systemPrompt = `You are an expert curator and critic. Generate a description and tags for the given item.

OUTPUT FORMAT (strict JSON):
{
  "description": "string",
  "tags": ["string", "string", ...]
}

DESCRIPTION RULES:
1. Body: Maximum 50 words. Focus on plot summary first, then the vibe/atmosphere.
2. Footer: After the body, append exactly this format on a new line after a double newline:
   \\n\\nYear: YYYY | Creator: [Name] | Notable Awards: [Awards or "None"]

TAG RULES:
- Generate 5-8 relevant tags
- Include: Genre, Mood, Theme, Era/Period
- Be specific and useful for discovery

Return ONLY valid JSON. No markdown, no code blocks.`;

        const userPrompt = `Generate description and tags for:
Title: ${title}
Type: ${type}
${context ? `Additional Context: ${context}` : ''}`;

        // Call LLM with explicit config
        const response = await callLLM({
            userPrompt,
            systemPrompt,
            apiKey: finalApiKey,
            provider,
            model: model || undefined,
            endpoint: endpoint || undefined
        });

        // Parse the JSON response
        let result: { description: string; tags: string[] };

        try {
            // Try to extract JSON from potential code blocks
            let jsonString = response;

            // Remove markdown code blocks if present
            const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            if (jsonMatch) {
                jsonString = jsonMatch[1];
            }

            // Find JSON object
            const startIdx = jsonString.indexOf('{');
            const endIdx = jsonString.lastIndexOf('}');
            if (startIdx !== -1 && endIdx !== -1) {
                jsonString = jsonString.substring(startIdx, endIdx + 1);
            }

            result = JSON.parse(jsonString);
            console.log('Parsed LLM result:', JSON.stringify(result, null, 2));
        } catch (parseError) {
            console.error('Failed to parse LLM response as JSON:', response);
            // Fallback: try to extract what we can
            result = {
                description: cleanLLMResponse(response),
                tags: []
            };
        }

        // Validate and sanitize
        if (!result.description || typeof result.description !== 'string') {
            result.description = '';
        }

        if (!Array.isArray(result.tags)) {
            console.warn('Tags was not an array, got:', typeof result.tags, result.tags);
            result.tags = [];
        }

        // Ensure tags are strings and limit to 8
        result.tags = result.tags
            .filter((tag): tag is string => typeof tag === 'string')
            .slice(0, 8);

        console.log('Final API response - tags count:', result.tags.length, 'tags:', result.tags);
        return NextResponse.json(result);
    } catch (error) {
        console.error('Generate details error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to generate details';
        return NextResponse.json(
            { error: errorMessage },
            { status: 500 }
        );
    }
}
