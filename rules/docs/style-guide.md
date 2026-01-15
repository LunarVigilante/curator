---
description: Code style guidelines for the Curator project
globs: ["src/**/*.ts", "src/**/*.tsx"]
alwaysApply: true
---

# Curator Style Guide

This document outlines the official coding style guide for the Curator project. All contributions should adhere to these standards to maintain consistency and readability.

## General Principles

1.  **Clarity over cleverness:** Write code that is easy to understand.
2.  **Consistency:** Adhere to the established patterns in the codebase.
3.  **Simplicity:** Prefer simple solutions over complex ones.

## File and Directory Structure

-   **Components:** `src/components/`
    -   Reusable UI elements: `src/components/ui/`
    -   Feature-specific components: `src/components/feature-name/`
-   **Server Actions:** `src/lib/actions/`
-   **Services:** `src/lib/services/`
-   **Hooks:** `src/lib/hooks/`
-   **Types:** Define types close to where they are used. For shared types, use `src/lib/types.ts`.

## Naming Conventions

-   **Components:** `PascalCase` (e.g., `ItemCard.tsx`)
-   **Variables and Functions:** `camelCase` (e.g., `getUserStats`)
-   **Types and Interfaces:** `PascalCase` (e.g., `type UserProfile`)
-   **Constants:** `UPPER_SNAKE_CASE` (e.g., `const MAX_ITEMS = 100`)

## Component Best Practices

-   **Props:** Use interfaces for component props (e.g., `interface ItemCardProps`).
-   **State Management:** Use `useState` for simple component state. For complex or shared state, use `useContext` or a dedicated state management library.
-   **Styling:** Use Tailwind CSS utility classes. Avoid inline styles.
-   **Server Components:** Use Server Components by default. Only use Client Components (`"use client"`) when necessary (e.g., for hooks and event handlers).

## TypeScript

-   **Strict Mode:** The project uses strict mode. Avoid `any` whenever possible.
-   **Type Inference:** Prefer type inference over explicit type declarations when the type is obvious.
-   **Enums:** Use string enums over number enums.

## Linting and Formatting

The project uses ESLint and Prettier to enforce code style. Run `npm run lint` to check for issues.
