---
description: Tech stack, dependencies, project structure, and development tools for Curator
globs: package.json,next.config.ts,tsconfig.json,docker-compose.yml,Dockerfile,.env.example
alwaysApply: false
---
# Tech Stack & Dependencies

## Core Runtime

**Node.js:** `>=24.0.0` • **Framework:** `Next.js 14` • **UI Library:** `React 19` • **Package Manager:** `npm`

## Key Configuration Files

- **`package.json`** - Central config (deps, scripts)
- **`next.config.ts`** - Next.js configuration
- **`tsconfig.json`** - TypeScript configuration
- **`docker-compose.yml`** - Docker services
- **`Dockerfile`** - Multi-stage Docker build
- **`.env.example`** - Environment variable template
- **`eslint.config.mjs`** - ESLint configuration
- **`postcss.config.mjs`** - PostCSS configuration

## Dependencies by Group

**Core Runtime:**

- `next`, `react`, `react-dom` (Core framework)
- `@supabase/ssr`, `@supabase/supabase-js` (Supabase integration)
- `@dnd-kit/core`, `@dnd-kit/sortable` (Drag and drop)
- `lucide-react` (Icons)
- `framer-motion` (Animations)
- `zod`, `zod-form-data` (Data validation)
- `cheerio`, `xml2js` (Data scraping)
- `recharts` (Charting)
- `resend`, `@react-email/components` (Email)
- `posthog-js` (Analytics)
- `tailwindcss`, `tailwind-merge`, `clsx` (Styling)

**Development:**

- `typescript`, `@types/node`, `@types/react` (TypeScript)
- `eslint`, `eslint-config-next` (Linting)
- `@faker-js/faker` (Data generation)

See `package.json` for a more full and up to date list of dependencies.

## Database Stack

**Database:** Supabase (PostgreSQL 15+)
**Auth:** Supabase Auth (SSR w/ Middleware Protection)
**Schema:** `supabase/schema.sql`

## Development Tools

**Code Quality:**

- `eslint` - Linting
- `typescript` - Strict type checking

**Styling:**

- `tailwindcss` - Utility-first CSS framework
- `framer-motion` - Animations
- `lucide-react` - Icons

## CLI Scripts System

All scripts use `npm` and are defined in `package.json`:

```bash
# Core commands
npm run dev                  # Start development server
npm run build                # Build for production
npm run start                # Start production server
npm run lint                 # Run linter
npm run typecheck            # Run TypeScript type checker

# Data scripts
npm run backfill:embeddings  # Backfill embeddings
npm run seed:content         # Seed content
npm run deep-import:tmdb     # Import from TMDB
npm run harvest:all          # Harvest all sources
```

## Project Structure

```text
curator/
├── src/
│   ├── app/                # Next.js 14 App Router pages & layouts
│   ├── components/         # Reusable React components (UI, features)
│   ├── lib/
│   │   ├── actions/        # Server Actions (Mutations)
│   │   ├── services/       # Core Business Logic (Tournaments, Stats, Media)
│   │   ├── supabase/       # Supabase SSR client setup
│   │   └── hooks/          # Custom React hooks
│   └── middleware.ts       # Route protection & Session management
├── supabase/               # SQL Schema & Migrations
└── public/                 # Static assets
```

## Development Workflow

✅ **GOOD:** Use project scripts

```bash
# Setup
npm install                       # Install all dependencies
cp .env.example .env              # Configure environment

# Development
npm run dev                       # Start development server
```

❌ **BAD:** Don't use Node.js directly or skip setup

```bash
# ❌ BAD: Using Node.js directly (bypasses npm scripts)
node src/app/page.tsx

# ❌ BAD: Skipping dependency installation
# Missing: npm install
```

## Configuration System

**Environment:** `.env` file + environment variables
**Validation:** Zod for data validation

## Docker Setup

**Services:**

- `node:24-alpine` - Base image (to match project requirements)

**Features:**

- Multi-stage builds (deps/builder/runner)
- Non-root user security
- Volume mounts for development
- Health checks and restart policies

## Testing Strategy

No testing framework is explicitly defined in the project's dependencies. However, the project has a CI workflow that runs `lint` and `typecheck` to ensure code quality.

## Quality Standards

- **Type Safety:** Strict TypeScript configuration
- **Code Style:** ESLint with Next.js standards
- **Dependencies:** Locked versions via `package-lock.json`
- **Git:** Conventional commits, CI checks

## Best Practices

1. **Dependencies:** Always use `npm`, commit `package-lock.json`
2. **Types:** Fix all type errors, use strict mode
3. **Configuration:** Validate with Zod
4. **CLI:** Use npm scripts for all tasks
5. **Docker:** Use multi-stage builds, non-root users
6. **Security:** Regular dependency updates, secret management
