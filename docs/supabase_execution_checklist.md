# Pulse — Supabase Live Execution Checklist & Runbook

**Version:** 1.0.0  
**Phase:** Phase 4.6 Final Production Execution  
**Date:** October 30, 2026  
**Status:** READY FOR AUTHORIZATION (Awaiting explicit user approval before execution)

---

## 1. Overview & Safety Guarantees

This document specifies the exact, step-by-step procedure for executing Pulse's initial database migration to Supabase Cloud PostgreSQL.

### Core Safety Guarantees
1. **Local Data Immutability:** `server/data/pulse.db.json` is read strictly in read-only mode during migration. It will **never** be deleted, overwritten, or modified.
2. **Offline Fallback Preservation:** The application defaults to offline demo mode (`PULSE_STORAGE_MODE=local`). Reverting from cloud mode back to local mode requires only one configuration line change and takes under 5 seconds.
3. **Zero Automated Storage Switch:** Running migration scripts **does not** automatically switch `PULSE_STORAGE_MODE`. The switch requires an explicit, separate configuration step.
4. **Idempotent Cloud DDL & DML:** Both SQL scripts and migration commands can be re-executed multiple times without creating duplicate tables, policies, constraints, or duplicate rows.
5. **Guest Data Quarantine:** Guest records (`guest-user-default`) in the local database are explicitly skipped and never migrated into cloud user accounts.

---

## 2. Required Environment Variables

Configure `server/.env` (copied from `server/.env.example`) with the credentials from your Supabase project dashboard:

```ini
# ============================================================================
# PULSE SERVER ENVIRONMENT CONFIGURATION (server/.env)
# ============================================================================

PORT=3001
NODE_ENV=production
CLIENT_URL=http://localhost:5173
TIMEZONE=Asia/Kolkata

# 1. STORAGE MODE (Keep 'local' until Step 5 of the execution plan!)
PULSE_STORAGE_MODE=local

# 2. SUPABASE CREDENTIALS (From Supabase Dashboard -> Project Settings -> API)
# API URL (e.g., https://xyzcompany.supabase.co)
SUPABASE_URL=https://your-project-id.supabase.co

# Project API Anon Key (Supports both legacy eyJ... and new sbp_... formats)
SUPABASE_ANON_KEY=your-supabase-anon-key

# Project Service Role Secret Key (Supports legacy eyJ... and new sbs_... formats)
# WARNING: Strictly server-side secret! NEVER expose in browser or client code!
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# 3. ADMINISTRATIVE SECURITY
# Must be rotated to a cryptographically secure random string before production!
# Generate with: openssl rand -hex 32
ADMIN_API_KEY=your-rotated-32-byte-hex-admin-secret

# 4. WEB PUSH (VAPID) KEYS
VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
VAPID_SUBJECT=mailto:admin@pulse.news
```

---

## 3. SQL Execution Order & Dependency Analysis

Pulse uses two SQL scripts:
1. `server/src/db/schema.sql` (Base Relational Schema)
2. `server/src/db/migrations/001_cloud_setup_and_security.sql` (Security Hardening & Constraints)

### Dependency & Hierarchy Analysis
- `001_cloud_setup_and_security.sql` contains `ALTER TABLE ...` statements that modify table constraints and RLS policies on tables created by `schema.sql`.
- `001_cloud_setup_and_security.sql` **depends directly** on the base tables created in `schema.sql`.
- `schema.sql` has also been updated to contain the hardened triggers and user-scoped RLS policies. Running both scripts in order is 100% idempotent and non-destructive.

### Exact Safe Execution Order

```
┌──────────────────────────────────────────────────────────┐
│ Step 1: Base Relational Schema Application               │
│ File: server/src/db/schema.sql                           │
│ Method: Supabase Dashboard -> SQL Editor -> Run          │
└────────────────────────────┬─────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────┐
│ Step 2: Cloud Setup & Security Hardening                 │
│ File: server/src/db/migrations/                          │
│       001_cloud_setup_and_security.sql                   │
│ Method: Supabase Dashboard -> SQL Editor -> Run          │
└──────────────────────────────────────────────────────────┘
```

### Detailed Object Creation Breakdown

