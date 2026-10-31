# Pulse — Final Pre-Flight Review Before Supabase Cloud Execution
**Document Version:** 1.0.0  
**Repository Architecture Phase:** Phase 4.6 Final Review  
**Date:** October 30, 2026  
**Audience:** System Architect, Security Reviewer, Product Owner  

---

## Executive Summary

Before authorizing any live DDL migrations, database connections, or data synchronizations against the newly provisioned Supabase cloud project, this exhaustive pre-flight code review was conducted.

**Zero writes, SQL executions, or cloud database mutations have been performed.** The repository currently operates strictly in offline demo mode (`PULSE_STORAGE_MODE=local`), leaving the production database untouched.

All five critical architecture areas have been audited down to individual lines of code:
1. **Authenticated Client Isolation & Token Scoping:** Verified that User A and User B execute with request-scoped clients carrying their distinct JWTs without mutable shared state or service-role privilege escalation.
2. **Deterministic UUIDv5 Consistency:** Verified RFC 4122 compliance, namespace stability, foreign-key referential integrity, and transparent string-slug query compatibility.
3. **Database Schema Reconciliation:** Reconciled every repository method with the PostgreSQL schema across all tables, columns, foreign keys, and RLS policies; resolved the missing `push_subscriptions` table discrepancy.
4. **Migration Safety & Idempotency:** Verified that dry-run performs zero writes, all operations use deterministic `upsert`, local files are read-only, and unmapped guest records are safely excluded.
5. **Real Cloud Test Limitations & Minimal Live Test Plan:** Distinctly separated mocked/local tests from actual cloud requirements and established a minimal 9-point verification plan for post-approval execution.

---

## 1. Authenticated Supabase Client Isolation

### 1.1 Architectural Isolation Model

In a multi-tenant cloud application, row-level security (RLS) is evaluated by PostgreSQL using `auth.uid()`, `auth.jwt()`, and `auth.role()`. For PostgreSQL to apply RLS policies correctly:
1. **Authenticated user queries** must carry that user's verified Supabase JWT in the HTTP `Authorization: Bearer <token>` header.
2. **Anonymous public queries** must carry only the anon publishable key (`apikey: <anonKey>`) with no user bearer token, forcing `auth.uid()` to evaluate to `NULL`.
3. **Backend maintenance / ingestion queries** must use the `service_role` secret key which PostgreSQL recognizes as superuser/bypass-RLS.
4. **No mutable shared client state** can exist between concurrent HTTP requests.

### 1.2 Implementation Details in Code

#### A. Scoped Client Factory (`server/src/db/supabaseClient.ts`)
```typescript
export function createScopedSupabaseClient(token?: string): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const anonKey = process.env.SUPABASE_ANON_KEY || '';

  const globalHeaders: Record<string, string> = {
    'apikey': anonKey,
  };

  if (token) {
    globalHeaders['Authorization'] = `Bearer ${token}`;
  }

  return createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: globalHeaders,
    },
  });
}
```
**Key Security Guarantees:**
- **Immutable Request-Scoped Instances:** A fresh `SupabaseClient` instance is instantiated per token.
- **No Shared Session Leakage:** `persistSession: false` and `autoRefreshToken: false` guarantee that internal GoTrue/GotrueClient cookies, localStorage, or state caches are completely disabled.
- **Strict Header Isolation:** User A's `Authorization: Bearer <TokenA>` header lives exclusively in User A's client instance and cannot leak into User B's requests or anonymous requests.

#### B. Repository Client Resolution (`server/src/db/supabaseRepository.ts`)
```typescript
private getClient(tokenOrAdmin?: string | boolean, explicitAdmin = false): SupabaseClient {
  let token: string | undefined;
  let useAdmin = false;

  if (typeof tokenOrAdmin === 'string') {
    token = tokenOrAdmin;
    useAdmin = explicitAdmin;
  } else if (typeof tokenOrAdmin === 'boolean') {
    useAdmin = tokenOrAdmin;
  }

  // Trusted backend operations (RSS ingestion, metrics, perspectives)
  if (useAdmin) {
    return this.adminClient;
  }

  // Request carries an authenticated user JWT -> Immutable scoped client
  if (token) {
    return createScopedSupabaseClient(token);
  }

  // Public editorial read operations -> Anonymous client (auth.uid() = NULL)
  return this.anonClient;
}
```

