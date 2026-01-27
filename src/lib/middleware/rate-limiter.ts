/**
 * Rate Limiter using Upstash Redis
 * 
 * Provides rate limiting for API endpoints using the sliding window algorithm.
 * Different limits apply based on authentication status and endpoint type.
 */

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Initialize Redis client (lazy - only when env vars are present)
let redis: Redis | null = null
function getRedis(): Redis | null {
    if (redis) return redis

    const url = process.env.UPSTASH_REDIS_REST_URL
    const token = process.env.UPSTASH_REDIS_REST_TOKEN

    if (!url || !token) {
        console.warn('[RateLimiter] Upstash Redis not configured - rate limiting disabled')
        return null
    }

    redis = new Redis({ url, token })
    return redis
}

// Rate limit configurations
export const RATE_LIMITS = {
    // Standard authenticated user limits
    authenticated: {
        requests: 60,
        window: '1 m' as const,
    },
    // Anonymous/public route limits
    anonymous: {
        requests: 10,
        window: '1 m' as const,
    },
    // AI endpoints (resource-intensive)
    ai: {
        requests: 10,
        window: '1 m' as const,
    },
} as const

export type RateLimitType = keyof typeof RATE_LIMITS

// Create rate limiters (lazy initialization)
const limiters = new Map<RateLimitType, Ratelimit>()

function getLimiter(type: RateLimitType): Ratelimit | null {
    const redis = getRedis()
    if (!redis) return null

    if (!limiters.has(type)) {
        const config = RATE_LIMITS[type]
        limiters.set(type, new Ratelimit({
            redis,
            limiter: Ratelimit.slidingWindow(config.requests, config.window),
            analytics: true,
            prefix: `curator:ratelimit:${type}`,
        }))
    }

    return limiters.get(type)!
}

/**
 * Get client identifier from request
 * Uses user ID if authenticated, otherwise IP address
 */
export function getClientIdentifier(request: NextRequest, userId?: string | null): string {
    if (userId) {
        return `user:${userId}`
    }

    // Try to get real IP from headers (Vercel/proxy)
    const forwardedFor = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    const ip = forwardedFor?.split(',')[0]?.trim() || realIp || 'unknown'

    return `ip:${ip}`
}

export interface RateLimitResult {
    success: boolean
    limit: number
    remaining: number
    reset: number
}

/**
 * Check rate limit for a client
 */
export async function checkRateLimit(
    identifier: string,
    type: RateLimitType = 'authenticated'
): Promise<RateLimitResult> {
    const limiter = getLimiter(type)

    // If rate limiting is not configured, allow all requests
    if (!limiter) {
        return { success: true, limit: 999, remaining: 999, reset: 0 }
    }

    const result = await limiter.limit(identifier)

    return {
        success: result.success,
        limit: result.limit,
        remaining: result.remaining,
        reset: result.reset,
    }
}

/**
 * Create a rate limit error response with proper headers
 */
export function rateLimitResponse(result: RateLimitResult): NextResponse {
    return NextResponse.json(
        {
            error: 'Too many requests. Please try again later.',
            code: 'RATE_LIMITED',
        },
        {
            status: 429,
            headers: {
                'X-RateLimit-Limit': result.limit.toString(),
                'X-RateLimit-Remaining': result.remaining.toString(),
                'X-RateLimit-Reset': result.reset.toString(),
                'Retry-After': Math.ceil((result.reset - Date.now()) / 1000).toString(),
            },
        }
    )
}