| Step | Script | Objects Created / Applied |
| :--- | :--- | :--- |
| **Step 1** | `server/src/db/schema.sql` | • Extensions: `uuid-ossp`, `pg_trgm`<br>• Tables: `users`, `user_preferences`, `news_sources`, `articles`, `canonical_stories`, `story_articles`, `story_timeline_events`, `hourly_pulse_briefings`, `briefing_stories`, `perspective_analyses`, `saved_stories`, `reading_history`, `ask_conversations`, `ask_messages`, `vocabulary_entries`, `vocabulary_reviews`, `cached_translations`, `cached_definitions`, `notification_delivery_history`, `ingestion_job_history`, `ai_request_logs`, `push_subscriptions`<br>• Indexes: URLs, timestamps, scopes, user foreign keys<br>• Initial RLS enablement on all 22 tables<br>• Public read policies on editorial tables<br>• Cryptographic user policies (`auth.uid() = user_id`)<br>• `public.handle_new_auth_user()` function & `on_auth_user_created` trigger |
| **Step 2** | `001_cloud_setup_and_security.sql` | • Idempotently validates and enforces NOT NULL and UNIQUE constraints in safe `DO $$ ... $$` blocks without deleting rows<br>• Re-applies hardened `handle_new_auth_user()` function with `SET search_path = public, pg_temp` and hardcoded non-admin defaults<br>• Re-applies all public read and user-isolated RLS policies with `DROP POLICY IF EXISTS`<br>• Verifies `push_subscriptions` table and policy |

---

## 4. Editorial Data Migration Procedure

Editorial data (canonical stories, articles, timeline events, news sources, briefings, perspectives) will be copied from `pulse.db.json` to Supabase PostgreSQL using deterministic UUIDv5 primary keys.

### 4.1 Step 4A — Dry-Run Simulation (Zero Writes)
Run the dry-run simulation to verify payload parsing and foreign key matching:

```bash
# From workspace root
npm run migrate:dry-run

# Or directly in server directory
npm --prefix server run migrate:dry-run
```

**Expected Dry-Run Output:**
```
======================================================
PULSE DATA MIGRATION: JSON -> SUPABASE POSTGRESQL
Mode: DRY-RUN (Simulated — No database writes)
Source: .../server/data/pulse.db.json
======================================================
[1/7] Migrating 18 news sources...
[2/7] Migrating 2444 canonical stories...
[3/7] Migrating 6 perspective analyses...
[4/7] Migrating 8 hourly briefings...
[5/7] Reviewing 3 vocabulary entries for guest ownership safety...
======================================================
MIGRATION SUMMARY RESULT:
- Mode: DRY RUN
- News Sources: 18
- Canonical Stories: 2444
- Articles: 2459
- Story Articles Linked: 2459
- Timeline Events: 2449
- Hourly Briefings: 8
- Perspectives: 6
- Skipped Unmapped Guest Records: 3 (Preserved in pulse.db.json)
- Total Errors: 0
======================================================
```

### 4.2 Step 4B — Live Data Migration Execution
Once the SQL schema has been executed in the Supabase SQL editor and `server/.env` has valid credentials, execute the live migration:

```bash
# From workspace root
npm run migrate

# Or directly in server directory
npm --prefix server run migrate
```

**Guarantees During Migration:**
- Does **not** change `PULSE_STORAGE_MODE`.
- Does **not** delete or alter `server/data/pulse.db.json`.
- Uses PostgREST `.upsert(row, { onConflict: ... })` for idempotent insertion.
- Skips the 3 guest vocabulary records so they are never assigned to cloud users.

---

## 5. Cloud Mode Activation Procedure

Only after Step 3 (SQL schema applied) and Step 4 (Data migrated) have completed successfully:

1. Open `server/.env`.
2. Update the storage mode setting:
   ```ini
   PULSE_STORAGE_MODE=cloud
   ```
3. Restart the server process:
   ```bash
   npm run dev
   ```
4. Verify the startup logs output:
   ```
   [RepositoryFactory] Initializing Supabase Cloud Repository...
   [SupabaseRepository] Initialized with Supabase URL: https://your-project-id.supabase.co
   [Repository] Connected to cloud Supabase instance.
   ```

---

## 6. Live Verification Protocol

Execute this minimal live test sequence to verify end-to-end functionality.

