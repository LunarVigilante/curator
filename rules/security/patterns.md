---
description: Core security principles and patterns for the Curator project
globs: ["src/**/*.ts", "src/**/*.tsx"]
alwaysApply: true
---

# Core Security Patterns

Every developer is responsible for the security of the Curator application. This document outlines the fundamental principles that must be followed in all code contributions.

## Guiding Principles

1.  **Defense in Depth:** Employ multiple layers of security controls.
2.  **Principle of Least Privilege:** Grant only the permissions necessary for a user or service to perform its function.
3.  **Never Trust User Input:** All external data must be validated and sanitized.
4.  **Fail Securely:** Ensure that failure modes do not expose sensitive information.

## Key Security Practices

### 1. Authentication & Authorization

-   **Authentication** is handled by Supabase Auth. All routes are protected by default via Next.js middleware.
-   **Authorization** checks must be performed in Server Actions to ensure a user has the required permissions to perform an operation.

    ```typescript
    // Example in a Server Action
    import { createClient } from "@/lib/supabase/server";

    export async function deleteItem(itemId: string) {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return { success: false, error: "Unauthorized" };
      }

      // Further checks to ensure the user owns the item...
    }
    ```

### 2. Input Validation

-   Use `zod` to validate all incoming data in Server Actions. Refer to the `validation.md` rule for detailed patterns.

### 3. Output Encoding (XSS Prevention)

-   React and Next.js provide automatic protection against most Cross-Site Scripting (XSS) attacks by escaping content.
-   **NEVER** use `dangerouslySetInnerHTML` unless it is absolutely essential and the content has been sanitized by a trusted library like `DOMPurify`.

### 4. Dependency Management

-   Regularly audit dependencies for known vulnerabilities.
-   Run `npm audit --audit-level=high` and address any reported issues.

### 5. Secure Data Handling

-   Use parameterized queries (Supabase does this by default) to prevent SQL injection.
-   Do not expose sensitive user data to the client unless necessary.
