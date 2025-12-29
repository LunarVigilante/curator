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
| **Frontend** | Next.js 16, React, TypeScript, Tailwind CSS |
| **Database** | Supabase (PostgreSQL) |
| **Auth** | Supabase Auth (Email, OAuth) |
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

# Start development server
npm run dev
```

## Environment Setup

Required in `.env`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# AI & Analytics
ANANNAS_API_KEY=your-key
POSTHOG_KEY=your-key
```

## Supabase Setup

1. Create a new Supabase project
2. Execute the SQL in `supabase/schema.sql` to create all tables
3. Configure auth providers in the Supabase dashboard

## Project Structure

```
curator/
├── supabase/               # Supabase SQL schema
│   └── schema.sql
├── src/
│   ├── app/                # Next.js App Router
│   ├── components/         # React components
│   ├── lib/
│   │   ├── actions/        # Server actions
│   │   ├── services/       # Business logic
│   │   │   └── media/      # API strategies (TMDB, Spotify, etc.)
│   │   ├── supabase/       # Supabase client configuration
│   │   └── metadata/       # Vector text generator
│   └── hooks/              # React hooks
├── scripts/                # Seed scripts
└── docs/                   # Documentation
```

## License

Private - All Rights Reserved