### Verification Step 1: Health & Connectivity Ping
```bash
curl -X GET http://localhost:3001/api/health
```
**Expected Result:**
```json
{
  "status": "healthy",
  "storageMode": "cloud",
  "database": {
    "connected": true,
    "storageMode": "cloud",
    "storiesCount": 2444,
    "sourcesCount": 18
  }
}
```

---

### Verification Step 2: Anonymous Public Editorial Reads
Verify that unauthenticated visitors can read news without a token:
```bash
curl -X GET http://localhost:3001/api/stories?limit=2
curl -X GET http://localhost:3001/api/sources
```
**Expected Result:** HTTP 200 with story and source records returned.

---

### Verification Step 3: Two Test Accounts Creation
Create two test accounts via Supabase Auth signup:

**User A Signup:**
```bash
curl -X POST 'https://<YOUR_SUPABASE_URL>/auth/v1/signup' \
  -H 'apikey: <YOUR_SUPABASE_ANON_KEY>' \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "test_user_a@pulse.local",
    "password": "Password123!Secure",
    "data": { "full_name": "Test User Alpha", "state": "Telangana" }
  }'
```
*Note the returned `access_token` as `TOKEN_A` and `id` as `UUID_A`.*

**User B Signup:**
```bash
curl -X POST 'https://<YOUR_SUPABASE_URL>/auth/v1/signup' \
  -H 'apikey: <YOUR_SUPABASE_ANON_KEY>' \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "test_user_b@pulse.local",
    "password": "Password123!Secure",
    "data": { "full_name": "Test User Beta", "state": "Maharashtra" }
  }'
```
*Note the returned `access_token` as `TOKEN_B` and `id` as `UUID_B`.*

---

### Verification Step 4: Auth Trigger Verification
Verify that the `on_auth_user_created` trigger provisioned user profiles in `public.users`:
```bash
curl -X GET http://localhost:3001/api/users/profile \
  -H "Authorization: Bearer $TOKEN_A"
```
**Expected Result:**
```json
{
  "id": "<UUID_A>",
  "email": "test_user_a@pulse.local",
  "fullName": "Test User Alpha",
  "isAdmin": false,
  "isGuest": false
}
```

---

### Verification Step 5: User A Private Data Persistence
Create private records for User A:

**A. Save User Preferences:**
```bash
curl -X POST http://localhost:3001/api/preferences \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json" \
  -d '{"newsReadingLanguage":"te","summaryLength":"detailed"}'
```

**B. Save a Story:**
```bash
# Get a story ID first
STORY_ID=$(curl -s http://localhost:3001/api/stories?limit=1 | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

curl -X POST http://localhost:3001/api/saved-stories \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json" \
  -d "{\"storyId\":\"$STORY_ID\",\"personalNotes\":\"User A confidential research note\"}"
```

**C. Save a Vocabulary Word:**
```bash
curl -X POST http://localhost:3001/api/vocabulary \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json" \
  -d '{
    "word": "perspicacity",
    "sourceSentence": "The geopolitical analyst demonstrated great perspicacity.",
    "contextualMeaning": "Keen insight and understanding"
  }'
```

---

### Verification Step 6: Two-User Cryptographic RLS Isolation Check
Query User A's data using **User B's token** (`TOKEN_B`):

