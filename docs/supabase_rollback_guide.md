# PULSE — SUPABASE CLOUD ROLLBACK & RECOVERY GUIDE
**System**: Pulse News Intelligence Engine  
**Tagline**: *The world, understood.*  
**Date**: October 31, 2026  
**Document Version**: 2.0.0  

---

## 1. Overview & Rollback Principles

This guide provides definitive operational procedures for:
1. Handling Supabase Cloud network outages using **Safe Degraded Mode** (Production).
2. Generating and restoring timestamped cloud backups into Supabase PostgreSQL.
3. Documenting the age, purpose, and limitations of the local JSON baseline (`pulse.db.json`).
4. Rolling back to offline local storage strictly for **Local Offline Development**.

---

## 2. Production Outages vs. Offline Development

> [!CRITICAL]
> **Production Principle: Never switch `PULSE_STORAGE_MODE=local` during a production cloud outage.**
> - Container disks on Render are ephemeral: all writes to local files will be permanently lost when the container restarts.
> - `pulse.db.json` is a frozen snapshot from migration time. Reading from it exposes outdated news to users.
> - Writing to an ephemeral snapshot causes "split-brain" divergence and misleads users into believing bookmarks and vocabulary were saved.

### A. Production Cloud Outage (Safe Degraded Mode)
When Supabase Cloud experiences an outage or network degradation:
1. **Preserve Cloud Mode**:
   Keep `PULSE_STORAGE_MODE=cloud`.
2. **Automated Health Status**:
   - `/api/health` detects `repo.ping() === false` and reports `{ "status": "degraded", "storageMode": "cloud", "cloudConnected": false }`.
   - The Render container process remains alive.
3. **Explicit Error Reporting on Mutating Endpoints**:
   - Personal state mutations (`POST /api/saved-stories`, `POST /api/vocabulary`, `POST /api/preferences`, `POST /api/auth/*`) explicitly reject requests with descriptive HTTP 500 / 503 errors (`{ "error": "Cloud storage temporarily unavailable. Please retry shortly." }`).
   - The user is notified immediately that the action could not be saved, avoiding false confirmation.
4. **Automatic Reconnection**:
   - Once Supabase connectivity is restored, `repo.ping()` returns `true` and the background scheduler (`node-cron`) automatically resumes on its next 30-minute cycle.
   - No data reconciliation or cleanup is necessary because no conflicting local writes occurred.

### B. Offline Local Development Rollback (Developer Machines Only)
If a developer needs to work completely offline without internet connectivity on their local machine:
1. In `server/.env`, set `PULSE_STORAGE_MODE=local`.
2. Restart the local dev server: `npm --prefix server run dev`.
3. The server reads and writes to local `server/data/pulse.db.json`.

---

## 3. Local Snapshot: Age, Purpose & Limitations

| Attribute | Specification |
| :--- | :--- |
| **File Location** | `server/data/pulse.db.json` |
| **Snapshot Timestamp** | October 30, 2026 |
| **File Size** | 13.3 MB (13,941,063 bytes) |
| **Entity Counts** | 320 articles, 2,459 canonical stories, 14 briefings, 18 sources |
| **Designated Role** | **Cold Catastrophe Disaster-Recovery Asset** & **Offline Demo Seed** |

### Critical Limitations:
1. **Static Baseline**: Does not include new stories, editorial updates, or user accounts created since cloud activation.
2. **No User Account Isolation**: Local JSON mode uses a shared single-tenant object model; it does not enforce PostgreSQL Row Level Security (RLS).
3. **Ephemeral on Render**: If used inside a Render container, any writes to this file vanish completely upon container restart or redeploy.
4. **Restricted Use**: Must **never** be used as an automatic failover target in production.

---

## 4. Cloud Backup & Restoration Procedures

Pulse includes dedicated, automated utilities for backing up and restoring Supabase Cloud data.

