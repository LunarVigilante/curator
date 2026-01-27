/**
 * API Middleware Exports
 * 
 * Re-exports all middleware utilities for convenient imports.
 */

// Main middleware wrapper
export {
    withApiMiddleware,
    withPublicApi,
    withAdminApi,
    withAiApi,
    type ApiMiddlewareOptions,
    type ApiContext,
} from './api-middleware'

// Rate limiting
export {
    checkRateLimit,
    getClientIdentifier,
    rateLimitResponse,
    RATE_LIMITS,
    type RateLimitType,
    type RateLimitResult,
} from './rate-limiter'

// Error handling
export {
    apiError,
    badRequest,
    unauthorized,
    forbidden,
    notFound,
    validationError,
    internalError,
    generateRequestId,
    API_ERROR_CODES,
    type ApiErrorCode,
} from './api-errors'

// Request logging
export {
    logRequest,
    startRequestTimer,
    type RequestLogData,
} from './request-logger'