**A. Attempt to read saved stories with User B's token:**
```bash
curl -X GET http://localhost:3001/api/saved-stories \
  -H "Authorization: Bearer $TOKEN_B"
```
**Expected Result:**
```json
{
  "savedStories": [],
  "count": 0
}
```
*(User A's saved story is completely invisible to User B).*

**B. Attempt to read vocabulary with User B's token:**
```bash
curl -X GET http://localhost:3001/api/vocabulary \
  -H "Authorization: Bearer $TOKEN_B"
```
**Expected Result:**
```json
{
  "vocabulary": [],
  "count": 0
}
```
*(User A's vocabulary is completely invisible to User B).*

**C. Attempt direct PostgREST exploit for User A's data with User B's token:**
```bash
curl -X GET "https://<YOUR_SUPABASE_URL>/rest/v1/saved_stories?user_id=eq.<UUID_A>" \
  -H "apikey: <YOUR_SUPABASE_ANON_KEY>" \
  -H "Authorization: Bearer $TOKEN_B"
```
**Expected Result:** `[]` (HTTP 200, 0 rows returned — PostgreSQL kernel RLS drops the rows).

---

### Verification Step 7: Unauthorized Guest Access Rejection
Verify that unauthenticated requests to private endpoints return HTTP 401:
```bash
curl -i -X GET http://localhost:3001/api/saved-stories
```
**Expected Result:**
```http
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{
  "error": "Authentication required",
  "message": "A valid Supabase authentication session is required to access personal cloud features in cloud mode."
}
```

---

### Verification Step 8: Persistence Across Session Termination
1. Discard `TOKEN_A` (simulating logout).
2. Obtain a new session token via login:
   ```bash
   NEW_TOKEN_A=$(curl -s -X POST 'https://<YOUR_SUPABASE_URL>/auth/v1/token?grant_type=password' \
     -H 'apikey: <YOUR_SUPABASE_ANON_KEY>' \
     -H 'Content-Type: application/json' \
     -d '{
       "email": "test_user_a@pulse.local",
       "password": "Password123!Secure"
     }' | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
   ```
3. Retrieve saved stories and vocabulary using `NEW_TOKEN_A`:
   ```bash
   curl -X GET http://localhost:3001/api/saved-stories -H "Authorization: Bearer $NEW_TOKEN_A"
   curl -X GET http://localhost:3001/api/vocabulary -H "Authorization: Bearer $NEW_TOKEN_A"
   ```
   **Expected Result:** User A's confidential note and word "perspicacity" persist and return intact.

---

### Verification Step 9: Test Accounts Cleanup
After verification is complete, purge the test accounts:

1. **Via Supabase Dashboard:**
   - Navigate to **Authentication** -> **Users**.
   - Select `test_user_a@pulse.local` and `test_user_b@pulse.local`.
   - Click **Delete Users**.
   - Foreign key constraints (`ON DELETE CASCADE`) will automatically purge all associated records in `public.users`, `user_preferences`, `saved_stories`, `vocabulary_entries`, `reading_history`, and `ask_conversations`.

2. **Or via Supabase Admin API:**
   ```bash
   curl -X DELETE "https://<YOUR_SUPABASE_URL>/auth/v1/admin/users/<UUID_A>" \
     -H "apikey: <YOUR_SUPABASE_SERVICE_ROLE_KEY>" \
     -H "Authorization: Bearer <YOUR_SUPABASE_SERVICE_ROLE_KEY>"

   curl -X DELETE "https://<YOUR_SUPABASE_URL>/auth/v1/admin/users/<UUID_B>" \
     -H "apikey: <YOUR_SUPABASE_SERVICE_ROLE_KEY>" \
     -H "Authorization: Bearer <YOUR_SUPABASE_SERVICE_ROLE_KEY>"
   ```

---

## 7. Rollback Procedure

If any unexpected error occurs during migration or live testing:

### Instant Application Rollback (Under 5 seconds)
1. Open `server/.env`.
2. Change the storage mode back to local:
   ```ini
   PULSE_STORAGE_MODE=local
   ```
3. Restart the server (`npm run dev`).
4. **Verification:** The server instantly resumes reading and writing to `server/data/pulse.db.json`. Zero data was lost or modified.

### Cloud Database Clean Slate (Optional)
If you wish to completely wipe the cloud database before re-attempting migration:
1. Open the Supabase Dashboard -> **SQL Editor**.
2. Run the clean-slate script:
   ```sql
   DROP SCHEMA public CASCADE;
   CREATE SCHEMA public;
   GRANT ALL ON SCHEMA public TO postgres;
   GRANT ALL ON SCHEMA public TO public;
   GRANT ALL ON SCHEMA public TO anon;
   GRANT ALL ON SCHEMA public TO authenticated;
   GRANT ALL ON SCHEMA public TO service_role;
   ```
3. Re-run Step 3 (SQL schema execution).

---

## 8. Final Approval Gate

Execution will remain paused until explicit user approval is granted for:
- [ ] 1. Applying SQL schema files to Supabase Cloud SQL Editor.
- [ ] 2. Executing `npm --prefix server run migrate` with valid credentials.
- [ ] 3. Setting `PULSE_STORAGE_MODE=cloud` in `server/.env`.
