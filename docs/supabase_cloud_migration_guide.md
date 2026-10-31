# Pulse — Supabase Cloud Database Migration & Security Guide
**Product:** Pulse — The world, understood.  
**Target Platform:** Supabase Cloud (PostgreSQL 15+)  
**Document Version:** 1.1.0 (Hardened Security Edition)  
**Status:** Pre-Migration Preparation (Do not apply without explicit user sign-off)

---

## 1. Architectural Reality & Persistence Status

Before applying database migrations, it is vital to be transparent about the current state of application persistence:

> [!IMPORTANT]
> **Current Persistence Engine:** Pulse currently uses the local JSON database (`server/data/pulse.db.json`) as its primary storage engine for all news stories, briefings, vocabulary entries, preferences, and notifications.
> 
> The Supabase client (`server/src/db/supabaseClient.ts`) is currently used exclusively for:
> 1. Cryptographic validation of incoming user JWTs (`anonClient.auth.getUser(token)`).
> 2. Operational health diagnostics (`/api/health`).
> 
> Applying the SQL schema to Supabase creates the tables and security perimeter in PostgreSQL. It **does not** automatically route application queries to Supabase. A dedicated Repository Layer implementation (outlined in Section 8) will bridge the application to Supabase upon approval.

---

## 2. Security Corrections Implemented

Following our comprehensive security review, the schema and migration scripts have been hardened with five crucial corrections:

1. **Explicit Public Read for Composite Editorial Relationships:**  
   `story_articles` (source relationships) and `briefing_stories` (stories belonging to hourly briefings) now have explicit `FOR SELECT USING (true)` policies. Without these, public users would be blocked from viewing source citations and briefing story contents.
2. **Protection of `public.users`:**  
   RLS is enabled on `public.users`. Authenticated users can read only their own profile (`auth.uid() = id`). Ordinary users cannot alter `is_admin`, `is_guest`, or other security-sensitive fields. Administrative modifications are restricted to trusted server-side operations.
3. **Hardened Auth Synchronization Trigger (`handle_new_auth_user()`):**  
   - Enforces `SECURITY DEFINER` with a strictly restricted `SET search_path = public, pg_temp` to prevent search-path hijacking attacks.
   - Fully schema-qualifies all table references (`public.users`, `public.user_preferences`).
   - Removes all trust in client-supplied metadata: `is_guest` and `is_admin` are hardcoded to `FALSE`. Client signup metadata can never elevate user privileges.
   - Restricts execution permissions: revoked from `PUBLIC`, `anon`, and `authenticated`; granted exclusively to `supabase_auth_admin` and `service_role`.
4. **User Ownership & Integrity Constraints:**  
   All user-owned tables (`user_preferences`, `saved_stories`, `reading_history`, `vocabulary_entries`, `ask_conversations`, `notification_delivery_history`) enforce `user_id NOT NULL`. The migration checks for duplicates before applying `UNIQUE(user_id)` on `user_preferences` and never deletes user data.
5. **Elimination of Shared Guest Backdoor:**  
   The insecure `OR user_id = '00000000-0000-0000-0000-000000000000'` backdoor has been completely removed from all policies. Each anonymous visitor uses a device-scoped identity (`X-Guest-ID`), and cloud database tables require real cryptographic authentication (`auth.uid() = user_id`).

---

## 3. Required Environment Variables

Place these in your `server/.env` file. These can be located in your **Supabase Dashboard -> Project Settings -> API**:

```env
# 1. Project URL (Project Settings -> API -> Project URL)
SUPABASE_URL=https://[your-project-ref].supabase.co

# 2. Anonymous / Publishable Key (Project Settings -> API -> Project API keys)
# Note: Pulse supports both legacy JWT tokens (eyJ...) and new publishable tokens (sbp_...)
SUPABASE_ANON_KEY=[your-anon-or-publishable-key]

# 3. Secret Service-Role Key (Project Settings -> API -> Project API keys)
# Note: Strictly server-side secret! NEVER put this in client code or Vite env!
SUPABASE_SERVICE_ROLE_KEY=[your-service-role-secret-key]

# 4. Administrative API Key (Shared secret header protecting /api/admin/* manual triggers)
ADMIN_API_KEY=pulse-admin-secret-2026
```

---

