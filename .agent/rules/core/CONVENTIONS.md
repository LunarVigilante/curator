# Curator Coding Conventions

## Naming Conventions

### Database
- **Tables & Columns**: Use `snake_case` (e.g., `user_id`, `created_at`, `global_items`).
- **Foreign Keys**: Suffix with `_id` (e.g., `category_id`).

### TypeScript / Application Code
- **Variables & Functions**: Use `camelCase` (e.g., `getGuestUserId`, `updateItem`).
- **types & Interfaces**: Use `PascalCase` (e.g., `GlobalItem`, `UserProfile`).
- **Files**:
    - **Components**: `PascalCase` (e.g., `ItemDetailView.tsx`).
    - **Utilities/Actions**: `camelCase` (e.g., `auth.ts`, `transformItem.ts`).

## Authentication Patterns

### `getGuestUserId()`
- Use for actions that support **mixed** authentication states (both logged-in users and anonymous guests).
- Returns `string` (user ID) or `undefined`.
- **Do not** use for admin or sensitive data access.

### `getSession()`
- Use for actions requiring **full authentication**.
- Returns `Session` object with `user` and `profile`.
- Use for admin routes, social features, and account settings.

## Error Handling
- Use `handleSupabaseError` from `@/lib/utils/errorHandler` to wrap Supabase calls.
- Throw `AppError` for custom logic errors (e.g., `403 Unauthorized`).
- Avoid raw `throw error` in actions.

## Type Safety
- **Avoid `as any`**.
- Use generated Database types in `src/lib/types/database.ts`.
- Use `createTypedQuery` from `@/lib/supabase/queries.ts` for strictly typed Supabase queries.
