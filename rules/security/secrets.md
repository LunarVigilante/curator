---
description: Guidelines for managing secrets and environment variables in the Curator project
globs: [".env.example", ".env*.local"]
alwaysApply: true
---

# Secret Management

Proper management of secrets (API keys, database connection strings, etc.) is critical to the security of the application.

## Core Principles

1.  **Never Hard-Code Secrets:** Secrets must never be stored in the codebase.
2.  **Use Environment Variables:** All secrets must be loaded from environment variables.
3.  **Never Commit Secrets:** The `.gitignore` file is configured to prevent `.env` files from being committed.

## Environment Variables

The project uses the `.env.example` file as a template for the required environment variables.

-   **`.env.local`:** For local development. This file is not committed to version control.
-   **Production:** In a production environment (e.g., Vercel, Docker), these variables must be set securely.

### Accessing Secrets

Use the environment variables provided by the Next.js runtime.

```typescript
// Accessing in a Server Component or Server Action
const apiKey = process.env.MY_API_KEY;
```

## Recommended Tool: Secret Scanning

To prevent accidental commits of secrets, we recommend integrating a secret-scanning tool into our CI/CD pipeline.

-   **Recommendation:** **GitGuardian** or **TruffleHog**.
-   **Benefit:** These tools will automatically scan new commits and pull requests for any exposed secrets, providing an essential layer of protection.

## Best Practices

-   **Rotate Keys Regularly:** Change API keys and other credentials on a regular schedule.
-   **Use Vaults for Production:** For high-security environments, consider using a dedicated secret management service like HashiCorp Vault or AWS Secrets Manager.