## 4. SQL Execution Plan & File Order

To stand up the complete relational schema and security perimeter, execute the SQL files in this exact two-step sequence using the **Supabase Dashboard -> SQL Editor**:

```
Step 1: server/src/db/schema.sql
        └── Creates extensions, 15 relational tables, foreign keys, indexes, baseline constraints, and public read rules.

Step 2: server/src/db/migrations/001_cloud_setup_and_security.sql
        └── Installs hardened auth trigger, safe non-destructive constraints, and repeatable RLS policies.
```

---

### Step 1: Apply Baseline Schema (`schema.sql`)
1. Open your **Supabase Dashboard** -> click on the **SQL Editor** icon in the left navigation.
2. Click **New query**.
3. Copy the complete contents of `server/src/db/schema.sql` and paste it into the editor.
4. Click **Run** (or press `Ctrl+Enter` / `Cmd+Enter`).
5. **Expected Output:** `Success. No rows returned.`
   - Creates extensions: `uuid-ossp`, `pg_trgm`.
   - Creates 15 tables with `NOT NULL` foreign keys and indexes.
   - Sets baseline RLS policies.

---

### Step 2: Apply Hardened Setup & Constraints (`001_cloud_setup_and_security.sql`)
1. In the **SQL Editor**, click **New query**.
2. Copy the complete contents of `server/src/db/migrations/001_cloud_setup_and_security.sql` and paste it into the editor.
3. Click **Run**.
4. **Expected Output:** `Success. No rows returned.`
   - Installs the hardened `handle_new_auth_user()` trigger with restricted `search_path`.
   - Safely adds `UNIQUE(user_id)` to `user_preferences` without data destruction.
   - Verifies explicit public SELECT on `story_articles` and `briefing_stories`.
   - Protects `public.users` with self-read-only policy.
   - Verifies strict `auth.uid() = user_id` across all personal data tables.

---

## 5. Final Row-Level Security (RLS) Policy Matrix

| Table | RLS Status | Permitted Roles | Policy Rule | Operation |
| :--- | :--- | :--- | :--- | :--- |
| **`public.users`** | **ENABLED** | `authenticated` | `auth.uid() = id` | `SELECT` |
| **`public.news_sources`** | **ENABLED** | `public` (anon + auth) | `USING (true)` | `SELECT` |
| **`public.articles`** | **ENABLED** | `public` (anon + auth) | `USING (true)` | `SELECT` |
| **`public.canonical_stories`**| **ENABLED** | `public` (anon + auth) | `USING (true)` | `SELECT` |
| **`public.story_articles`** | **ENABLED** | `public` (anon + auth) | `USING (true)` | `SELECT` |
| **`public.story_timeline_events`**| **ENABLED** | `public` (anon + auth)| `USING (true)` | `SELECT` |
| **`public.hourly_pulse_briefings`**| **ENABLED** | `public` (anon + auth)| `USING (true)` | `SELECT` |
| **`public.briefing_stories`** | **ENABLED** | `public` (anon + auth) | `USING (true)` | `SELECT` |
| **`public.perspective_analyses`**| **ENABLED** | `public` (anon + auth)| `USING (true)` | `SELECT` |
| **`public.cached_translations`**| **ENABLED** | `public` (anon + auth) | `USING (true)` | `SELECT` |
| **`public.cached_definitions`** | **ENABLED** | `public` (anon + auth) | `USING (true)` | `SELECT` |
| **`public.user_preferences`**| **ENABLED** | `authenticated` | `auth.uid() = user_id` | `ALL` (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) |
| **`public.saved_stories`** | **ENABLED** | `authenticated` | `auth.uid() = user_id` | `ALL` (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) |
| **`public.reading_history`** | **ENABLED** | `authenticated` | `auth.uid() = user_id` | `ALL` (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) |
| **`public.vocabulary_entries`**| **ENABLED** | `authenticated` | `auth.uid() = user_id` | `ALL` (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) |
| **`public.vocabulary_reviews`**| **ENABLED** | `authenticated` | Linked via `vocabulary_entries(user_id = auth.uid())` | `ALL` |
| **`public.ask_conversations`** | **ENABLED** | `authenticated` | `auth.uid() = user_id` | `ALL` |
| **`public.ask_messages`** | **ENABLED** | `authenticated` | Linked via `ask_conversations(user_id = auth.uid())` | `ALL` |
| **`public.notification_delivery_history`**| **ENABLED**| `authenticated`| `auth.uid() = user_id` | `ALL` |