#### C. Request Flow & Middleware Scoping (`server/src/db/supabaseClient.ts` & `server/src/routes/api.ts`)
1. **Client Request:** User arrives with `Authorization: Bearer <JWT>`.
2. **`authenticateUser` Middleware:**
   - Extracts bearer token.
   - Verifies cryptographic signature against Supabase Auth (`supabase.auth.getUser(token)`).
   - If verified, sets:
     ```typescript
     req.user = {
       id: data.user.id,
       email: data.user.email,
       role: data.user.role || 'authenticated',
       token, // Exact verified JWT attached to request context
     };
     ```
3. **Route Handlers:** Route handlers pass `req.user?.token` directly into repository calls:
   ```typescript
   // Example: Saved Stories
   const records = await repo.getSavedStories(userId, req.user?.token);
   // Example: Vocabulary
   const entry = await repo.addVocabulary(vocabData, req.user?.token);
   // Example: Preferences
   const saved = await repo.savePreferences(targetUserId, updates, req.user?.token);
   ```
4. **PostgREST Dispatch:** PostgREST receives `Authorization: Bearer <token>`, sets PostgreSQL session context (`SET LOCAL "request.jwt.claim.sub" = '<userId>'`), and evaluates RLS `auth.uid() = user_id`.

#### D. Threat & Isolation Matrix

| Client Type | Credentials Used | Authorization Header | PostgreSQL `auth.uid()` | RLS Enforced? | Allowed Operations |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **User A Scoped Client** | Anon Key + User A JWT | `Bearer <User A JWT>` | `User A UUID` | **Yes (Strict)** | Read/Write User A's preferences, saved stories, vocabulary, history, notifications. Public editorial reads. |
| **User B Scoped Client** | Anon Key + User B JWT | `Bearer <User B JWT>` | `User B UUID` | **Yes (Strict)** | Read/Write User B's preferences, saved stories, vocabulary, history, notifications. Public editorial reads. |
| **Anonymous Client** | Anon Key only | None | `NULL` | **Yes (Strict)** | Public editorial reads (`stories`, `sources`, `briefings`, `perspectives`). Rejected on all user tables. |
| **Service-Role Client** | Secret Service Key | `Bearer <service_role_key>` | `service_role` (Bypass) | **Bypassed** | Background RSS ingestion, source health updates, ingestion/AI telemetry, auth trigger profile sync. |

---

## 2. UUIDv5 Consistency & Mapping Verification

PostgreSQL schema relies on RFC 4122 UUID primary and foreign keys (`id UUID PRIMARY KEY`, `REFERENCES canonical_stories(id)`). The local JSON repository historically used string slugs (e.g. `src-the-hindu`, `story-17933612-isro-launch`).

### 2.1 Inspection of `stringToUuid()` (`server/src/db/uuidUtils.ts`)

```typescript
const PULSE_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

export function stringToUuid(name: string, namespace = PULSE_NAMESPACE): string {
  if (!name) return '00000000-0000-0000-0000-000000000000';
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(name)) {
    return name.toLowerCase();
  }
  const cleanNs = namespace.replace(/-/g, '');
  const nsBuffer = Buffer.from(cleanNs, 'hex');
  const nameBuffer = Buffer.from(name, 'utf8');
  const hash = crypto.createHash('sha1').update(Buffer.concat([nsBuffer, nameBuffer])).digest();

  hash[6] = (hash[6] & 0x0f) | 0x50; // Version 5
  hash[8] = (hash[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = hash.toString('hex').slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
```

### 2.2 Verification Findings

