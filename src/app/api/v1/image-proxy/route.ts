import { NextRequest, NextResponse } from 'next/server';
import { isSafeUrl } from '@/lib/security';
import { withPublicApi, badRequest, internalError } from '@/lib/middleware';
import { log } from 'next-axiom';

/**
 * Image Proxy API
 * 
 * Fetches external images and serves them through our server to avoid CORS issues.
 * Usage: /api/v1/image-proxy?url=<encoded-image-url>
 * 
 * This is a PUBLIC route with anonymous rate limiting (10/min).
 */
export const GET = withPublicApi(async (request: NextRequest) => {
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get('url');

    if (!imageUrl) {
        return badRequest('Missing url parameter');
    }

    if (!isSafeUrl(imageUrl)) {
        log.warn('[ImageProxy] Blocked unsafe URL', { url: imageUrl.substring(0, 100) });
        return badRequest('Invalid or restricted URL');
    }

    try {
        const response = await fetch(imageUrl, {
            headers: {
                'User-Agent': 'Curator/1.0',
                'Accept': 'image/*'
            },
            redirect: 'error', // Prevent SSRF via redirects
        });

        if (!response.ok) {
            return NextResponse.json(
                { error: `Failed to fetch image: ${response.statusText}` },
                { status: response.status }
            );
        }

        const contentType = response.headers.get('content-type') || 'image/jpeg';
        const arrayBuffer = await response.arrayBuffer();

        return new NextResponse(arrayBuffer, {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
            }
        });
    } catch (error) {
        log.error('[ImageProxy] Fetch failed', { error: String(error) });
        return internalError('Failed to fetch image');
    }
});
