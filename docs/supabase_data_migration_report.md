# Pulse — Supabase Data Migration Report

> **Document Version:** 1.0.0  
> **Source Repository:** `server/data/pulse.db.json`  
> **Target Database:** Supabase PostgreSQL  
> **Utility Script:** `server/src/db/migrateLocalToSupabase.ts`  
> **Status:** Dry-Run Verified & Awaiting Live Migration Approval  

---

## 1. Migration Overview & Objective

To enable a seamless transition from local demonstration storage to production Supabase persistence, Pulse includes an automated, idempotent migration utility: `migrateLocalToSupabase.ts`.

The migration transfers pre-seeded editorial news sources, canonical stories, verified articles, timeline events, hourly briefings, and perspective desk analyses from `pulse.db.json` into PostgreSQL while enforcing relational integrity and strict user tenancy.

### Execution Command
```bash
# 1. Preview migration in dry-run mode (safe, zero writes):
npm --prefix server run migrate:dry-run

# 2. Live migration (only executed after user approval and schema application):
npm --prefix server run migrate:cloud
```

---

## 2. Dry-Run Verification Results

A complete dry-run validation was executed against the active `pulse.db.json` dataset. The simulation processed all records, resolved foreign-key graphs, converted identifiers to RFC 4122 UUIDv5, and verified schema alignment.

### Verified Record Counts
| Data Entity | Source Count in JSON | Prepared for PostgreSQL | Status | Target Table |
| :--- | :---: | :---: | :--- | :--- |
| **News Sources** | 18 | 18 | Ready for Upsert | `public.news_sources` |
| **Canonical Stories** | 2,211 | 2,211 | Ready for Upsert | `public.canonical_stories` |
| **Articles** | 2,225 | 2,225 | Ready for Upsert | `public.articles` |
| **Story-Article Links** | 2,225 | 2,225 | Ready for Upsert | `public.story_articles` |
| **Story Timeline Events** | 2,216 | 2,216 | Ready for Upsert | `public.story_timeline_events` |
| **Hourly Briefings** | 8 | 8 | Ready for Upsert | `public.hourly_pulse_briefings` |
| **Perspective Desk** | 6 | 6 | Ready for Upsert | `public.perspective_analyses` |
| **Unmapped Guest Data** | 3 | 0 (Skipped) | **Preserved Locally** | `public.vocabulary_entries` |
| **Migration Errors** | 0 | 0 | **Clean Pass** | N/A |

```
======================================================
MIGRATION SUMMARY RESULT:
- Mode: DRY RUN
- News Sources: 18
- Canonical Stories: 2211
- Articles: 2225
- Story Articles Linked: 2225
- Timeline Events: 2216
- Hourly Briefings: 8
- Perspectives: 6
- Skipped Unmapped Guest Records: 3 (Preserved in pulse.db.json)
- Total Errors: 0
======================================================
```

---

## 3. Relational Mapping & Dependency Ordering

Foreign keys in PostgreSQL require strict insertion ordering to prevent constraint violations. The migration script applies data in the following exact sequence:

```
  ┌──────────────────────────────────────────────────────────────┐
  │ 1. news_sources                                              │
  │    (Primary feeds: PIB, The Hindu, BBC, Express, etc.)       │
  └──────────────────────────────┬───────────────────────────────┘
                                 │
                                 ▼
  ┌──────────────────────────────────────────────────────────────┐
  │ 2. canonical_stories                                         │
  │    (Master intelligence stories: state, national, global)    │
  └──────────────────────────────┬───────────────────────────────┘
                                 │
                                 ▼
  ┌──────────────────────────────────────────────────────────────┐
  │ 3. articles                                                  │
  │    (Individual publisher reports with foreign key source_id) │
  └──────────────────────────────┬───────────────────────────────┘
                                 │
                                 ▼
  ┌──────────────────────────────────────────────────────────────┐
  │ 4. story_articles & story_timeline_events                    │
  │    (Junction relationships and chronological development log)│
  └──────────────────────────────┬───────────────────────────────┘
                                 │
                                 ▼
  ┌──────────────────────────────────────────────────────────────┐
  │ 5. hourly_pulse_briefings & briefing_stories                 │
  │    (Historical executive summaries linked to stories)        │
  └──────────────────────────────┬───────────────────────────────┘
                                 │
                                 ▼
  ┌──────────────────────────────────────────────────────────────┐
  │ 6. perspective_analyses                                      │
  │    (Multi-perspective arguments, institutional evidence)     │
  └──────────────────────────────────────────────────────────────┘
```

---

## 4. Key Translation Strategy (UUIDv5)

- **Source Identifiers:** Legacy text IDs (`src-the-hindu`, `src-pib-delhi`) are deterministically transformed to RFC 4122 UUIDv5 via `stringToUuid()`.
- **Story Identifiers:** Text IDs (`story-1793335560425-...`) are mapped deterministically.
- **Article Identifiers:** URL hashes and IDs are mapped deterministically.
- **Foreign Key Consistency:** Because UUIDv5 is pure and deterministic, relational lookups match exactly across tables without requiring an auxiliary ID translation table.

---

## 5. Security Guard: Guest Data Preservation

`pulse.db.json` contains vocabulary words and preferences created during offline demo sessions under `guest-user-default` or `guest-session-*`.

### Safety Constraint Enforced:
1. **Never migrate unmapped guest data into authenticated cloud accounts:** Guest data has no verified email or Supabase Auth identity. Migrating guest data into authenticated tables would violate multi-tenant boundaries.
2. **Local preservation:** Unmapped guest records are intentionally skipped from cloud insertion and remain fully accessible in `pulse.db.json` when running in `PULSE_STORAGE_MODE=local`.
3. **Account Linkage Workflow:** When a user registers in the client, their device guest data is explicitly attached to their authenticated Supabase UID through the client onboarding sync, preserving user continuity safely.

---

## 6. Safety & Non-Destructive Invariants

- **Zero Local Mutations:** `migrateLocalToSupabase.ts` treats `pulse.db.json` as read-only. It never deletes, modifies, or truncates local files after cloud transfer.
- **Idempotent Upserting:** All SQL operations use PostgreSQL `ON CONFLICT (id) DO UPDATE` or `ON CONFLICT (story_id, article_id) DO NOTHING`. Running the script multiple times will safely update existing records without creating duplicates.
- **Dry-Run Mode Default:** Running with `--dry-run` performs full validation, JSON parsing, and dependency graphing without initiating any network connection to Supabase.