1. **Namespace Stability:** Uses the standard RFC 4122 fixed URL namespace `6ba7b810-9dad-11d1-80b4-00c04fd430c8`. It is hardcoded as a module-level constant and never dynamically generated.
2. **Deterministic Conversion:** SHA-1 hash calculation over `(namespaceBuffer + utf8(name))` is mathematically pure and idempotent ($f(x) = f(x)$ everywhere).
3. **Foreign-Key Alignment:**
   - In `migrateLocalToSupabase.ts`, every entity and its foreign key reference use the exact same call:
     - `storyUuid = stringToUuid(s.id)`
     - `articleUuid = stringToUuid(art.id || art.url)`
     - `sourceUuid = stringToUuid(art.sourceId)`
     - `story_articles` links: `story_id = storyUuid`, `article_id = articleUuid`
     - `story_timeline_events` links: `story_id = storyUuid`
     - `perspective_analyses` links: `story_id = storyUuid`
   - Referential integrity checks pass with zero orphaned foreign keys.
4. **Backward Compatibility & Local ID Resolution:**
   - In `SupabaseNewsRepository.getStoryById(idOrSlug)`:
     ```typescript
     if (isValidUuid(idOrSlug)) {
       query = query.eq('id', idOrSlug);
     } else {
       query = query.eq('id', stringToUuid(idOrSlug));
     }
     ```
   - Frontend components or cached bookmarks that pass human slugs continue to resolve cleanly to the correct database row.
5. **Collision Handling:**
   - RFC 4122 UUIDv5 has 122 bits of effective entropy. The probability of collision for $N = 10,000,000$ records is less than $1 \times 10^{-16}$.
   - Primary key constraints (`PRIMARY KEY (id)`) and unique index constraints (`UNIQUE (url)`, `UNIQUE (slug)`, `UNIQUE (story_id, article_id)`) guarantee that any unforeseen collision will immediately throw a deterministic database constraint error rather than silently corrupting data.

---

## 3. Database Schema Reconciliation

Every repository method in `INewsRepository` has been cross-referenced with `server/src/db/schema.sql` and `server/src/db/migrations/001_cloud_setup_and_security.sql`.

### 3.1 Comprehensive Reconciliation Table

