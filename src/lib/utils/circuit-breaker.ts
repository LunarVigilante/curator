/**
 * Circuit Breaker Pattern
 * 
 * Reusable state machine for handling external service failures.
 * Prevents cascading failures by temporarily blocking requests
 * after repeated failures.
 * 
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: After threshold failures, block requests for cooldown period
 * - PAUSED: Temporary pause from Retry-After header (no failure increment)
 * - (Implicit) HALF-OPEN: After cooldown, allow one request to test
 * 
 * Usage:
 * ```typescript
 * const circuit = new CircuitBreaker(5, 15 * 60 * 1000); // 5 failures, 15min cooldown
 * 
 * if (circuit.isOpen()) {
 *     console.log('Circuit open, skipping request');
 *     return fallbackValue;
 * }
 * 
 * try {
 *     const result = await externalApiCall();
 *     circuit.recordSuccess();
 *     return result;
 * } catch (error) {
 *     // Check for 429 with Retry-After
 *     if (error.status === 429 && error.retryAfter) {
 *         circuit.pause(error.retryAfter * 1000);  // Pause, don't fail
 *     } else {
 *         circuit.recordFailure();
 *     }
 *     throw error;
 * }
 * ```
 */

export class CircuitBreaker {
    private failureCount: number = 0;
    private openUntil: number = 0;
    private pausedUntil: number = 0;

    constructor(
        private readonly failureThreshold: number = 5,
        private readonly cooldownMs: number = 15 * 60 * 1000
    ) { }

    /**
     * Record a successful request (resets failure count)
     */
    recordSuccess(): void {
        this.failureCount = 0;
        this.openUntil = 0;
        this.pausedUntil = 0;
    }

    /**
     * Record a failed request (increments failure count, may open circuit)
     */
    recordFailure(): void {
        this.failureCount++;
        if (this.failureCount >= this.failureThreshold) {
            this.openUntil = Date.now() + this.cooldownMs;
            console.warn(
                `🔴 Circuit OPEN: ${this.failureCount} failures. ` +
                `Blocking for ${this.cooldownMs / 1000}s`
            );
        }
    }

    /**
     * Pause the circuit for a specific duration (from Retry-After header)
     * Does NOT increment failure count - this is a polite server request
     * 
     * @param durationMs - Duration to pause in milliseconds
     */
    pause(durationMs: number): void {
        const pauseUntil = Date.now() + durationMs;
        this.pausedUntil = Math.max(this.pausedUntil, pauseUntil);
        console.log(`⏸️ Circuit PAUSED: Retry-After ${durationMs / 1000}s`);
    }

    /**
     * Check if the circuit is currently open (blocking requests)
     */
    isOpen(): boolean {
        const now = Date.now();

        // Check pause first (Retry-After takes priority)
        if (this.pausedUntil > 0 && now < this.pausedUntil) {
            return true;
        } else if (this.pausedUntil > 0 && now >= this.pausedUntil) {
            this.pausedUntil = 0; // Clear expired pause
        }

        // Check failure-based open state
        if (this.openUntil === 0) return false;
        if (now > this.openUntil) {
            // Cooldown expired, move to half-open state
            console.log('🟡 Circuit HALF-OPEN: Cooldown expired, allowing test request');
            return false;
        }
        return true;
    }

    /**
     * Get remaining cooldown/pause time in milliseconds (0 if circuit closed)
     */
    getRemainingCooldown(): number {
        const now = Date.now();
        const pauseRemaining = this.pausedUntil > now ? this.pausedUntil - now : 0;
        const openRemaining = this.openUntil > now ? this.openUntil - now : 0;
        return Math.max(pauseRemaining, openRemaining);
    }

    /**
     * Check if currently paused (from Retry-After)
     */
    isPaused(): boolean {
        return this.pausedUntil > 0 && Date.now() < this.pausedUntil;
    }

    /**
     * Get current failure count
     */
    getFailureCount(): number {
        return this.failureCount;
    }

    /**
     * Reset the circuit breaker to closed state
     */
    reset(): void {
        this.failureCount = 0;
        this.openUntil = 0;
        this.pausedUntil = 0;
    }
}
