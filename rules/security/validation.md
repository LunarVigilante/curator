---
description: Input validation best practices using zod for the Curator project
globs: ["src/lib/actions/**/*.ts", "src/app/api/**/*.ts"]
alwaysApply: true
---

# Input Validation with Zod

Input validation is our primary defense against a wide range of security vulnerabilities, including injection attacks, Cross-Site Scripting (XSS), and data corruption. We use the `zod` library as our standard for all data validation.

## Golden Rule: Validate on the Server

All data submitted from the client **must** be re-validated on the server, even if it has already been validated on the client.

## Using `zod` in Server Actions

Server Actions are the primary entry point for data mutations. Use `zod` to define a schema and validate the incoming `FormData`.

### Example

```typescript
// src/lib/actions/item.ts
import { z } from "zod";
import { zfd } from "zod-form-data";

const CreateItemSchema = zfd.formData({
  name: z.string().min(3, "Name must be at least 3 characters"),
  description: z.string().optional(),
  rating: z.coerce.number().int().min(1).max(10),
});

export async function createItem(formData: FormData) {
  const result = CreateItemSchema.safeParse(formData);

  if (!result.success) {
    // You can format the errors for the client here
    const errorMessages = result.error.flatten().fieldErrors;
    return { success: false, errors: errorMessages };
  }

  // The `result.data` is now fully typed and validated
  const { name, description, rating } = result.data;

  // ... proceed with database operations ...
}
```

## Best Practices

1.  **Be Specific:** Define your schemas as precisely as possible. Use `.min()`, `.max()`, `.email()`, etc., to enforce strict constraints.
2.  **Use `safeParse`:** Always use `safeParse` instead of `parse`. This allows you to handle validation errors gracefully without throwing an exception.
3.  **Coerce Types:** For `FormData`, values often come in as strings. Use `z.coerce.number()`, `z.coerce.date()`, etc., to convert them to the correct types during validation.
4.  **Don't Pass Validation Errors to Logs:** Validation errors are expected user behavior, not system errors. Return them to the client with a `400 Bad Request` status, but avoid cluttering your error logs with them.