| Repository Method | Target PostgreSQL Table | Required Columns | Foreign Key Constraints | Row Level Security (RLS) Policy | Implementation Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `ping()` | `public.canonical_stories` | `id` | None | `Public read on stories` (SELECT USING true) | **VERIFIED IN CODE** |
| `getDiagnostics()` | `canonical_stories`, `news_sources`, `articles`, `hourly_pulse_briefings` | `id` | None | Public read policies | **VERIFIED IN CODE** |
| `getStories()` | `public.canonical_stories` | `id, title, summary, why_it_matters, geographic_scope, country, state, category, importance_level, lead_image_url, first_reported_at, last_updated_at` | None | `Public read on stories` (SELECT USING true) | **VERIFIED IN CODE** |
| `getStoryById()` | `public.canonical_stories` + `story_articles` + `articles` + `story_timeline_events` | All story, article, and timeline event fields | `story_articles.story_id -> canonical_stories.id`, `story_articles.article_id -> articles.id`, `timeline.story_id -> canonical_stories.id` | `Public read on stories`, `Public read on articles`, `Public read on story_articles`, `Public read on timeline` | **VERIFIED IN CODE** |
| `saveStory(story)` *(Editorial)* | `public.canonical_stories` + `articles` + `story_articles` + `story_timeline_events` | Full canonical story schema | Identical foreign keys | Restricted to Service Role (`adminClient`) | **VERIFIED IN CODE** |
| `getSources()` | `public.news_sources` | `id, slug, name, url, rss_url, geographic_scope, country, state, category, is_enabled, is_official, trust_tier, health_status, consecutive_errors, last_error, last_fetched_at` | None | `Public read on sources` (SELECT USING true) | **VERIFIED IN CODE** |
| `getSourceById()` | `public.news_sources` | Identical source fields | None | `Public read on sources` | **VERIFIED IN CODE** |
| `updateSource()` | `public.news_sources` | Updatable source health / status fields | None | Restricted to Service Role (`adminClient`) | **VERIFIED IN CODE** |
| `getPerspective()` | `public.perspective_analyses` | `id, story_id, what_happened, why_it_matters, perspectives_in_favor, perspectives_against, affected_groups_concerns, expert_institutional_views, evidence_*, possible_consequences_*` | `perspective_analyses.story_id -> canonical_stories.id` | `Public read on perspectives` (SELECT USING true) | **VERIFIED IN CODE** |
| `savePerspective()` | `public.perspective_analyses` | Identical perspective fields | `story_id -> canonical_stories.id` | Restricted to Service Role (`adminClient`) | **VERIFIED IN CODE** |
| `getBriefings()` | `public.hourly_pulse_briefings` | `id, time_window_start, time_window_end, generated_at, scope, state, summary_overview, important_developments, what_changed_since_previous, source_count` | None | `Public read on briefings` (SELECT USING true) | **VERIFIED IN CODE** |
| `getLatestBriefing()` | `public.hourly_pulse_briefings` | Identical briefing fields | None | `Public read on briefings` | **VERIFIED IN CODE** |
| `addBriefing()` | `public.hourly_pulse_briefings` | Identical briefing fields | None | Restricted to Service Role (`adminClient`) | **VERIFIED IN CODE** |
| `getUserProfile()` | `public.users` | `id, email, display_name, avatar_url, preferred_language, is_admin, created_at, updated_at` | `users.id -> auth.users.id ON DELETE CASCADE` | `Users can read own profile` (`auth.uid() = id`) | **VERIFIED IN CODE** |
| `updateUserProfile()` | `public.users` | `display_name, avatar_url, preferred_language, updated_at` | `users.id -> auth.users.id` | Service-role backend updates only (strips `is_admin`, `id`, `role`) | **VERIFIED IN CODE** |
| `getPreferences()` | `public.user_preferences` | `id, user_id, news_reading_language, summary_length, show_bias_indicators, enable_tap_to_understand, notifications_enabled, quiet_hours_enabled, quiet_hours_start, quiet_hours_end, breaking_alerts, hourly_pulse_alerts, quiet_digest_time, theme` | `user_preferences.user_id -> public.users.id ON DELETE CASCADE` | `Users manage own preferences` (`auth.uid() = user_id`) | **VERIFIED IN CODE** |
| `savePreferences()` | `public.user_preferences` | Identical preference fields | `user_preferences.user_id -> public.users.id` | `Users manage own preferences` (`auth.uid() = user_id` WITH CHECK) | **VERIFIED IN CODE** |
| `getSavedStories()` | `public.saved_stories` | `id, user_id, story_id, personal_notes, saved_at` | `user_id -> users.id`, `story_id -> canonical_stories.id` | `Users manage own saved stories` (`auth.uid() = user_id`) | **VERIFIED IN CODE** |
| `saveStory(userId, storyId)` *(User Bookmark)* | `public.saved_stories` | `id, user_id, story_id, personal_notes, saved_at` | `user_id -> users.id`, `story_id -> canonical_stories.id` | `Users manage own saved stories` (`auth.uid() = user_id` WITH CHECK) | **VERIFIED IN CODE** |
| `removeSavedStory()` | `public.saved_stories` | `id, user_id, story_id` | `user_id -> users.id`, `story_id -> canonical_stories.id` | `Users manage own saved stories` (`auth.uid() = user_id`) | **VERIFIED IN CODE** |
| `recordReading()` | `public.reading_history` | `id, user_id, story_id, read_at, time_spent_seconds` | `user_id -> users.id`, `story_id -> canonical_stories.id` | `Users manage own reading history` (`auth.uid() = user_id` WITH CHECK) | **VERIFIED IN CODE** |
| `getReadingHistory()` | `public.reading_history` | Identical history fields | `user_id -> users.id`, `story_id -> canonical_stories.id` | `Users manage own reading history` (`auth.uid() = user_id`) | **VERIFIED IN CODE** |
| `getVocabulary()` | `public.vocabulary_entries` | `id, user_id, story_id, word, original_language, target_language, contextual_meaning, original_definition, pronunciation, part_of_speech, source_sentence, example_sentence, synonyms, personal_notes, mastery_level, review_count, next_review_due, created_at, updated_at` | `user_id -> users.id`, `story_id -> canonical_stories.id` | `Users manage own vocabulary` (`auth.uid() = user_id`) | **VERIFIED IN CODE** |
| `addVocabulary()` | `public.vocabulary_entries` | Identical vocabulary fields | `user_id -> users.id`, `story_id -> canonical_stories.id` | `Users manage own vocabulary` (`auth.uid() = user_id` WITH CHECK) | **VERIFIED IN CODE** |
| `updateVocabulary()` | `public.vocabulary_entries` | Updatable vocab fields (`mastery_level`, `next_review_due`, `personal_notes`) | `user_id -> users.id` | `Users manage own vocabulary` (`auth.uid() = user_id`) | **VERIFIED IN CODE** |
| `deleteVocabulary()` | `public.vocabulary_entries` | `id, user_id` | `user_id -> users.id` | `Users manage own vocabulary` (`auth.uid() = user_id`) | **VERIFIED IN CODE** |
| `addVocabularyReview()` | `public.vocabulary_reviews` | `id, vocabulary_id, recalled_successfully, recall_quality, review_mode, reviewed_at` | `vocabulary_reviews.vocabulary_id -> vocabulary_entries.id ON DELETE CASCADE` | `Users manage own vocabulary reviews` (EXISTS in `vocabulary_entries` where `user_id = auth.uid()`) | **VERIFIED IN CODE** |
| `getVocabularyReviews()`| `public.vocabulary_reviews` | Identical review fields | `vocabulary_id -> vocabulary_entries.id` | `Users manage own vocabulary reviews` | **VERIFIED IN CODE** |
| `getConversation()` | `public.ask_conversations` + `ask_messages` | `id, user_id, title, language, messages, created_at, updated_at` | `ask_conversations.user_id -> users.id` | `Users manage own conversations` (`auth.uid() = user_id`) | **VERIFIED IN CODE** |
| `saveConversation()` | `public.ask_conversations` + `ask_messages` | Identical conversation fields | `ask_conversations.user_id -> users.id` | `Users manage own conversations` (`auth.uid() = user_id` WITH CHECK) | **VERIFIED IN CODE** |
| `getNotifications()` | `public.notification_delivery_history` | `id, user_id, title, body, priority, story_id, read_at, created_at` | `user_id -> users.id`, `story_id -> canonical_stories.id` | `Users view own notifications` (`auth.uid() = user_id`) | **VERIFIED IN CODE** |
| `addNotification()` | `public.notification_delivery_history` | Identical notification fields | `user_id -> users.id` | Service Role (`adminClient`) | **VERIFIED IN CODE** |
| `markNotificationRead()`| `public.notification_delivery_history` | `id, user_id, read_at` | `user_id -> users.id` | `Users view own notifications` (`auth.uid() = user_id`) | **VERIFIED IN CODE** |
| `markAllNotificationsRead()`| `public.notification_delivery_history` | `user_id, read_at` | `user_id -> users.id` | `Users view own notifications` (`auth.uid() = user_id`) | **VERIFIED IN CODE** |
| `getPushSubscriptions()`| `public.push_subscriptions` | `id, user_id, endpoint, p256dh_key, auth_key, failure_count, created_at, last_delivered_at` | `push_subscriptions.user_id -> users.id ON DELETE CASCADE` | `Users manage own push subscriptions` (`auth.uid() = user_id`) | **VERIFIED IN CODE** |
| `addPushSubscription()`| `public.push_subscriptions` | Identical push fields | `user_id -> users.id` | `Users manage own push subscriptions` (`auth.uid() = user_id` WITH CHECK) | **VERIFIED IN CODE** |
| `updatePushSubscription()`| `public.push_subscriptions`| `endpoint, failure_count, last_delivered_at` | None | `Users manage own push subscriptions` / Service Role | **VERIFIED IN CODE** |
| `deletePushSubscription()`| `public.push_subscriptions`| `endpoint, user_id` | None | `Users manage own push subscriptions` / Service Role | **VERIFIED IN CODE** |
| `getCachedTranslation()`| Memory / `cached_translations` | `source_text_hash, language, translated_text` | None | `Public read on translations` | **VERIFIED IN CODE** |
| `getCachedDefinition()` | Memory / `cached_definitions` | `word, context_hash, language, definition` | None | `Public read on definitions` | **VERIFIED IN CODE** |
| `addIngestionLog()` | `public.ingestion_metrics` | `id, articles_fetched, stories_created, stories_updated, duration_ms, sources_polled, timestamp` | None | Service Role (`adminClient`) | **VERIFIED IN CODE** |
| `getIngestionLogs()` | `public.ingestion_metrics` | Identical metric fields | None | Admin authorization header (`X-Admin-Key`) | **VERIFIED IN CODE** |
| `addAILog()` | `public.ai_logs` | `id, provider, model, tokens_used, duration_ms, cost_usd, cached, operation, timestamp` | None | Service Role (`adminClient`) | **VERIFIED IN CODE** |
| `getAILogs()` | `public.ai_logs` | Identical AI log fields | None | Admin authorization header (`X-Admin-Key`) | **VERIFIED IN CODE** |

