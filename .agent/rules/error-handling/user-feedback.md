---
description: Guidelines for providing user-facing error messages in the Curator project
globs: ["src/components/**/*.tsx", "src/app/**/*.tsx"]
alwaysApply: true
---

# User-Facing Error Messages

Clear and helpful error messages are crucial for a good user experience. This guide outlines the best practices for providing user feedback in the Curator project.

## Use `sonner` for Notifications

We use the `sonner` library to display non-blocking "toast" notifications. This is the standard way to communicate success, errors, and warnings to the user.

### Installation

The `sonner` library is already installed. To use it, import the `toast` function and ensure the `<Toaster />` component is included in your root layout.

### Usage

```tsx
import { toast } from "sonner";

// ...

// Success
toast.success("Your changes have been saved.");

// Error
toast.error("Failed to save changes. Please try again.");

// Warning
toast.warning("Your session is about to expire.");
```

## Best Practices

1.  **Be Clear and Concise:** Avoid technical jargon. Explain what went wrong in plain language.
    -   ✅ **GOOD:** "Failed to upload image. Please select a valid file type (JPG, PNG)."
    -   ❌ **BAD:** "Error: Invalid MIME type."
2.  **Suggest a Solution:** Whenever possible, tell the user how to fix the problem.
3.  **Use the Right Tone:** Be helpful and reassuring, not alarming.
4.  **Be Consistent:** Use the same wording and style for similar types of errors throughout the application.
