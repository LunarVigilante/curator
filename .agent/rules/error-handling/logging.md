---
description: Logging best practices for the Curator project, including structured logging recommendations
globs: ["src/**/*.ts", "src/**/*.tsx"]
alwaysApply: true
---

# Logging Strategy

A consistent logging strategy is essential for debugging and monitoring the health of the application.

## Recommended Service: Pino

Currently, the project relies on `console.log`. To improve our logging capabilities, we recommend adopting **Pino**, a high-performance, low-overhead structured logger for Node.js.

**Why Pino?**
-   **Structured JSON Logs:** Easy to parse, search, and filter.
-   **Performance:** One of the fastest loggers available.
-   **Ecosystem:** Integrates well with Next.js and external log management services.

## Best Practices

### 1. Use Appropriate Log Levels

-   **`fatal`**: The application is crashing.
-   **`error`**: A serious error occurred that needs investigation.
-   **`warn`**: Something unexpected happened, but the application can recover.
-   **`info`**: High-level information about the application's state.
-   **`debug`**: Detailed information for debugging.
-   **`trace`**: Very detailed information, only for deep debugging.

### 2. Provide Context

Always include relevant context in your logs. This will make it much easier to debug issues.

```typescript
// BAD
console.error("Failed to fetch user data");

// GOOD
import logger from "@/lib/logger"; // Assuming a shared logger instance

logger.error(
  {
    userId: "12345",
    error: "Failed to fetch user data",
  },
  "An error occurred in getUserData"
);
```

### 3. Don't Log Sensitive Information

Never log sensitive information like passwords, API keys, or personal user data. Use an allowlist approach to ensure you're only logging what's necessary.