### 3.2 Reconciliation Discrepancy Resolution

- **Discrepancy Found:** The `push_subscriptions` table was supported in the domain repository and local database, but was missing from PostgreSQL schema definitions.
- **Resolution Applied:** Added `public.push_subscriptions` table, foreign key to `public.users(id)`, index on `user_id`, and explicit user-isolated RLS policy (`auth.uid() = user_id`) to both `server/src/db/schema.sql` and `server/src/db/migrations/001_cloud_setup_and_security.sql`.
- **Result:** Zero missing tables, columns, or foreign keys remain.

---

## 4. Migration Safety Verification

The migration engine (`server/src/db/migrateLocalToSupabase.ts`) was audited and executed in dry-run mode.

### 4.1 Verification Checklist

1. **Dry-Run Zero-Write Guarantee:**
   - Dry-run verification: `npm --prefix server run migrate:dry-run` was executed.
   - All network calls are strictly guarded behind `if (!dryRun && adminClient)`.
   - Result: 0 network writes, 0 mutations.
2. **Idempotency & Deduplication:**
   - Every insertion uses PostgREST `.upsert(row, { onConflict: ... })`.
   - News sources conflict on `slug`.
   - Stories conflict on deterministic UUID `id`.
   - Articles conflict on unique `url`.
   - Story-article joins conflict on compound `(story_id, article_id)`.
   - Timeline events conflict on deterministic UUID `id`.
   - Perspectives conflict on `story_id`.
   - Hourly briefings conflict on deterministic UUID `id`.
   - Re-running the migration 1 time or 100 times produces identical database state without duplicate rows.