### Step 1: Generating a Timestamped Cloud Backup
To export a complete snapshot of all 14 core tables from Supabase Cloud:
```bash
npm --prefix server run backup
```
- **Execution Script**: [server/src/db/backupDatabase.ts](file:///d:/Aashrith/Webs/Plause/server/src/db/backupDatabase.ts)
- **Output Location**: `server/data/backups/pulse_cloud_backup_<timestamp>.json`
- **Output Scope**: All editorial stories, articles, briefings, perspectives, vocabulary, user preferences, and notification records.
- **Safety**: Purely read-only query against Supabase; does not alter existing data or touch `pulse.db.json`.

### Step 2: Validating a Backup (Dry-Run Simulation)
Before performing any restoration, always simulate the process with `--dry-run`:
```bash
npm --prefix server run restore "data/backups/pulse_cloud_backup_<timestamp>.json" --dry-run
```
- Validates JSON file syntax and verifies row counts for all 14 tables.
- **Safety**: Performs zero database writes.

### Step 3: Executing a Live Cloud Restoration (Explicit Operator Confirmation)
To restore a validated cloud backup into Supabase:
```bash
npm --prefix server run restore "data/backups/pulse_cloud_backup_<timestamp>.json" --confirm
```
- **Execution Script**: [server/src/db/restoreCloudBackup.ts](file:///d:/Aashrith/Webs/Plause/server/src/db/restoreCloudBackup.ts)
- **Safety Gate**: The `--confirm` flag is **strictly required**. Omitting it halts execution immediately without writing any data.
- **Dependency Ordering**: Restores parent tables first (`news_sources` -> `canonical_stories` -> `articles` -> `story_articles` -> `briefings` -> user data).
- **Idempotency**: Uses PostgreSQL `upsert` with primary/unique conflict keys, preventing duplicate key exceptions.

---

## 5. Credential Revocation & Security Rotation

If `SUPABASE_SERVICE_ROLE_KEY` or `ADMIN_API_KEY` is suspected of compromise:

### A. Revoke / Rotate Keys in Supabase Dashboard
1. Log in to the [Supabase Dashboard](https://supabase.com/dashboard).
2. Select the **Pulse** project.
3. Navigate to **Project Settings** -> **API**.
4. In the **Project API keys** section, click **Roll API Key** on the `service_role` key (or regenerate JWT secret).
5. Copy the newly issued secret key.

### B. Generate a New Local Admin API Key
Generate a fresh 256-bit cryptographically secure hex key:
```bash
# In PowerShell:
[BitConverter]::ToString((New-Object Security.Cryptography.RNGCryptoServiceProvider).GetBytes((New-Object byte[] 32))).Replace("-", "").ToLower()

# Or in Node.js:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### C. Update Render Environment Variables
In Render Dashboard -> `pulse-backend` -> **Environment**:
1. Update `SUPABASE_SERVICE_ROLE_KEY` and `ADMIN_API_KEY`.
2. Save changes. Render performs a zero-downtime rolling restart.
3. Update `server/.env` for local developer operations.

---

## 6. Decision Tree: Incident Response

```text
[ Incident Detected ]
       │
       ├──► Supabase Cloud Network Degradation / Outage
       │       └──► Maintain PULSE_STORAGE_MODE=cloud (Safe Degraded Mode active; do NOT switch to local)
       │
       ├──► Catastrophic Cloud Data Corruption or Loss
       │       └──► 1. Run dry-run validation: npm --prefix server run restore "<backup>.json" --dry-run
       │       └──► 2. Execute live restore with approval: npm --prefix server run restore "<backup>.json" --confirm
       │
       ├──► Editorial Data Migration / Ingestion Refresh
       │       └──► Run idempotent re-sync: npm --prefix server run migrate:cloud
       │
       └──► Suspected Secret Compromise
               └──► Rotate Service-Role Key in Dashboard & Update ADMIN_API_KEY in Render / server/.env
```
