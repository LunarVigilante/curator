![CI Status](https://github.com/LunarVigilante/curator/actions/workflows/ci.yml/badge.svg)

# Curator

**Curate your culture.** The definitive vault for tracking, ranking, and discovering movies, games, books, and music.

## Features

- **Face-Off Tournament Mode**: Rank items by comparing them head-to-head.
- **Smart Paste**: Import content instantly via URL.
- **Antigravity UI**: Premium, immersive aesthetic with glassmorphism and fluid animations.
- **AI-Powered Analysis**: Intelligent insights powered by Anannas AI.

## Tech Stack

- **Frontend**: React, TypeScript, Next.js, Tailwind CSS
- **Auth**: BetterAuth (Invite-Only System)
- **AI**: Anannas (LLM Gateway)
- **Analytics**: PostHog
- **Database**: SQLite (Drizzle ORM)

## Setup Guide

```bash
git clone <repository_url>
cd curator
npm install
cp .env.example .env
# Edit .env with your keys (ANANNAS_API_KEY, POSTHOG_KEY, ENCRYPTION_KEY)
npx drizzle-kit push
npm run dev
```

## Initial Access (Dev Only)

The seed script (`src/scripts/_setup_examples/seed-admin.ts`) creates a default admin account:

- **Email**: `admin@example.com`
- **Password**: `temporary-password-123`

> [!WARNING]
> The application forces a password change on the first login for this account.
