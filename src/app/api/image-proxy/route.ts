import { NextRequest, NextResponse } from 'next/server';

/**
 * Image Proxy API
 * 
 * Fetches external images and serves them through our server to avoid CORS issues.
 * Usage: /api/image-proxy?url=<encoded-image-url>
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get('url');

    if (!imageUrl) {
        return NextResponse.json(
            { error: 'Missing url parameter' },
            { status: 400 }
        );
    }

    try {
        const response = await fetch(imageUrl, {
            headers: {
                'User-Agent': 'Curator/1.0',
                'Accept': 'image/*'
            }
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
        console.error('Image proxy error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch image' },
            { status: 500 }
        );
    }
}