3. **Foreign Key Integrity:**
   - Articles are inserted before `story_articles` joins.
   - Stories are inserted before timeline events, perspectives, and briefings.
   - Because `stringToUuid()` is deterministic, all foreign key UUIDs resolve cleanly without constraint violations.
4. **Error Handling & Batch Resilience:**
   - Every entity iteration is wrapped in individual `try / catch` blocks.
   - Errors are accumulated in `summary.errors` with contextual entity identifiers rather than aborting prematurely.
   - Resuming after an interruption resumes cleanly where it stopped.
5. **Local Data Immutability:**
   - `server/data/pulse.db.json` is accessed via `fs.readFileSync(DB_PATH, 'utf-8')`.
   - No `fs.writeFileSync` or delete calls exist anywhere in the migration script. Local data remains 100% untouched.
6. **Guest Record Isolation:**
   - 3 vocabulary records in `pulse.db.json` belong to `'guest-user-default'`.
   - The migration explicitly detects guest prefixes:
     ```typescript
     if (v.userId === 'guest-user-default' || v.userId?.startsWith('guest-')) {
       summary.skippedGuestRecords++;
     }
     ```
   - These records are intentionally **skipped** and **never** assigned to arbitrary authenticated users in the cloud.

### 4.2 Editorial vs Personal Data Partitioning

| Data Category | Tables Affected | Volume in Local DB | Migration Policy |
| :--- | :--- | :--- | :--- |
| **Public Editorial** | `news_sources`, `canonical_stories`, `articles`, `story_articles`, `story_timeline_events`, `perspective_analyses`, `hourly_pulse_briefings` | 18 sources, 2,444 stories, 2,459 articles, 2,449 timeline events, 6 perspectives, 8 briefings | Migrated to Supabase with service-role upsert. Public read access enabled via RLS. |
| **Personal User Data** | `users`, `user_preferences`, `saved_stories`, `reading_history`, `vocabulary_entries`, `vocabulary_reviews`, `ask_conversations`, `push_subscriptions` | 3 guest vocabulary items | **Excluded from cloud migration.** Local guest data stays in `pulse.db.json`. Cloud users create fresh authenticated profiles. |

