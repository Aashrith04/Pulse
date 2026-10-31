# Pulse — Supabase Repository Architecture

> **Document Version:** 1.0.0  
> **Target System:** Pulse News Intelligence Platform  
> **Storage Engine:** Supabase PostgreSQL & Local JSON  
> **Status:** Production Architecture Implementation  

---

## 1. Executive Summary

Pulse originated with an ACID-safe file storage architecture (`server/data/pulse.db.json`) designed for zero-configuration local demonstration. In Phase 4.6, Pulse establishes a formal, production-grade **dual repository architecture** governed by the `INewsRepository` interface. 

This architecture allows the platform to operate in two distinct modes configured explicitly via `PULSE_STORAGE_MODE`:
1. **`cloud`**: Direct persistence to Supabase PostgreSQL, enforcing Row-Level Security (RLS), verified Supabase JWT authentication, and strict multi-tenant isolation.
2. **`local`**: Offline demonstration persistence via `pulse.db.json`, preserving existing demo data, pre-seeded sources, and guest reading workflows without requiring cloud credentials.

---

## 2. Core Repository Abstraction (`INewsRepository`)

All data access operations across Pulse are decoupled from underlying database engines via the `INewsRepository` interface defined in `server/src/db/types.ts`. Both `SupabaseNewsRepository` and `JsonFileRepository` implement this contract completely.

```
                            ┌─────────────────────────────────┐
                            │         INewsRepository         │
                            │   (server/src/db/types.ts)      │
                            └────────────────┬────────────────┘
                                             │
                     ┌───────────────────────┴───────────────────────┐
                     ▼                                               ▼
      ┌───────────────────────────────┐               ┌───────────────────────────────┐
      │     SupabaseNewsRepository    │               │       JsonFileRepository      │
      │ (PULSE_STORAGE_MODE = cloud)  │               │  (PULSE_STORAGE_MODE = local) │
      │   Supabase PostgreSQL Engine  │               │    server/data/pulse.db.json  │
      └───────────────────────────────┘               └───────────────────────────────┘
```

### Covered Domain Operations
`INewsRepository` covers all 14 data domains required for editorial publishing, intelligence processing, personal learning, and telemetry:

| Domain Area | Operations Supported | Cloud Table | Local Key |
| :--- | :--- | :--- | :--- |
| **System Diagnostics** | `getMode()`, `ping()`, `getDiagnostics()` | Multiple / `news_sources` | In-memory / State |
| **News Sources** | `getSources()`, `getSourceById()`, `updateSource()`, `updateSourceHealth()`, `upsertSource()` | `public.news_sources` | `state.sources` |
| **Articles** | `getArticles()`, `addArticle()` | `public.articles` | `state.articles` |
| **Canonical Stories** | `getStories()`, `getStoryById()`, `upsertStory()` | `public.canonical_stories` | `state.stories` |
| **Story Relationships** | Linked inside `upsertStory()` | `public.story_articles` | `story.articles` |
| **Timeline Events** | Linked inside `upsertStory()` | `public.story_timeline_events` | `story.timeline` |
| **Perspective Desk** | `getPerspective()`, `savePerspective()` | `public.perspective_analyses` | `state.perspectives` |
| **Hourly Briefings** | `getBriefings()`, `getLatestBriefing()`, `addBriefing()` | `public.hourly_pulse_briefings` | `state.briefings` |
| **User Profiles** | `getUserProfile()`, `updateUserProfile()` | `public.users` | Seed mapping |
| **User Preferences** | `getPreferences()`, `savePreferences()` | `public.user_preferences` | `state.preferences` |
| **Saved Stories** | `getSavedStories()`, `saveStory()`, `removeSavedStory()` | `public.saved_stories` | Relational join |
| **Reading History** | `recordReading()`, `getReadingHistory()` | `public.reading_history` | Relational join |
| **Vocabulary** | `getVocabulary()`, `addVocabulary()`, `updateVocabulary()`, `deleteVocabulary()` | `public.vocabulary_entries` | `state.vocabulary` |
| **Vocab Reviews** | `addVocabularyReview()`, `getVocabularyReviews()` | `public.vocabulary_reviews` | Relational join |
| **Ask Conversations** | `getConversation()`, `saveConversation()` | `public.ask_conversations`, `ask_messages` | `state.conversations` |
| **Notifications** | `getNotifications()`, `addNotification()`, `markNotificationRead()`, `markAllNotificationsRead()` | `public.notifications` | `state.notifications` |
| **Push Subscriptions**| `getPushSubscriptions()`, `addPushSubscription()`, `deletePushSubscription()` | `public.push_subscriptions` | `state.pushSubscriptions` |
| **Cache & Telemetry** | `getCachedTranslation()`, `setCachedTranslation()`, `getCachedDefinition()`, `setCachedDefinition()`, `addIngestionLog()`, `getIngestionLogs()`, `addAILog()`, `getAILogs()` | `cached_translations`, `cached_definitions`, `ingestion_metrics`, `ai_request_logs` | `state.cached...`, `state.ingestionLogs` |

