# Curator

A universal ranking and rating system for organizing and rating anything.

## Features

- **Categories & Items**: Organize items into custom categories
- **Hybrid Rating System**: Rate items using tier lists (S/A/B/C/D/F) or numerical scores (0-100)
- **Tag Management**: Create and assign tags to items for advanced filtering
- **LLM-Powered Features**:
  - Auto-generate tags based on item name and description
  - Auto-generate descriptions for items
  - Smart suggestions for category metadata fields
- **Image Support**: Upload images or use URLs for categories and items
- **Drag & Drop**: Intuitive tier list interface with drag-and-drop functionality
- **Dark Mode**: Modern dark-themed UI
- **SQLite Database**: Local database using Drizzle ORM
- **Docker Ready**: Fully containerized for easy deployment

## Getting Started

### Prerequisites

- Node.js 20+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/LunarVigilante/curator.git
cd curator
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### Configuration

Configure your LLM integration in the Settings page:
- Provider: OpenRouter (or any OpenAI-compatible API)
- API Key: Your API key
- Endpoint: Custom endpoint (optional)
- Model: Select from available models

## Docker Deployment

```bash
docker-compose up -d
```

The application will be available at http://localhost:3000

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: SQLite with Drizzle ORM
- **UI**: Shadcn/UI + Radix UI + Tailwind CSS
- **Drag & Drop**: dnd-kit
- **Icons**: Lucide React
- **Themes**: next-themes

## License

MIT
