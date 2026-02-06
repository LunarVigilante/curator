/**
 * Concurrency Utilities
 * 
 * Rate limiting and concurrency control for async operations
 */

/**
 * Sleep for specified milliseconds
 */
export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Simple concurrency limiter (p-limit style)
 * 
 * @param concurrency - Maximum concurrent operations
 * @returns Limiter function that queues operations
 */
export function createLimiter(concurrency: number) {
    let active = 0;
    const queue: (() => void)[] = [];

    return async <T>(fn: () => Promise<T>): Promise<T> => {
        while (active >= concurrency) {
            await new Promise<void>(resolve => queue.push(resolve));
        }
        active++;
        try {
            return await fn();
        } finally {
            active--;
            const next = queue.shift();
            if (next) next();
        }
    };
}

// Global limiter for AI rewrites (5 concurrent)
export const aiLimiter = createLimiter(5);