---

## 5. Actual Cloud Test Limitations & Minimal Live Test Plan

### 5.1 Classification of Test Suite Capabilities

Mocked tests and local JSON tests **do not prove** that the live Supabase cloud instance is healthy. The following boundaries are strictly documented:

| Capability | Tested Locally / Mocked | Requires Actual Cloud Project |
| :--- | :---: | :---: |
| Local JSON CRUD operations | **LOCALLY TESTED** | No |
| Offline demo mode fallback | **LOCALLY TESTED** | No |
| Query builder parameter construction (`user_id` scoping) | **MOCKED ONLY** | No |
| Web Push VAPID payload signing | **LOCALLY TESTED** | No |
| Ingestion deduplication & timeline linking | **LOCALLY TESTED** | No |
| PostgreSQL TCP/TLS handshake & PostgREST connection | No | **BLOCKED BY CLOUD CREDENTIALS** |
| Real database schema application (`001_cloud_setup_and_security.sql`) | No | **BLOCKED BY CLOUD CREDENTIALS** |
| Real Supabase Auth JWT issuance & cryptographic signature verification | No | **BLOCKED BY CLOUD CREDENTIALS** |
| Database-level RLS enforcement across two authenticated tenants | No | **BLOCKED BY CLOUD CREDENTIALS** |
| Auth trigger profile provisioning (`public.handle_new_auth_user()`) | No | **BLOCKED BY CLOUD CREDENTIALS** |
| Service-role bypass verification for background ingestion | No | **BLOCKED BY CLOUD CREDENTIALS** |

### 5.2 Minimal Live Test Plan (Post-Approval)

Once cloud credentials are confirmed and approval is granted, execute this exact minimal test sequence:

```
[Live Test 1] Connectivity Ping
  - Execute repo.ping() with SUPABASE_URL and SUPABASE_ANON_KEY.
  - Assert HTTP 200 response from PostgREST.

[Live Test 2] Public Editorial Read
  - Fetch /api/stories and /api/sources anonymously.
  - Verify records return with public RLS policies.

[Live Test 3] Authenticated Profile Creation
  - Create test user A (testuser_a@pulse.local) via Supabase Auth signup.
  - Verify auth trigger automatically inserts profile in public.users.

[Live Test 4] Preferences Persistence
  - User A updates preferred language ('te') and summary length.
  - Verify user_preferences row is saved and reloaded.

[Live Test 5] Saved Story Persistence
  - User A saves story UUID X with personal note.
  - Verify saved_stories row is queryable by User A.

[Live Test 6] Vocabulary Persistence & Review
  - User A saves word 'perspicacity' and records review quality 4.
  - Verify vocabulary_entries and vocabulary_reviews rows persist.

[Live Test 7] Two-User Cryptographic RLS Isolation
  - Create test user B (testuser_b@pulse.local).
  - User B attempts to GET /api/saved-stories and /api/vocabulary with User B's JWT.
  - Verify response returns 0 records (User A's records are completely invisible to User B).
  - Attempt direct SQL/PostgREST select for User A's user_id using User B's JWT; verify 0 rows returned.

[Live Test 8] Unauthorized Guest Access
  - Send unauthenticated request to /api/saved-stories and /api/preferences with no Bearer token.
  - Verify API returns HTTP 401 Unauthorized.

[Live Test 9] Service-Role Background Ingestion
  - Trigger /api/admin/trigger-ingestion with X-Admin-Key.
  - Verify ingestion writes new stories using service-role client while anonymous client cannot write.
```

---

## 6. Pre-Flight Verification Matrix

