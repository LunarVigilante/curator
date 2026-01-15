---
description: Standardized error-handling patterns for the Curator project
globs: ["src/**/*.ts", "src/**/*.tsx"]
alwaysApply: true
---

# Error-Handling Patterns

A consistent approach to error handling is crucial for a robust and maintainable application. This guide outlines the standard patterns to be used in the Curator project.

## Server-Side (Next.js Server Actions)

### 1. Use `try...catch` Blocks

All server-side operations that can fail (e.g., database queries, API calls) should be wrapped in a `try...catch` block.

### 2. Return a Structured Error Response

Server Actions should not throw errors directly to the client. Instead, catch the error and return a structured response that indicates success or failure.

```typescript
// src/lib/actions/user.ts

export async function updateUser(formData: FormData) {
  try {
    // ... database logic ...
    return { success: true, data: updatedUser };
  } catch (error) {
    logger.error({ error }, "Failed to update user");
    return { success: false, error: "An unexpected error occurred." };
  }
}
```

### 3. Use `zod` for Validation

Use `zod` to validate incoming data. This is the first line of defense against invalid input.

```typescript
import { z } from "zod";

const UpdateUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
});

export async function updateUser(formData: FormData) {
  const result = UpdateUserSchema.safeParse(Object.fromEntries(formData));

  if (!result.success) {
    return { success: false, error: "Invalid input." };
  }

  // ... proceed with valid data ...
}
```

## Client-Side (React Components)

### 1. Check the Response from Server Actions

When calling a Server Action, always check the `success` flag in the response to determine if the operation was successful.

### 2. Use `sonner` for User Feedback

Use the `sonner` library to provide non-blocking feedback to the user.

```tsx
// src/components/UpdateUserForm.tsx
import { toast } from "sonner";
import { updateUser } from "@/lib/actions/user";

async function handleSubmit(formData: FormData) {
  const result = await updateUser(formData);

  if (result.success) {
    toast.success("User updated successfully!");
  } else {
    toast.error(result.error);
  }
}
```
