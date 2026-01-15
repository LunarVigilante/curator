---
description: Guidelines for integrating Sentry for error tracking in the Curator project
globs: ["sentry.client.config.ts", "sentry.server.config.ts", "sentry.edge.config.ts"]
alwaysApply: true
---

# Error Tracking with Sentry

To ensure the stability and reliability of our application in production, we need a robust error-tracking system. We recommend **Sentry** for this purpose.

## Why Sentry?

-   **Excellent Next.js Support:** Sentry provides a dedicated SDK for Next.js that is easy to install and configure.
-   **Source Map Support:** Automatically de-obfuscates minified production code, making it easier to debug errors.
-   **Performance Monitoring:** Helps identify and diagnose performance bottlenecks.
-   **Release Health:** Tracks the stability of new releases.

## Implementation Guide

1.  **Install the Sentry Next.js SDK:**
    ```bash
    npm install --save @sentry/nextjs
    ```

2.  **Run the Sentry Wizard:**
    The wizard will automatically create the necessary configuration files.
    ```bash
    npx @sentry/wizard@latest -i nextjs
    ```

3.  **Capture Errors:**
    Sentry will automatically capture unhandled exceptions. For handled exceptions, you can manually capture them.

    ```typescript
    import * as Sentry from "@sentry/nextjs";

    try {
      // ... some operation that might fail ...
    } catch (error) {
      Sentry.captureException(error);
      return { success: false, error: "An unexpected error occurred." };
    }
    ```

## Best Practices

-   **Use Environments:** Configure different environments (e.g., `development`, `production`) to separate error reports.
-   **Set User Context:** Associate errors with the logged-in user to make debugging easier.
    ```typescript
    Sentry.setUser({ id: user.id, email: user.email });
    ```
-   **Don't Log Sensitive Data:** Configure Sentry to scrub sensitive data from error reports.
