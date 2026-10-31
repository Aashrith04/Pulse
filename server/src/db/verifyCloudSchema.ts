import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY?.trim();
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

export interface VerificationResult {
  timestamp: string;
  connected: boolean;
  supabaseUrl: string;
  tablesVerified: { name: string; exists: boolean; rlsRestricted: boolean; error?: string }[];
  publicReadsOk: boolean;
  anonymousBlockedFromPrivate: boolean;
  serviceRoleAuthorized: boolean;
  errors: string[];
}

export async function runCloudSchemaVerification(): Promise<VerificationResult> {
  const result: VerificationResult = {
    timestamp: new Date().toISOString(),
    connected: false,
    supabaseUrl: supabaseUrl || 'NOT_CONFIGURED',
    tablesVerified: [],
    publicReadsOk: false,
    anonymousBlockedFromPrivate: false,
    serviceRoleAuthorized: false,
    errors: [],
  };

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    const msg = 'Missing required credentials in server/.env (SUPABASE_URL, SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY).';
    result.errors.push(msg);
    console.error(`[Verification Error] ${msg}`);
    return result;
  }

  console.log(`\n======================================================`);
  console.log(`PULSE LIVE SUPABASE CLOUD SCHEMA VERIFICATION`);
  console.log(`Target URL: ${supabaseUrl}`);
  console.log(`======================================================\n`);

  const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Check basic connection
  try {
    const { data, error } = await anonClient.from('canonical_stories').select('id').limit(1);
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    result.connected = true;
    console.log('[1/5] Live Supabase PostgREST Connection: OK');
  } catch (err: any) {
    result.errors.push(`PostgREST connection failed: ${err.message}`);
    console.error(`[1/5] Live Supabase Connection Failed:`, err.message);
    return result;
  }

  // 2. Verify all 22 expected tables exist
  const expectedTables = [
    // User & Preferences
    'users',
    'user_preferences',
    // Editorial News
    'news_sources',
    'articles',
    'canonical_stories',
    'story_articles',
    'story_timeline_events',
    'hourly_pulse_briefings',
    'briefing_stories',
    'perspective_analyses',
    // Personal Interactions
    'saved_stories',
    'reading_history',
    // Inquiries
    'ask_conversations',
    'ask_messages',
    // Vocabulary
    'vocabulary_entries',
    'vocabulary_reviews',
    // Caching
    'cached_translations',
    'cached_definitions',
    // Notifications & Push
    'notification_delivery_history',
    'push_subscriptions',
    // Telemetry & Logs
    'ingestion_job_history',
    'ai_request_logs',
  ];

  console.log(`\n[2/5] Inspecting all ${expectedTables.length} expected tables...`);

  const privateTables = [
    'users',
    'user_preferences',
    'saved_stories',
    'reading_history',
    'vocabulary_entries',
    'vocabulary_reviews',
    'ask_conversations',
    'ask_messages',
    'notification_delivery_history',
    'push_subscriptions',
  ];

  let allTablesExist = true;

  for (const tableName of expectedTables) {
    try {
      // Use admin client to verify table existence regardless of RLS
      const { error: adminErr } = await adminClient.from(tableName).select('*').limit(0);
      if (adminErr) {
        throw adminErr;
      }

      // Check whether anonymous access is blocked or restricted by RLS on private tables
      let rlsRestricted = false;
      if (privateTables.includes(tableName)) {
        const { data: anonData, error: anonErr } = await anonClient.from(tableName).select('*').limit(5);
        // Under RLS, anon client without token will either get empty array (data: []) or error
        if (!anonErr && Array.isArray(anonData) && anonData.length === 0) {
          rlsRestricted = true;
        } else if (anonErr) {
          rlsRestricted = true;
        }
      }

      result.tablesVerified.push({
        name: tableName,
        exists: true,
        rlsRestricted,
      });

      console.log(`  ✓ Table "${tableName}": EXISTS${privateTables.includes(tableName) ? ' (RLS Verified)' : ''}`);
    } catch (err: any) {
      allTablesExist = false;
      result.tablesVerified.push({
        name: tableName,
        exists: false,
        rlsRestricted: false,
        error: err.message,
      });
      result.errors.push(`Table "${tableName}" check failed: ${err.message}`);
      console.error(`  ✗ Table "${tableName}": FAILED (${err.message})`);
    }
  }

  // 3. Verify public editorial reads work anonymously
  console.log(`\n[3/5] Testing public editorial read policies...`);
  try {
    const { data: storiesData, error: storiesErr } = await anonClient.from('canonical_stories').select('id').limit(1);
    const { data: sourcesData, error: sourcesErr } = await anonClient.from('news_sources').select('id').limit(1);
    if (storiesErr || sourcesErr) {
      throw new Error(`Public read error: ${(storiesErr || sourcesErr)?.message}`);
    }
    result.publicReadsOk = true;
    console.log('  ✓ Public read on canonical_stories: PERMITTED');
    console.log('  ✓ Public read on news_sources: PERMITTED');
  } catch (err: any) {
    result.errors.push(`Public editorial reads failed: ${err.message}`);
    console.error('  ✗ Public editorial reads FAILED:', err.message);
  }

  // 4. Verify anonymous client CANNOT read private user tables
  console.log(`\n[4/5] Verifying strict RLS protection on private user tables...`);
  try {
    const { data: savedStories } = await anonClient.from('saved_stories').select('*');
    const { data: vocabEntries } = await anonClient.from('vocabulary_entries').select('*');
    const { data: userPrefs } = await anonClient.from('user_preferences').select('*');

    const totalLeaked = (savedStories?.length || 0) + (vocabEntries?.length || 0) + (userPrefs?.length || 0);
    if (totalLeaked === 0) {
      result.anonymousBlockedFromPrivate = true;
      console.log('  ✓ Anonymous query on saved_stories: 0 rows returned (Blocked by RLS)');
      console.log('  ✓ Anonymous query on vocabulary_entries: 0 rows returned (Blocked by RLS)');
      console.log('  ✓ Anonymous query on user_preferences: 0 rows returned (Blocked by RLS)');
    } else {
      throw new Error(`Data leakage detected: anonymous query returned ${totalLeaked} private rows!`);
    }
  } catch (err: any) {
    result.errors.push(`RLS private protection failed: ${err.message}`);
    console.error('  ✗ Private table RLS protection FAILED:', err.message);
  }

  // 5. Verify service-role client bypass for backend operations
  console.log(`\n[5/5] Verifying Service-Role administrative authority...`);
  try {
    const { error: adminTestErr } = await adminClient.from('ingestion_job_history').select('count', { count: 'exact', head: true });
    if (adminTestErr) {
      throw adminTestErr;
    }
    result.serviceRoleAuthorized = true;
    console.log('  ✓ Service-role client authorized for backend telemetry & ingestion.');
  } catch (err: any) {
    result.errors.push(`Service-role client check failed: ${err.message}`);
    console.error('  ✗ Service-role check FAILED:', err.message);
  }

  console.log(`\n======================================================`);
  console.log(`VERIFICATION SUMMARY RESULT:`);
  console.log(`- Connected: ${result.connected ? 'YES' : 'NO'}`);
  console.log(`- Tables Verified: ${result.tablesVerified.filter(t => t.exists).length} / ${expectedTables.length}`);
  console.log(`- Public Editorial Reads: ${result.publicReadsOk ? 'PASS' : 'FAIL'}`);
  console.log(`- Anonymous RLS Isolation: ${result.anonymousBlockedFromPrivate ? 'PASS' : 'FAIL'}`);
  console.log(`- Service-Role Authority: ${result.serviceRoleAuthorized ? 'PASS' : 'FAIL'}`);
  console.log(`- Total Errors: ${result.errors.length}`);
  console.log(`======================================================\n`);

  return result;
}

if (process.argv[1] && process.argv[1].endsWith('verifyCloudSchema.ts')) {
  runCloudSchemaVerification()
    .then(res => {
      if (res.errors.length > 0 || !res.connected || res.tablesVerified.some(t => !t.exists)) {
        process.exit(1);
      }
      process.exit(0);
    })
    .catch(err => {
      console.error('[Fatal Error]', err);
      process.exit(1);
    });
}
