# PKP - Personal Knowledge Pack

AI-powered personal second brain service that organizes handwritten notes and creates weekly knowledge packs for easy review.

## 🎯 Overview

PKP provides these features:

- **Handwritten Note Import**: Sync handwritten notes from your device to the cloud
- **AI Auto-Classification**: Analyze note content and automatically sort into categories
- **RAG Q&A**: Search past notes and get AI-powered answers to your questions
- **Weekly Knowledge Packs**: Auto-generate weekly summary reports from your notes

## 🏗️ Architecture

```
/
├── apps/
│   └── web/           # Next.js Web Application
├── packages/
│   └── core/          # Shared types, schemas, and utilities
├── docs/
│   └── SPECIFICATION.md  # Detailed specification
└── supabase/
    └── migrations/    # Database migrations
```

### Tech Stack

- **Frontend**: Next.js 16 (App Router), TypeScript, Tailwind CSS
- **Authentication**: Clerk
- **Database**: Supabase PostgreSQL + pgvector
- **AI**: Google Gemini API (gemini-2.5-flash, gemini-embedding-1.0)
- **Infrastructure**: Vercel

## 🚀 Setup

### Requirements

- Node.js 20+
- pnpm 10+
- make (built-in on macOS/Linux)
- Supabase account
- Clerk account
- Google Gemini API key (free tier available)

### Quick Start (Recommended)

```bash
# 1. Initial setup (install dependencies + create environment file)
make setup

# 2. Edit apps/web/.env and add your API keys

# 3. Generate random string for CRON_SECRET
make generate-secret

# 4. Set up database in Supabase dashboard
# https://supabase.com/dashboard → SQL Editor → run supabase/migrations/001_initial_schema.sql

# 5. Start development server
make up
```

The app will run at http://localhost:3000.

### Make Commands

```bash
make help           # Show help
make setup          # Initial setup
make up             # Start dev server
make build          # Production build
make lint           # Lint code
make format         # Format code
make clean          # Clean up
make generate-secret # Generate CRON_SECRET
```

### Manual Setup

If not using Makefile:

#### 1. Install Dependencies

```bash
pnpm install
```

#### 2. Set Up Environment Variables

```bash
cd apps/web
cp .env.example .env
```

Edit `.env` and set these values:

```env
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...

# Supabase (new recommended keys)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...

# Google Gemini AI
GEMINI_API_KEY=AIzaSy...

# Cron (generate random string: openssl rand -base64 32)
CRON_SECRET=your-secret-key
```

#### 3. Set Up Database

Open Supabase dashboard SQL Editor and run `supabase/migrations/001_initial_schema.sql`.

#### 4. Start Development Server

```bash
cd apps/web
pnpm dev
```

The app will run at http://localhost:3000.

## 📱 Device Setup

1. Open "Settings > Devices" in the web app
2. Click "Add Device" to get a claim code
3. Enter the claim code in your device app

## 🔌 API Endpoints

### Notes API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notes` | Get list of notes |
| POST | `/api/notes` | Create a note |
| GET | `/api/notes/[id]` | Get note details |
| PATCH | `/api/notes/[id]` | Update a note |
| DELETE | `/api/notes/[id]` | Delete a note |

### RAG API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/rag/query` | Ask questions |

### Knowledge Pack API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/knowledge-pack` | Get list of packs |
| POST | `/api/knowledge-pack` | Generate a pack |
| GET | `/api/knowledge-pack/[id]` | Get pack details |

### Device API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/device/bootstrap` | Start device registration |
| POST | `/api/device/claim` | Authenticate device |
| GET | `/api/device` | Get list of devices |
| POST | `/api/device/[id]/revoke` | Disable a device |

### Ingest API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ingest/ink` | Import handwritten data |

## 🧪 Development

### Code Quality

```bash
# Format code
pnpm format

# Lint code
pnpm lint
```

### Build

```bash
cd apps/web
pnpm build
```

## 📄 License

MIT

## 🔗 Related Documents

- [Detailed Specification](./docs/SPECIFICATION.md)
