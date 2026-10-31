# Pulse — Supabase Integration Test Report

> **Document Version:** 1.0.0  
> **Test Framework:** Vitest 2.1.8 / Supertest 7.0.0  
> **Target:** Dual Repository Architecture (`INewsRepository`)  
> **Status:** All Integration Tests Verified (33 Passed, 0 Failed, 1 Conditionally Skipped)  

---

## 1. Test Suite Summary & Execution Metrics

Pulse utilizes an automated integration test suite ensuring data integrity, strict user tenant isolation, news ingestion stability, and graceful resilience across both storage modes.

```
 RUN  v2.1.9 D:/Aashrith/Webs/Plause/server

 ✓ src/tests/repository.test.ts (15 tests | 1 skipped) 70ms
 ✓ src/tests/api.test.ts (19 tests) 21434ms

 Test Files  2 passed (2)
      Tests  33 passed | 1 skipped (34)
   Duration  22.69s (tests 21.50s)
```

---

## 2. Test Layer Categorization & Distinction

Per Phase 4.6 engineering guidelines, the test suites explicitly distinguish between **local demo tests**, **mocked/simulated Supabase tests**, and **actual live cloud tests** to eliminate ambiguity:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PULSE TEST SUITE MATRIX                           │
├──────────────────────────┬──────────────────────────┬───────────────────────┤
│    [LOCAL-MODE-TESTS]    │ [MOCKED-SUPABASE-TESTS]  │ [ACTUAL-SUPABASE-TESTS]
│                          │                          │                       │
│ Real local persistence   │ Unit & query isolation   │ Live PostgreSQL tests │
│ testing against          │ tests verifying RLS,     │ executing directly    │
│ pulse.db.json using      │ tenant security, and     │ against cloud schema  │
│ JsonFileRepository       │ outage handling          │ (LIVE_SUPABASE_TEST)  │
└──────────────────────────┴──────────────────────────┴───────────────────────┘
```

---

## 3. Detailed Test Coverage by Domain

### 3.1 Local Demo Mode Preservation (`[LOCAL-MODE-TESTS]`)
Ensures Pulse operates out-of-the-box with zero regressions when cloud credentials are unconfigured:
- **`ping()` & `getDiagnostics()`**: Reports `mode: 'local'`, `isConnected: true`, and verifies story and source counts > 0.
- **Editorial Sources & Stories**: Verifies source retrieval (The Hindu, PIB) and canonical stories with pagination.
- **User Preferences CRUD**: Persists custom reading language (`te`), summary length (`detailed`), and theme (`dark`).
- **Saved Story CRUD**: Saves story with personal notes, lists saved stories, and deletes saved records cleanly.
- **Vocabulary CRUD & Review History**: Creates vocabulary entry, updates mastery, logs review session with recall quality, verifies review log, and deletes entry.
- **Reading History Tracking**: Records story reading time (120s) and retrieves reading logs.
- **Ask Conversation Persistence**: Stores multi-turn conversation with user and assistant messages, citations, and reloads it intact.

### 3.2 Repository Factory & Governance
- **Default Resolution**: Resolves `JsonFileRepository` when `PULSE_STORAGE_MODE` is unset or set to `local`.
- **Strict Error Policy**: Throws a fatal exception when `PULSE_STORAGE_MODE=cloud` and Supabase credentials are missing or invalid. **Strictly verifies that no silent fallback to local storage occurs.**
- **Deterministic UUIDv5**: Verifies that `stringToUuid()` converts arbitrary string IDs (`src-the-hindu`, `story-...`) to standard RFC 4122 UUIDs deterministically across runs.

### 3.3 Security & Multi-Tenant Row Isolation (`[MOCKED-SUPABASE-TESTS]`)
- **Unauthorized Guest Access Rejection**: In cloud mode, `requireAuth` inspects `req.user.isGuest` and rejects unauthenticated personal persistent requests with `HTTP 401 Unauthorized`.
- **Guest Demo Allowance in Local Mode**: In local mode, `requireAuth` allows guest sessions to read and write demo records in `pulse.db.json`.
- **User Tenancy Scoping**: Verifies that queries for User A (`user-aaaaaaaa-...`) explicitly attach `.eq('user_id', userA)` and cannot return or mutate User B's records.

### 3.4 Database Outage & Error Handling
- **Graceful Failure Propagation**: Simulates a `503 Service Unavailable` database network drop. Verifies that `SupabaseNewsRepository` bubbles the error cleanly with diagnostic context and **does NOT switch to local storage**.

### 3.5 End-to-End API Routes (`api.test.ts`)
- **Health Check (`GET /api/health`)**: Returns system diagnostics, active storage mode, AI integration status, and supported Indian states.
- **State Filtering (`GET /api/stories?state=Telangana`)**: Filters canonical stories by state boundary.
- **Tap-to-Understand (`POST /api/dictionary/context`)**: Returns contextual definition and part-of-speech in reader's language.
- **Catch Me Up (`GET /api/catch-me-up?timeframe=24h`)**: Returns delta changes (new stories, material updates, unresolved threads).
- **Multilingual Translation (`POST /api/translate`)**: Translates headlines to Telugu and Hindi with full unicode character preservation.
- **Quiet Notification Rate Limiter**: Enforces the 3-hour quiet interval and limits notifications to 2 per rolling window.
- **Admin Security**: Denies unauthenticated mutations without `X-Admin-Key`; permits authorized ingestion triggers.
- **Scheduler Mutex Lock**: Verifies concurrency lock prevents overlapping ingestion runs.

### 3.6 Live Cloud Persistence (`[ACTUAL-SUPABASE-TESTS]`)
- Marked conditionally skipped by default (`LIVE_SUPABASE_TEST=false`) to ensure no false claims of cloud test execution before user provides approval to execute SQL and apply cloud migrations.

---

## 4. Test Verification Matrix

| Test Scenario | Test Layer | Expected Behavior | Result |
| :--- | :--- | :--- | :---: |
| **Local Connectivity Ping** | `[LOCAL-MODE]` | Returns `true` with valid source count | **PASS** |
| **Story Pagination** | `[LOCAL-MODE]` | Returns requested limit/offset slice | **PASS** |
| **Preference Persistence** | `[LOCAL-MODE]` | Updates and reloads without loss | **PASS** |
| **Saved Story CRUD** | `[LOCAL-MODE]` | Add, verify, remove lifecycle | **PASS** |
| **Vocabulary Recall Logging** | `[LOCAL-MODE]` | Stores recall quality and review timestamp | **PASS** |
| **Ask Conversation Storage** | `[LOCAL-MODE]` | Persists messages with citations | **PASS** |
| **Cloud Credential Check** | Factory | Throws fatal error if credentials missing | **PASS** |
| **No Silent Local Fallback** | Factory | Rejects silent fallback on cloud failure | **PASS** |
| **UUIDv5 Determinism** | Utility | Consistent RFC 4122 output | **PASS** |
| **Guest Cloud Rejection** | `[MOCKED-SUPABASE]` | Returns HTTP 401 for guest writes | **PASS** |
| **Tenant Query Scoping** | `[MOCKED-SUPABASE]` | Scopes all personal queries by `auth.uid()` | **PASS** |
| **Database Outage Handling** | `[MOCKED-SUPABASE]` | Returns 503 error; preserves data | **PASS** |
| **Live Ingestion Ingestion** | Full API | Ingests 320 articles into canonical stories | **PASS** |
| **Admin Authorization** | Full API | Rejects missing `X-Admin-Key` with 403 | **PASS** |
| **Scheduler Concurrency Lock** | Scheduler | Prevents simultaneous ingestion execution | **PASS** |
| **Live Supabase Ping** | `[ACTUAL-SUPABASE]` | Skipped until live migration approved | **SKIPPED** |
