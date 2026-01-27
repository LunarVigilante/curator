/**
 * Request Logger using Axiom
 * 
 * Logs structured metadata for every API request to help detect
 * suspicious patterns, performance issues, and usage spikes.
 */

import { log } from 'next-axiom'
import type { NextRequest } from 'next/server'

export interface RequestLogData {
    endpoint: string
    method: string
    statusCode: number
    responseTimeMs: number
    userId: string | null
    ip: string
    userAgent: string | null
    contentLength: number | null
}

/**
 * Extract client IP from request headers
 */
function getClientIp(request: NextRequest): string {
    const forwardedFor = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    return forwardedFor?.split(',')[0]?.trim() || realIp || 'unknown'
}

/**
 * Log API request metadata to Axiom
 */
export function logRequest(
    request: NextRequest,
    statusCode: number,
    startTime: number,
    userId: string | null = null
): void {
    const responseTimeMs = Date.now() - startTime
    const contentLength = request.headers.get('content-length')

    const logData: RequestLogData = {
        endpoint: new URL(request.url).pathname,
        method: request.method,
        statusCode,
        responseTimeMs,
        userId,
        ip: getClientIp(request),
        userAgent: request.headers.get('user-agent'),
        contentLength: contentLength ? parseInt(contentLength, 10) : null,
    }

    // Use appropriate log level based on status
    if (statusCode >= 500) {
        log.error('API Request', logData)
    } else if (statusCode >= 400) {
        log.warn('API Request', logData)
    } else {
        log.info('API Request', logData)
    }
}

/**
 * Create a request timer for measuring response time
 */
export function startRequestTimer(): number {
    return Date.now()
}