---

## 3. Storage Mode Governance & Strict Error Policy

Storage mode is controlled via an explicit environment variable:
```bash
PULSE_STORAGE_MODE=cloud
# or
PULSE_STORAGE_MODE=local
```

### Factory Implementation (`repositoryFactory.ts`)
The `createRepository()` factory resolves the active repository instance:
- If `PULSE_STORAGE_MODE=local` (or unset), it loads `JsonFileRepository`, reading from `pulse.db.json`.
- If `PULSE_STORAGE_MODE=cloud`:
  1. Validates that `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_ANON_KEY`) are configured.
  2. If credentials are missing, **it throws a fatal error immediately** with explicit diagnostic instructions.
  3. Returns a singleton instance of `SupabaseNewsRepository`.

### Strict Resilience Rule: No Silent Fallback
A critical requirement of Phase 4.6 is that **Pulse must never silently fall back to local storage after cloud write or connection failures**. 
- Silent fallback causes data fragmentation, split-brain reads, and silent loss of user data across devices.
- If cloud mode is configured and a query fails or the database is unreachable, `SupabaseNewsRepository` logs the diagnostic failure and bubbles a clear error up to the REST layer (returning HTTP 500 or 503).
- Local storage remains completely untouched during cloud mode operation.

---

## 4. Supabase Client Roles & Dual-Client Security

`SupabaseNewsRepository` isolates operations into two security tiers using two distinct Supabase clients (`server/src/db/supabaseClient.ts`):

```
                                  ┌───────────────────────────┐
                                  │   Supabase Client Roles   │
                                  └─────────────┬─────────────┘
                                                │
                     ┌──────────────────────────┴──────────────────────────┐
                     ▼                                                     ▼
      ┌───────────────────────────────┐                     ┌───────────────────────────────┐
      │          Anon Client          │                     │      Service-Role Client      │
      │  (Public / Authenticated RLS) │                     │     (Server-Side Trusted)     │
      ├───────────────────────────────┤                     ├───────────────────────────────┤
      │ • Validates incoming JWTs     │                     │ • RSS feed batch ingestion    │
      │ • Scoped by auth.uid() in RLS │                     │ • Hourly Pulse generation     │
      │ • Public editorial SELECT     │                     │ • System diagnostics & health │
      │ • NEVER has admin write perms │                     │ • NEVER sent to browser/client│
      └───────────────────────────────┘                     └───────────────────────────────┘
```

1. **Anonymous / Authenticated Client (`SUPABASE_ANON_KEY`):**
   - Used for public reads (stories, sources, briefings, perspectives) and user-authenticated requests.
   - Constrained by PostgreSQL Row-Level Security (RLS) policies.
   - Enforces user tenancy: users can only view or modify their own rows (`auth.uid() = user_id`).
   - Verified via `authenticateUser` middleware for incoming HTTP requests.

2. **Service-Role / Admin Client (`SUPABASE_SERVICE_ROLE_KEY`):**
   - Used exclusively for background workers running on the server:
     - Automated RSS feed ingestion (`taskScheduler.runIngestion()`).
     - Automated Hourly Pulse generation (`taskScheduler.runBriefing()`).
     - System diagnostics and background ingestion telemetry.
   - **Strictly isolated on the server**: Never passed to the client-side bundle or exposed via any client environment variable.

---

## 5. Primary Key Bridging: Deterministic UUIDv5

### The Architectural Challenge
The existing Pulse data model and RSS feed adapters utilize clean human-readable text identifiers:
- Sources: `src-the-hindu`, `src-pib-delhi`, `src-bbc-world`
- Stories: `story-1793335560425-telangana-metro`
- Articles: `art-the-hindu-aHR0cHM6Ly93...`

PostgreSQL schemas strictly require standard `UUID` types (`uuid NOT NULL PRIMARY KEY`) for foreign keys and Supabase compatibility.

