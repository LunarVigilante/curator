![CI Status](https://github.com/LunarVigilante/curator/actions/workflows/ci.yml/badge.svg)

# Curator

**Curate your culture.** The definitive vault for tracking, ranking, and discovering movies, games, books, music, anime, and more.

## Features

- 🎮 **Face-Off Tournament Mode** - Rank items by comparing them head-to-head with ELO scoring for scientifically accurate leaderboards.
- 🧠 **AI-Powered Analysis** - Intelligent insights, taste profiling, and "Smart Sort" tiering using LLMs (OpenAI, Anthropic, or OpenRouter).
- 🔍 **Smart Paste** - Import content instantly via URL.
- 🎨 **Antigravity UI** - Premium glassmorphism aesthetic with fluid animations and responsive design.
- 📊 **Multi-Source Metadata** - Auto-fetches rich data from TMDB, AniList, Spotify, IGDB, BGG, Google Books, and more.
- 🔒 **Enterprise-Grade Auth** - Secure authentication via Supabase (Email/Password + OAuth).

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| **Database** | Supabase (PostgreSQL 15+) |
| **Auth** | Supabase Auth (SSR w/ Middleware Protection) |
| **AI** | Integrated LLM Client (OpenAI / Anthropic / OpenRouter) |
| **Styling** | Tailwind CSS, Framer Motion, Lucide Icons |
| **Data Sources** | TMDB, AniList, Spotify, IGDB, BoardGameGeek, Google Books, ComicVine |

## Quick Start

### Prerequisites
- Node.js 24+ (LTS recommended)
- Supabase Project

### Installation

```bash
# Clone the repository
git clone https://github.com/LunarVigilante/curator.git
cd curator

# Install dependencies
npm install

# Configure environment
cp .env.example .env
```

### Environment Setup

1.  **Database & Auth**: Create a project on [Supabase](https://supabase.com).
2.  **Schema**: Run the SQL from `supabase/schema.sql` in your Supabase SQL Editor.
3.  **Credentials**: Update `.env` with your Supabase URL and Keys.
4.  **External APIs**: (Optional) Add keys for TMDB, Spotify, IGDB, etc., to fetch rich metadata.

See `.env.example` for a detailed breakdown of all configuration options.

### Running Locally

```bash
npm run dev
# App running at http://localhost:3000
```

## Project Structure

```
curator/
├── src/
│   ├── app/                # Next.js 16 App Router pages & layouts
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

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Create production build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript compiler checks |

## License

Private - All Rights Reserved
