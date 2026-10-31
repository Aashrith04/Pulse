# Pulse — The World, Understood.

> A calm, evidence-grounded news intelligence platform combining multi-geographic coverage, multilingual comprehension, balanced perspectives, and personal vocabulary learning.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61dafb.svg)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-6.4-646cff.svg)](https://vitejs.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-green.svg)](https://nodejs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%2015-3ecf8e.svg)](https://supabase.com/)
[![Render](https://img.shields.io/badge/Deployment-Render%20Free-46e3b7.svg)](https://render.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 1. Project Title & Introduction

**Pulse** is a student demonstration project and calm news intelligence web application designed to counteract sensationalist clickbait, information overload, and algorithmic polarization. 

Pulse aggregates reporting from verified official and journalistic sources, clusters related dispatches into canonical stories, provides structured time-windowed digests, offers transparent multidimensional perspectives, and empowers readers to expand their vocabulary in multiple Indian languages (Telugu, Hindi, and English) directly while reading.

---

## 2. Problem Statement & Objectives

Modern digital news platforms often prioritize engagement over clarity, leading to:
- **Sensationalism & Anxiety**: Alarmist headlines designed for clicks rather than informed understanding.
- **Fragmented Coverage**: Redundant dispatches repeating identical events without synthesizing what actually changed.
- **Language & Comprehension Barriers**: Complex journalistic vocabulary without contextual explanations in regional languages.
- **Polarized Echo Chambers**: Single-viewpoint commentary blurring the line between verified facts and editorial interpretations.

### Project Objectives
1. **Calm, High-Signal Reading**: Deliver clean, distraction-free typography with zero intrusive ads or popups.
2. **Evidence-Grounded Clustering**: Unify disparate wire reports into single canonical storylines with chronological event timelines.
3. **Multilingual Comprehension**: Enable contextual dictionary lookups ("Tap-to-Understand") and headlines translated into Telugu and Hindi.
4. **Balanced Perspectives**: Surface distinct viewpoints, affected group concerns, and evidence status audits.
5. **Completely Free Architecture ($0/month)**: Engineered to operate 100% on free-tier infrastructure (GitHub, Render Free, Supabase Free) without paid dependencies.

---

## 3. Main Features

- **Today's Focus (Executive Briefing)**: Synthesizes *What happened? Why it matters? What changed recently?*
- **State News (India First)**: Coverage across all **28 Indian States & 8 Union Territories** with category filtering (Governance, Education/Exams, Infrastructure, Agriculture, Public Services).
- **National News**: India-focused coverage linking directly to official gazettes (PIB, ministries) alongside verified media reports.
- **International News**: Global dispatches organized by world regions with an explicit *Implications for India* lens.
- **Hourly World Pulse**: Automated hourly briefing generation with freshness indicators and "What changed since previous" delta analysis.
- **The Perspective Desk**: Detailed breakdown separating factual records from interpretations, attributed viewpoints, and evidence uncertainty audits.
- **Tap-to-Understand (Contextual Dictionary)**: Select any word in an article to view contextual definitions, parts of speech, and Telugu/Hindi meanings.
- **Personal Vocabulary & Spaced Practice**: Save terms from articles into a personal vocabulary collection with active recall practice.
- **Ask the News**: Evidence-grounded conversational search providing factual answers supported by clickable citations.
- **Catch Me Up (Delta Engine)**: Dynamic summary of developments over selectable time horizons (3h, 6h, 12h, 24h, 7d).
- **Listen to Your World (Audio Read-Aloud)**: Clean text-to-speech audio narration with speed controls (0.75x–1.5x).
- **Respectful Quiet Notifications**: Local and Web Push notifications enforcing a calm 3-hour quiet interval to prevent notification fatigue.

---

## 4. Technology Stack

### Frontend
- **Framework**: React 18 (SPA)
- **Tooling**: Vite 6, TypeScript 5.7
- **Styling**: Tailwind CSS, PostCSS (Custom Editorial Paper/Night Design System)
- **Icons**: Lucide React
- **Hosting**: Render Static Site (Global CDN)

### Backend
- **Runtime**: Node.js 20 (Alpine Linux container)
- **Framework**: Express 4, TypeScript 5.7
- **Scheduling**: `node-cron` for periodic RSS ingestion and hourly briefings
- **Ingestion**: `rss-parser` for standard RSS/Atom feeds (PIB India, The Hindu, BBC, Indian Express)
- **Validation & Security**: Zod, rate limiting, Helmet HTTP headers, CORS origin enforcement
- **Hosting**: Render Web Service (Free Tier Docker container)

### Database & Authentication
- **Provider**: Supabase Cloud (PostgreSQL 15)
- **Security**: PostgreSQL Row Level Security (RLS) on all personal tables
- **Authentication**: Supabase Auth (JWT Bearer tokens) with role verification via `app_metadata`

### AI Layer
- **Orchestration**: Provider-agnostic multi-model adapter pattern
- **Default Active Mode**: **Deterministic Fallback Engine** ($0 API cost, deterministic, grounded)
- **Optional Providers**: Modular adapters for OpenAI (`gpt-4o-mini`), Anthropic Claude (`claude-3-5-sonnet`), and xAI Grok (`grok-2`)

---

## 5. Architecture Overview

```
                                ┌────────────────────────────────┐
                                │   Global Readers / Browsers    │
                                └──────────────┬─────────────────┘
                                               │
                       ┌───────────────────────┴───────────────────────┐
                       │ HTTPS                                         │ HTTPS /api/*
                       ▼                                               ▼
         ┌───────────────────────────┐                   ┌───────────────────────────┐
         │    pulse-frontend         │                   │     pulse-backend         │
         │  (Render Static Site)     │                   │  (Render Free Web Svc)    │
         │  • React 18 / Vite 6 SPA  │                   │  • Node 20 Docker         │
         │  • Client-side routing    │                   │  • /api/health probe      │
         │  • Cold-start retry logic │                   │  • RSS Ingestion engine   │
         │  • Service Worker (/sw.js)│                   │  • Hourly Pulse generator │
         └───────────────────────────┘                   └─────────────┬─────────────┘
                                                                       │
                                                             HTTPS     │ (Service Role / Anon)
                                                                       ▼
                                                         ┌───────────────────────────┐
                                                         │      Supabase Cloud       │
                                                         │  • PostgreSQL 15 + RLS    │
                                                         │  • Editorial Stories      │
                                                         │  • User Personal Data     │
                                                         └───────────────────────────┘
```

---

## 6. Screenshots

*Screenshots representing the Pulse editorial interface (Placeholders):*

| Editorial Feed & The Day in Focus | The Perspective Desk |
| :---: | :---: |
| ![Editorial Feed Screenshot](https://raw.githubusercontent.com/placeholder/pulse-feed.png) | ![Perspective Desk Screenshot](https://raw.githubusercontent.com/placeholder/pulse-perspective.png) |

| Tap-to-Understand (Contextual Dictionary) | Personal Vocabulary & Recall Practice |
| :---: | :---: |
| ![Dictionary Screenshot](https://raw.githubusercontent.com/placeholder/pulse-dict.png) | ![Vocabulary Practice Screenshot](https://raw.githubusercontent.com/placeholder/pulse-vocab.png) |

---

## 7. Local Setup Instructions

### Prerequisites
- Node.js >= 18.0.0
- npm >= 9.0.0
- Git

### Installation
```bash
# Clone the repository
git clone https://github.com/<your-username>/pulse.git
cd pulse

# Install dependencies across root, server, and client
npm install
npm --prefix server install
npm --prefix client install
```

### Running Locally
```bash
# Launch both backend (port 3001) and frontend (port 5173) concurrently
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your web browser.

### Running Automated Tests
```bash
# Execute backend Vitest test suite (66 tests covering ingestion, security, and API)
npm --prefix server run test

# Run production build checks
npm --prefix server run build
npm --prefix client run build
```

---

## 8. Environment Variable Setup

### Backend (`server/.env`)
Copy `server/.env.example` to `server/.env` and configure your credentials:

```bash
cp server/.env.example server/.env
```

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `PORT` | Local server port | `3001` |
| `NODE_ENV` | Environment mode | `development` (use `production` on Render) |
| `CLIENT_URL` | Allowed CORS origins (comma-separated) | `http://localhost:5173` |
| `PULSE_STORAGE_MODE` | Persistence mode (`cloud` or `local`) | `cloud` |
| `SUPABASE_URL` | Supabase project API URL | `https://<ref>.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase anon public key | `<supabase-anon-key>` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role secret (server-side only) | `<supabase-service-role-key>` |
| `ADMIN_API_KEY` | 256-bit secret protecting administrative endpoints | `replace-with-secure-32-byte-hex` |
| `AI_PRIMARY_PROVIDER` | Active AI provider (`fallback`, `openai`, `anthropic`, `xai`) | `fallback` |
| `ENABLE_BACKGROUND_SCHEDULER` | Run in-process cron jobs | `true` |

### Frontend (`client/.env`)
Copy `client/.env.example` to `client/.env`:

```bash
cp client/.env.example client/.env
```

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | Backend API base URL | `http://localhost:3001/api` |

---

## 9. Supabase Setup Overview

Pulse uses Supabase Cloud PostgreSQL for all persistence in cloud mode:

1. **Schema**: Base schema is defined in [server/src/db/schema.sql](file:///d:/Aashrith/Webs/Plause/server/src/db/schema.sql).
2. **Security & RLS Policies**: Configured via [server/src/db/migrations/001_cloud_setup_and_security.sql](file:///d:/Aashrith/Webs/Plause/server/src/db/migrations/001_cloud_setup_and_security.sql).
3. **Row Level Security**:
   - Editorial tables (`canonical_stories`, `articles`, `hourly_pulse_briefings`, `perspective_analyses`) have public read access.
   - User tables (`saved_stories`, `vocabulary_entries`, `user_preferences`, `reading_history`) strictly require authenticated sessions matching `auth.uid() = user_id`.
4. **Cloud Backup & Restore**:
   ```bash
   # Create a timestamped backup of all Supabase tables:
   npm --prefix server run backup

   # Validate backup file with dry-run simulation:
   npm --prefix server run restore "data/backups/<backup-file>.json" --dry-run

   # Restore backup into Supabase (requires confirmation gate):
   npm --prefix server run restore "data/backups/<backup-file>.json" --confirm
   ```

---

## 10. Free Deployment Guide (Render $0/month)

Pulse includes a complete Render Blueprint configuration ([render.yaml](file:///d:/Aashrith/Webs/Plause/render.yaml)) configured entirely for Render's **Free Tier**:

### Service 1: `pulse-backend` (Web Service)
- **Runtime**: Docker (`server/Dockerfile`)
- **Plan**: `free` ($0/mo)
- **Health Check**: `/api/health`
- **Environment**: Set `PULSE_STORAGE_MODE=cloud`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_API_KEY`, and `CLIENT_URL`.

### Service 2: `pulse-frontend` (Static Site)
- **Build Command**: `npm ci && npm run build`
- **Publish Directory**: `dist`
- **Plan**: `free` ($0/mo, global CDN)
- **Routing**: SPA rewrite rule (`/*` -> `/index.html`)
- **Environment**: Set `VITE_API_BASE_URL=https://<your-backend>.onrender.com/api`.

*For complete step-by-step instructions and CORS resolution sequence, see [docs/render_deployment_guide.md](file:///d:/Aashrith/Webs/Plause/docs/render_deployment_guide.md).*

---

## 11. Known Free-Tier Limitations

Because this project is deployed strictly on free-tier infrastructure ($0/month budget), readers and evaluators should note the following characteristics:

1. **Backend Cold Starts**:
   - Render Free Web Services sleep after 15 minutes of inactivity.
   - When visiting after an idle period, the initial request takes **30–50 seconds** while the container boots up.
   - The frontend automatically detects this, displays a calm waking-up message, and safely retries requests with backoff.
2. **Scheduled Ingestion During Sleep**:
   - In-process cron jobs (`node-cron`) do not execute while the free container is asleep.
   - When the server wakes up from web traffic, it immediately resumes and serves the latest stories from Supabase.
   - Administrators can manually trigger RSS ingestion and hourly briefings on demand via the `/admin` portal.
3. **Zero External AI Costs**:
   - The platform defaults to `AI_PRIMARY_PROVIDER=fallback`. It delivers factual summaries, definitions, and translations using the deterministic offline engine with zero API fees.

---

## 12. Future Improvements

- **Dedicated Free Worker**: Separate the ingestion scheduler into a dedicated worker service with external cron triggers (e.g. GitHub Actions scheduled workflows).
- **Audio Offline Caching**: Cache synthetic speech audio files via Service Worker Cache API for full offline listening.
- **Progressive Web App (PWA) Install Prompt**: Enhanced mobile standalone installation with full offline reading bookmarks.
- **Expanded Indian Languages**: Broaden Tap-to-Understand coverage to include Tamil, Bengali, Marathi, and Kannada.

---

## License

This project is licensed under the **MIT License**. Created as an academic demonstration and portfolio project.