| Checklist Item | Scope / Method | Status |
| :--- | :--- | :--- |
| **Client Scoping** | `createScopedSupabaseClient()` attaches `Authorization: Bearer <JWT>` | **VERIFIED IN CODE** |
| **Token Forwarding** | `api.ts` passes `req.user?.token` across all 20 user routes | **VERIFIED IN CODE** |
| **Shared Client State** | `persistSession: false`, no shared headers or tokens | **VERIFIED IN CODE** |
| **Service Role Isolation**| `SUPABASE_SERVICE_ROLE_KEY` used solely for backend operations | **VERIFIED IN CODE** |
| **UUIDv5 Determinism** | SHA-1 RFC 4122 namespace conversion in `uuidUtils.ts` | **LOCALLY TESTED** |
| **FK Consistency** | Identical UUID mapping across stories, articles, timeline, perspectives | **LOCALLY TESTED** |
| **Schema Completeness** | All 42 repository methods map to tables/columns/policies | **VERIFIED IN CODE** |
| **Push Subscriptions** | Added missing `push_subscriptions` table & user RLS | **VERIFIED IN CODE** |
| **Dry-Run Safety** | `npm --prefix server run migrate:dry-run` performs 0 writes | **LOCALLY TESTED** |
| **Migration Idempotency** | All tables use `upsert` with explicit `onConflict` keys | **VERIFIED IN CODE** |
| **Guest Data Protection** | Guest records skipped; zero unmapped guest assignments | **LOCALLY TESTED** |
| **Local DB Immutability**| `pulse.db.json` opened read-only; no local writes during migration | **LOCALLY TESTED** |
| **Local Demo Test Suite**| 33 passed, 0 failed, 1 skipped (live PostgreSQL test) | **LOCALLY TESTED** |
| **TypeScript Build** | Zero type errors across server (`tsc`) and client (`vite build`) | **LOCALLY TESTED** |
| **Live DB Connectivity** | Real network connection to Supabase cloud database | **BLOCKED BY CLOUD CREDENTIALS** |
| **Live RLS Verification** | Engine-level PostgreSQL evaluation of two user JWTs | **BLOCKED BY CLOUD CREDENTIALS** |

---

## 7. Conclusions & Authorization Questions

### 1. Is the schema safe to apply?
**Yes.**  
The schema (`001_cloud_setup_and_security.sql`) enforces strict RLS across all tables, isolates users cryptographically by `auth.uid() = user_id`, protects `public.users` against privilege escalation, and contains no shared-guest backdoors or destructive drop commands.

### 2. Is the repository safe to connect?
**Yes.**  
`SupabaseNewsRepository` now instantiates immutable request-scoped Supabase clients carrying verified user JWTs for user queries, uses the anonymous client for public editorial reads, and reserves the service-role client for background ingestion and administrative tasks.

### 3. Is the migration safe to execute?
**Yes.**  
`migrateLocalToSupabase.ts` was verified in dry-run mode (2,444 stories, 2,459 articles, 18 sources, 8 briefings, 6 perspectives, 0 errors). It uses idempotent `upsert` operations, preserves local files untouched, and deliberately skips unmapped guest records to avoid data contamination.

### 4. What exact steps require user approval?
Before any production execution begins, explicit user authorization is required for:
1. **Executing DDL in Supabase Cloud:** Applying `server/src/db/migrations/001_cloud_setup_and_security.sql` via the Supabase Dashboard SQL Editor or Supabase CLI.
2. **Executing Initial Editorial Migration:** Running `npm --prefix server run migrate` with valid `SUPABASE_SERVICE_ROLE_KEY` to populate editorial stories and sources.
3. **Switching Application Storage Mode:** Changing `PULSE_STORAGE_MODE=local` to `PULSE_STORAGE_MODE=cloud` in `server/.env`.
4. **Running Live Verification Tests:** Running the 9-point live cloud test suite (`LIVE_SUPABASE_TEST=true npm --prefix server run test`).

### 5. What risks remain?
- **Invalid Cloud Credentials:** If `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_URL` in `server/.env` are incorrect, the server will refuse to connect. *Mitigation:* Repository Factory throws clear descriptive errors immediately rather than silently failing or corrupting data.
- **Unapplied Migration SQL:** If the repository is switched to cloud mode before `001_cloud_setup_and_security.sql` is run in the Supabase SQL editor, PostgREST will return table-not-found errors (HTTP 404). *Mitigation:* Migration SQL must be applied prior to setting `PULSE_STORAGE_MODE=cloud`.
- **Network Latency / Outages:** Cloud requests introduce network dependency. *Mitigation:* Repository returns explicit HTTP 503/diagnostic errors without attempting silent fallback to local storage.

---

**Execution State:** Awaiting explicit user approval before touching the live database.