*Note: All table mutations on editorial tables (`INSERT`, `UPDATE`, `DELETE`) are strictly reserved for the trusted server-side background ingestion worker using `SUPABASE_SERVICE_ROLE_KEY`.*

---

## 6. Verification Queries

After executing the two SQL scripts, run these verification queries in the Supabase SQL Editor:

### Test 1: Verify All Tables & RLS Status
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;
```
*Expected Result:* All tables show `rowsecurity = true`.

### Test 2: Verify Auth Trigger & Function Permissions
```sql
SELECT routine_name, security_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' AND routine_name = 'handle_new_auth_user';

SELECT trigger_name, event_object_table 
FROM information_schema.triggers 
WHERE event_object_schema = 'auth' AND event_object_table = 'users';
```
*Expected Result:* Function is `SECURITY DEFINER` and trigger is bound to `auth.users`.

### Test 3: Verify Public Read Access on Composite Tables
```sql
-- Both queries should succeed without permission errors
SELECT count(*) FROM public.story_articles;
SELECT count(*) FROM public.briefing_stories;
```

---

## 7. Rollback & Disaster Recovery Instructions

### Instant Zero-Downtime Rollback (App Level)
1. In `server/.env`, comment out or remove `SUPABASE_URL`:
   ```env
   # SUPABASE_URL=https://...
   ```
2. Restart the backend process:
   ```bash
   npm --prefix server run dev
   ```
3. Pulse immediately falls back to the local database in `server/data/pulse.db.json` with zero data loss.

### Clean Cloud Schema Reset (Database Level)
```sql
-- DANGER: Drops all Pulse public tables and triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_auth_user();

DROP TABLE IF EXISTS public.ai_request_logs CASCADE;
DROP TABLE IF EXISTS public.ingestion_job_history CASCADE;
DROP TABLE IF EXISTS public.notification_delivery_history CASCADE;
DROP TABLE IF EXISTS public.cached_definitions CASCADE;
DROP TABLE IF EXISTS public.cached_translations CASCADE;
DROP TABLE IF EXISTS public.vocabulary_reviews CASCADE;
DROP TABLE IF EXISTS public.vocabulary_entries CASCADE;
DROP TABLE IF EXISTS public.ask_messages CASCADE;
DROP TABLE IF EXISTS public.ask_conversations CASCADE;
DROP TABLE IF EXISTS public.reading_history CASCADE;
DROP TABLE IF EXISTS public.saved_stories CASCADE;
DROP TABLE IF EXISTS public.perspective_analyses CASCADE;
DROP TABLE IF EXISTS public.briefing_stories CASCADE;
DROP TABLE IF EXISTS public.hourly_pulse_briefings CASCADE;
DROP TABLE IF EXISTS public.story_timeline_events CASCADE;
DROP TABLE IF EXISTS public.story_articles CASCADE;
DROP TABLE IF EXISTS public.canonical_stories CASCADE;
DROP TABLE IF EXISTS public.articles CASCADE;
DROP TABLE IF EXISTS public.news_sources CASCADE;
DROP TABLE IF EXISTS public.user_preferences CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
```

---

## 8. Supabase Repository Layer Implementation Plan

When ready to transition application persistence from `pulse.db.json` to Supabase:

1. **Repository Interface:** Define a shared TypeScript interface `INewsRepository` matching all existing `database.ts` methods.
2. **Implement `SupabaseNewsRepository`:** Implement database queries using `@supabase/supabase-js` clients:
   - User-scoped queries (`vocabulary`, `preferences`, `saved_stories`) use the authenticated client or pass `auth.uid()`.
   - Ingestion jobs (`upsertStory`, `addArticle`, `addBriefing`) use `getSupabaseAdminClient()`.
3. **Repository Factory & Seamless Fallback:**
   ```typescript
   export const repository: INewsRepository = isSupabaseConfigured()
     ? new SupabaseNewsRepository()
     : new JsonFileRepository();
   ```
   If a network outage occurs or Supabase is unconfigured, the app falls back seamlessly to `JsonFileRepository` without breaking user sessions.
