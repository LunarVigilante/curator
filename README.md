![CI Status](https://github.com/LunarVigilante/curator/actions/workflows/ci.yml/badge.svg)

# Curator

**Curate your culture.** The definitive vault for tracking, ranking, and discovering movies, games, books, music, anime, and more.

## Features

- 🎮 **Face-Off Tournament Mode** - Rank items by comparing them head-to-head with ELO scoring
- 🧠 **AI-Powered Analysis** - Intelligent insights and taste profiling powered by Anannas AI
- 🔍 **Smart Paste** - Import content instantly via URL
- 🎨 **Antigravity UI** - Premium glassmorphism aesthetic with fluid animations
- 📊 **Multi-Source Metadata** - Pulls from TMDB, AniList, Spotify, RAWG, BGG, and more
- 🏷️ **Vector-Ready** - Rich metadata payloads for AI embeddings and recommendations

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 15, React, TypeScript, Tailwind CSS |
| **Database** | Supabase (PostgreSQL) + Prisma ORM |
| **Auth** | Supabase Native Auth (Email, OAuth, MFA, Passkeys) |
| **AI** | Anannas (LLM Gateway) |
| **Analytics** | PostHog |
| **APIs** | TMDB, AniList, Spotify, RAWG, BoardGameGeek, Google Books, ComicVine, iTunes |

## Quick Start

```bash
# Clone and install
git clone https://github.com/LunarVigilante/curator.git
cd curator
npm install

# Configure environment
cp .env.example .env
# Edit .env with your Supabase credentials and API keys

# Run database migration
npx prisma migrate dev

# Start development server
npm run dev
```

## Environment Setup

Required in `.env`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
DATABASE_URL=postgres://...pooler:6543/postgres?pgbouncer=true
DIRECT_URL=postgres://...pooler:5432/postgres

# AI & Analytics
ANANNAS_API_KEY=your-key
POSTHOG_KEY=your-key
```

## Supabase Setup

After running Prisma migrations, execute the SQL in `supabase/auth_sync_and_rls.sql` to:
1. Create auth sync triggers (auto-creates profile on signup)
2. Enable Row Level Security policies

## Project Structure

```
curator/
├── prisma/                 # Database schema
│   └── schema.prisma
├── supabase/               # Supabase SQL scripts
│   └── auth_sync_and_rls.sql
├── src/
│   ├── app/                # Next.js App Router
│   ├── components/         # React components
│   ├── lib/
│   │   ├── actions/        # Server actions
│   │   ├── services/       # Business logic
│   │   │   └── media/      # API strategies (TMDB, Spotify, etc.)
│   │   └── metadata/       # Vector text generator
│   └── hooks/              # React hooks
├── scripts/                # Seed scripts
└── docs/                   # Documentation
```

## Documentation

- [Supabase Auth Migration Guide](docs/SUPABASE_AUTH_MIGRATION.md)

## License

Private - All Rights Reserved
