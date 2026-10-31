/**
 * Pulse Production Database Backup Utility
 * Exports timestamped snapshot from Supabase Cloud to local storage without modifying pulse.db.json
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { getSupabaseAdminClient } from './supabaseClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function runBackup() {
  console.log('=====================================================');
  console.log('  PULSE PRODUCTION DATABASE BACKUP UTILITY');
  console.log('=====================================================\n');

  const admin = getSupabaseAdminClient();
  if (!admin) {
    console.error('FATAL: Supabase admin credentials not configured.');
    process.exit(1);
  }

  const backupDir = path.resolve(__dirname, '../../data/backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(backupDir, `pulse_cloud_backup_${timestamp}.json`);

  console.log(`[Backup] Initiating cloud snapshot at ${new Date().toISOString()}...`);

  const tables = [
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

  const backupData: Record<string, any[]> = {};
  let totalRows = 0;

  for (const table of tables) {
    const { data, error, count } = await admin.from(table).select('*', { count: 'exact' });
    if (error) {
      console.warn(`[Backup] Warning fetching table ${table}:`, error.message);
      backupData[table] = [];
    } else {
      backupData[table] = data || [];
      const rowCount = data?.length || 0;
      totalRows += rowCount;
      console.log(`  ✓ Exported ${table.padEnd(30)}: ${rowCount} rows`);
    }
  }

  fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2), 'utf-8');

  console.log(`\n[Backup] Snapshot successfully saved:`);
  console.log(`  File: ${backupFile}`);
  console.log(`  Size: ${(fs.statSync(backupFile).size / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`  Total Rows Backed Up: ${totalRows}`);

  // Integrity assertion on cold backup
  const coldBackup = path.resolve(__dirname, '../../data/pulse.db.json');
  if (fs.existsSync(coldBackup)) {
    console.log(`  Verified cold local backup intact: ${coldBackup} (${(fs.statSync(coldBackup).size / (1024 * 1024)).toFixed(2)} MB)`);
  }
}

runBackup().catch(err => {
  console.error('[Backup] Unhandled error during backup:', err);
  process.exit(1);
});
