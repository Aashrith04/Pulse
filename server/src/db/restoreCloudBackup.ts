/**
 * Pulse Cloud Backup Restoration Utility
 * Safely restores a timestamped JSON cloud backup into Supabase PostgreSQL.
 * 
 * SAFETY GATES:
 * 1. Requires explicit backup file path as argument.
 * 2. Requires explicit `--confirm` flag to execute writes.
 * 3. Supports `--dry-run` to preview row counts without touching the database.
 * 4. Never executes automatically.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { getSupabaseAdminClient } from './supabaseClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const ORDERED_TABLES = [
  'news_sources',
  'canonical_stories',
  'articles',
  'story_articles',
  'story_timeline_events',
  'hourly_pulse_briefings',
  'perspective_analyses',
  'vocabulary_entries',
  'vocabulary_reviews',
  'user_preferences',
  'saved_stories',
  'reading_history',
  'notification_delivery_history',
  'push_subscriptions',
];

const CONFLICT_KEYS: Record<string, string> = {
  news_sources: 'id',
  canonical_stories: 'id',
  articles: 'id',
  story_articles: 'story_id,article_id',
  story_timeline_events: 'id',
  hourly_pulse_briefings: 'id',
  perspective_analyses: 'id',
  vocabulary_entries: 'id',
  vocabulary_reviews: 'id',
  user_preferences: 'user_id',
  saved_stories: 'user_id,story_id',
  reading_history: 'id',
  notification_delivery_history: 'id',
  push_subscriptions: 'id',
};

async function runRestore() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const isConfirmed = args.includes('--confirm');
  const filePathArg = args.find(a => !a.startsWith('--'));

  console.log('=====================================================');
  console.log('  PULSE CLOUD BACKUP RESTORATION UTILITY');
  console.log('=====================================================\n');

  if (!filePathArg) {
    console.error('ERROR: No backup file specified.');
    console.log('Usage: npx tsx src/db/restoreCloudBackup.ts <path-to-backup.json> [--dry-run] [--confirm]');
    console.log('Example: npx tsx src/db/restoreCloudBackup.ts data/backups/pulse_cloud_backup_2026-10-31.json --dry-run');
    process.exit(1);
  }

  const backupFilePath = path.resolve(process.cwd(), filePathArg);
  if (!fs.existsSync(backupFilePath)) {
    console.error(`ERROR: Backup file not found at: ${backupFilePath}`);
    process.exit(1);
  }

  let backupData: Record<string, any[]>;
  try {
    const raw = fs.readFileSync(backupFilePath, 'utf-8');
    backupData = JSON.parse(raw);
  } catch (err: any) {
    console.error(`ERROR: Failed to read or parse JSON backup file: ${err.message}`);
    process.exit(1);
  }

  console.log(`[Restore] Source File: ${backupFilePath}`);
  console.log(`[Restore] Mode: ${isDryRun ? 'DRY-RUN (Simulated)' : isConfirmed ? 'LIVE EXECUTION' : 'VALIDATION ONLY (Unconfirmed)'}`);

  // Summary of backup file contents
  console.log('\n[Restore] Backup Contents:');
  let totalRowsInBackup = 0;
  for (const table of ORDERED_TABLES) {
    const rows = backupData[table] || [];
    totalRowsInBackup += rows.length;
    console.log(`  - ${table.padEnd(30)}: ${rows.length} rows`);
  }
  console.log(`  Total rows across all tables: ${totalRowsInBackup}\n`);

  if (!isConfirmed && !isDryRun) {
    console.log('========================================================================');
    console.log('  SAFETY GATE: LIVE RESTORATION NOT CONFIRMED');
    console.log('========================================================================');
    console.log('  OPERATIONAL RESTORATION SEMANTICS:');
    console.log('  1. UPSERT ONLY: Records are upserted against primary / unique conflict keys.');
    console.log('     Existing rows matching backup keys will be updated with backup values.');
    console.log('  2. NON-DESTRUCTIVE: Rows in Supabase absent from the backup are NOT deleted.');
    console.log('  3. ORDERED DEPENDENCY: Foreign keys are respected (parents inserted first).');
    console.log('  4. SEQUENTIAL BATCHES: Batches (100 rows) commit per request. If interrupted,');
    console.log('     re-running the command safely resumes because operations are idempotent.');
    console.log('------------------------------------------------------------------------');
    console.log('  To apply this backup to your live Supabase database, run with:');
    console.log(`  npx tsx src/db/restoreCloudBackup.ts "${filePathArg}" --confirm`);
    console.log('  Or simulate the restoration without writing:');
    console.log(`  npx tsx src/db/restoreCloudBackup.ts "${filePathArg}" --dry-run`);
    console.log('========================================================================\n');
    process.exit(0);
  }

  if (isDryRun) {
    console.log('✓ Dry-run completed successfully. Backup file structure is valid.');
    process.exit(0);
  }

  // Live execution requires Supabase admin client
  const admin = getSupabaseAdminClient();
  if (!admin) {
    console.error('FATAL: Supabase admin credentials not configured.');
    process.exit(1);
  }

  console.log('[Restore] Initiating live upsert restoration into Supabase Cloud...');
  const BATCH_SIZE = 100;

  for (const table of ORDERED_TABLES) {
    const rows = backupData[table] || [];
    if (rows.length === 0) continue;

    const conflictKey = CONFLICT_KEYS[table] || 'id';
    let restoredCount = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const { error } = await admin
        .from(table)
        .upsert(batch, { onConflict: conflictKey });

      if (error) {
        console.error(`[Restore] Error upserting into ${table} (batch ${i}..${i + batch.length}):`, error.message);
        throw error;
      }
      restoredCount += batch.length;
    }

    console.log(`  ✓ Restored ${table.padEnd(30)}: ${restoredCount}/${rows.length} rows`);
  }

  console.log('\n[Restore] Live restoration completed successfully.');
}

runRestore().catch(err => {
  console.error('[Restore] Fatal restoration error:', err);
  process.exit(1);
});