### The Solution: Deterministic RFC 4122 UUIDv5
To bridge legacy string IDs to PostgreSQL `UUID` primary keys without data loss or random re-generation on each run, Pulse uses deterministic RFC 4122 UUIDv5 (`server/src/db/uuidUtils.ts`):
- Uses standard Node.js native `crypto` module (zero external dependencies).
- SHA-1 hashing under a constant Pulse DNS namespace (`6ba7b810-9dad-11d1-80b4-00c04fd430c8`).
- **Guaranteed determinism:** Identical input string always produces the identical UUID across runs, migrations, and test environments.
- Resolves foreign key dependencies cleanly between articles, canonical stories, timeline events, and hourly briefings.

---

## 6. Security Boundaries & Row-Level Security Matrix

| Table | Public Access | Authenticated User Access | Service-Role / Background |
| :--- | :--- | :--- | :--- |
| `news_sources` | `SELECT` (Public read) | `SELECT` (Public read) | Full `INSERT, UPDATE, DELETE` |
| `canonical_stories` | `SELECT` (Public read) | `SELECT` (Public read) | Full `INSERT, UPDATE, DELETE` |
| `articles` | `SELECT` (Public read) | `SELECT` (Public read) | Full `INSERT, UPDATE, DELETE` |
| `story_articles` | `SELECT` (Public read) | `SELECT` (Public read) | Full `INSERT, UPDATE, DELETE` |
| `story_timeline_events` | `SELECT` (Public read) | `SELECT` (Public read) | Full `INSERT, UPDATE, DELETE` |
| `hourly_pulse_briefings` | `SELECT` (Public read) | `SELECT` (Public read) | Full `INSERT, UPDATE, DELETE` |
| `briefing_stories` | `SELECT` (Public read) | `SELECT` (Public read) | Full `INSERT, UPDATE, DELETE` |
| `perspective_analyses` | `SELECT` (Public read) | `SELECT` (Public read) | Full `INSERT, UPDATE, DELETE` |
| `public.users` | None | `SELECT` own profile (`auth.uid() = id`) | Full `INSERT, UPDATE` |
| `user_preferences` | None | `ALL` own records (`auth.uid() = user_id`) | Admin maintenance |
| `saved_stories` | None | `ALL` own records (`auth.uid() = user_id`) | Admin maintenance |
| `reading_history` | None | `ALL` own records (`auth.uid() = user_id`) | Admin maintenance |
| `vocabulary_entries` | None | `ALL` own records (`auth.uid() = user_id`) | Admin maintenance |
| `vocabulary_reviews` | None | `ALL` own records (`auth.uid() = user_id`) | Admin maintenance |
| `ask_conversations` | None | `ALL` own records (`auth.uid() = user_id`) | Admin maintenance |
| `ask_messages` | None | `ALL` own conversation messages | Admin maintenance |
| `notifications` | None | `SELECT, UPDATE` own notifications | Full `INSERT` (Worker) |
| `push_subscriptions` | None | `ALL` own device endpoints | Delivery dispatcher |

### Guest Session & Authentication Policy
- **Public Reading:** Anonymous users can read all canonical stories, state news feeds, perspectives, and hourly briefings without signing in.
- **Persistent Personal Features:** In cloud mode (`PULSE_STORAGE_MODE=cloud`), persistent features (saving stories, tracking vocabulary, personal reading history, cross-device preferences) require a valid Supabase JWT.
- **`X-Guest-ID` Protection:** `X-Guest-ID` headers are **never accepted as proof of authentication** in cloud mode. Guest sessions attempting persistent writes are returned HTTP 401 Unauthorized via `requireAuth` middleware.
- **Local Demo Preservation:** In local demo mode (`PULSE_STORAGE_MODE=local`), `X-Guest-ID` continues to be supported within `pulse.db.json` for offline demonstrations.

---

## 7. Performance & Optimization Patterns

1. **Pagination:** `getStories()` supports `limit` and `offset` parameters with PostgreSQL `LIMIT` and `OFFSET` clauses.
2. **Deduplication:** Story ingestion uses URL token hashing and `calculateJaccardSimilarity()` over 48-hour event windows, followed by safe upserts with `onConflict: 'id'` and `onConflict: 'story_id,article_id'`.
3. **Avoidance of N+1 Queries:** `getStories()` performs relational embedding of articles and timeline events, mapping joined rows in memory in single query round-trips.
4. **Idempotent Ingestion:** Re-running RSS ingestion safely updates existing stories without generating duplicate canonical entities.
