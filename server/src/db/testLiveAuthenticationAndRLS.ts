import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { createScopedSupabaseClient } from './supabaseClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY?.trim();
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

export interface LiveAuthRLSReport {
  timestamp: string;
  userACreated: boolean;
  userBCreated: boolean;
  authTriggerVerified: boolean;
  userAWrotePreferences: boolean;
  userAWroteSavedStory: boolean;
  userAWroteVocabulary: boolean;
  userAWroteReadingHistory: boolean;
  userBCrossReadBlockedSavedStories: boolean;
  userBCrossReadBlockedVocabulary: boolean;
  userBCrossReadBlockedPreferences: boolean;
  userBCrossReadBlockedReadingHistory: boolean;
  anonymousBlockedFromPrivateData: boolean;
  userAPersistenceAfterReLogin: boolean;
  cleanupSuccessful: boolean;
  errors: string[];
}

export async function runLiveAuthenticationAndRLSTest(): Promise<LiveAuthRLSReport> {
  const report: LiveAuthRLSReport = {
    timestamp: new Date().toISOString(),
    userACreated: false,
    userBCreated: false,
    authTriggerVerified: false,
    userAWrotePreferences: false,
    userAWroteSavedStory: false,
    userAWroteVocabulary: false,
    userAWroteReadingHistory: false,
    userBCrossReadBlockedSavedStories: false,
    userBCrossReadBlockedVocabulary: false,
    userBCrossReadBlockedPreferences: false,
    userBCrossReadBlockedReadingHistory: false,
    anonymousBlockedFromPrivateData: false,
    userAPersistenceAfterReLogin: false,
    cleanupSuccessful: false,
    errors: [],
  };

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    const msg = 'Missing credentials in server/.env (SUPABASE_URL, SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY)';
    report.errors.push(msg);
    console.error(`[Test Error] ${msg}`);
    return report;
  }

  console.log(`\n======================================================`);
  console.log(`PULSE LIVE TWO-USER AUTHENTICATION & RLS ISOLATION TEST`);
  console.log(`Target Supabase URL: ${supabaseUrl}`);
  console.log(`======================================================\n`);

  const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const runId = Date.now();
  const emailA = `pulse_test_user_a_${runId}@example.com`;
  const emailB = `pulse_test_user_b_${runId}@example.com`;
  const passwordA = `PulseP@ss${runId}A!`;
  const passwordB = `PulseP@ss${runId}B!`;

  let userIdA = '';
  let userIdB = '';
  let tokenA = '';
  let tokenB = '';

  try {
    // 1. Create and authenticate User A
    console.log(`[1/7] Registering test User A (${emailA})...`);
    const { data: userCreatedA, error: errCreateA } = await adminClient.auth.admin.createUser({
      email: emailA,
      password: passwordA,
      email_confirm: true,
      user_metadata: { full_name: 'Test User Alpha', state: 'Telangana' },
    });

    if (errCreateA || !userCreatedA.user) {
      throw new Error(`Failed to create User A: ${errCreateA?.message}`);
    }
    userIdA = userCreatedA.user.id;

    // Login via anon client as User A to get a real user JWT
    const { data: loginA, error: loginErrA } = await anonClient.auth.signInWithPassword({
      email: emailA,
      password: passwordA,
    });
    if (loginErrA || !loginA.session) {
      throw new Error(`User A login failed: ${loginErrA?.message}`);
    }
    tokenA = loginA.session.access_token;
    report.userACreated = true;
    console.log(`  ✓ User A created & authenticated (UUID: ${userIdA})`);

    // 2. Create and authenticate User B
    console.log(`\n[2/7] Registering test User B (${emailB})...`);
    const { data: userCreatedB, error: errCreateB } = await adminClient.auth.admin.createUser({
      email: emailB,
      password: passwordB,
      email_confirm: true,
      user_metadata: { full_name: 'Test User Beta', state: 'Maharashtra' },
    });

    if (errCreateB || !userCreatedB.user) {
      throw new Error(`Failed to create User B: ${errCreateB?.message}`);
    }
    userIdB = userCreatedB.user.id;

    // Login via anon client as User B to get a real user JWT
    const { data: loginB, error: loginErrB } = await anonClient.auth.signInWithPassword({
      email: emailB,
      password: passwordB,
    });
    if (loginErrB || !loginB.session) {
      throw new Error(`User B login failed: ${loginErrB?.message}`);
    }
    tokenB = loginB.session.access_token;
    report.userBCreated = true;
    console.log(`  ✓ User B created & authenticated (UUID: ${userIdB})`);

    // 3. Verify Auth Trigger public.users provisioning
    console.log(`\n[3/7] Verifying Auth Trigger profile provisioning...`);
    // Brief sleep to allow trigger execution
    await new Promise(res => setTimeout(res, 500));

    const { data: profileA } = await adminClient.from('users').select('*').eq('id', userIdA).single();
    const { data: profileB } = await adminClient.from('users').select('*').eq('id', userIdB).single();

    if (profileA && profileB && profileA.is_admin === false && profileB.is_admin === false) {
      report.authTriggerVerified = true;
      console.log('  ✓ Trigger provisioned profile A with non-admin privileges');
      console.log('  ✓ Trigger provisioned profile B with non-admin privileges');
    } else {
      console.warn('  ! Auth trigger profile sync note: profiles not detected via trigger yet');
    }

    // 4. User A writes private records
    console.log(`\n[4/7] User A saving private records via scoped client...`);
    const clientA = createScopedSupabaseClient(tokenA);

    // Get an existing story ID or dummy UUID
    const { data: anyStory } = await adminClient.from('canonical_stories').select('id').limit(1);
    const testStoryId = anyStory?.[0]?.id || '00000000-0000-0000-0000-000000000001';

    // A. User preferences
    const { error: prefErr } = await clientA.from('user_preferences').upsert({
      user_id: userIdA,
      news_reading_language: 'te',
      summary_length: 'detailed',
    }, { onConflict: 'user_id' });
    if (!prefErr) {
      report.userAWrotePreferences = true;
      console.log('  ✓ User A saved language preference ("te")');
    } else {
      report.errors.push(`User A preferences error: ${prefErr.message}`);
    }

    // B. Saved story
    const { error: saveErr } = await clientA.from('saved_stories').upsert({
      user_id: userIdA,
      story_id: testStoryId,
      personal_notes: 'User A confidential research notes',
    });
    if (!saveErr) {
      report.userAWroteSavedStory = true;
      console.log('  ✓ User A saved story with confidential note');
    } else {
      report.errors.push(`User A saved story error: ${saveErr.message}`);
    }

    // C. Vocabulary
    const { error: vocabErr } = await clientA.from('vocabulary_entries').insert({
      user_id: userIdA,
      word: 'perspicacity',
      source_sentence: 'A leader of extraordinary perspicacity.',
      contextual_meaning: 'Keen insight and judgment',
      original_definition: 'The quality of having a ready insight into things.',
      original_language: 'en',
      target_language: 'te',
    });
    if (!vocabErr) {
      report.userAWroteVocabulary = true;
      console.log('  ✓ User A added vocabulary word ("perspicacity")');
    } else {
      report.errors.push(`User A vocabulary error: ${vocabErr.message}`);
    }

    // D. Reading history
    const { error: histErr } = await clientA.from('reading_history').insert({
      user_id: userIdA,
      story_id: testStoryId,
      time_spent_seconds: 145,
    });
    if (!histErr) {
      report.userAWroteReadingHistory = true;
      console.log('  ✓ User A recorded reading history (145s)');
    }

    // 5. User B cross-tenant isolation testing
    console.log(`\n[5/7] Testing User B cross-tenant isolation (Zero-Knowledge Check)...`);
    const clientB = createScopedSupabaseClient(tokenB);

    // User B tries to read saved stories
    const { data: bSavedStories } = await clientB.from('saved_stories').select('*');
    if (Array.isArray(bSavedStories) && bSavedStories.length === 0) {
      report.userBCrossReadBlockedSavedStories = true;
      console.log('  ✓ User B query on saved_stories: 0 rows returned (User A note hidden)');
    } else {
      report.errors.push(`RLS BREACH: User B accessed User A saved stories!`);
      console.error('  ✗ RLS BREACH: User B read saved stories:', bSavedStories);
    }

    // User B tries direct exploit query matching User A's ID
    const { data: bDirectSaved } = await clientB.from('saved_stories').select('*').eq('user_id', userIdA);
    if (!bDirectSaved || bDirectSaved.length === 0) {
      console.log('  ✓ Direct exploit query for User A user_id: 0 rows returned (Engine blocked)');
    }

    // User B tries to read vocabulary
    const { data: bVocab } = await clientB.from('vocabulary_entries').select('*');
    if (Array.isArray(bVocab) && bVocab.length === 0) {
      report.userBCrossReadBlockedVocabulary = true;
      console.log('  ✓ User B query on vocabulary_entries: 0 rows returned (User A word hidden)');
    } else {
      report.errors.push(`RLS BREACH: User B accessed User A vocabulary!`);
      console.error('  ✗ RLS BREACH: User B read vocabulary:', bVocab);
    }

    // User B tries to read User A preferences
    const { data: bPrefs } = await clientB.from('user_preferences').select('*').eq('user_id', userIdA);
    if (!bPrefs || bPrefs.length === 0) {
      report.userBCrossReadBlockedPreferences = true;
      console.log('  ✓ User B query on User A preferences: 0 rows returned');
    }

    // User B tries to read User A history
    const { data: bHistory } = await clientB.from('reading_history').select('*');
    if (Array.isArray(bHistory) && bHistory.length === 0) {
      report.userBCrossReadBlockedReadingHistory = true;
      console.log('  ✓ User B query on reading_history: 0 rows returned');
    }

    // 6. Anonymous Request Check
    console.log(`\n[6/7] Testing Anonymous Client against private tables...`);
    const { data: anonSaved } = await anonClient.from('saved_stories').select('*');
    const { data: anonVocab } = await anonClient.from('vocabulary_entries').select('*');
    if ((anonSaved?.length || 0) === 0 && (anonVocab?.length || 0) === 0) {
      report.anonymousBlockedFromPrivateData = true;
      console.log('  ✓ Anonymous request returned 0 private records (Strict Default Deny)');
    }

    // 7. Session Re-Login Persistence Check
    console.log(`\n[7/7] Testing User A session re-login persistence...`);
    const { data: reLoginA, error: reLoginErrA } = await anonClient.auth.signInWithPassword({
      email: emailA,
      password: passwordA,
    });
    if (!reLoginErrA && reLoginA.session) {
      const clientANew = createScopedSupabaseClient(reLoginA.session.access_token);
      const { data: reloadedSaved } = await clientANew.from('saved_stories').select('*');
      const { data: reloadedVocab } = await clientANew.from('vocabulary_entries').select('*');

      if ((reloadedSaved?.length || 0) > 0 && (reloadedVocab?.length || 0) > 0) {
        report.userAPersistenceAfterReLogin = true;
        console.log('  ✓ User A confidential notes persisted across session termination');
        console.log('  ✓ User A vocabulary word persisted across session termination');
      }
    }
  } catch (err: any) {
    report.errors.push(`Test execution error: ${err.message}`);
    console.error(`[Test Execution Error]`, err.message);
  } finally {
    // Cleanup temporary test accounts
    console.log(`\n[Cleanup] Purging temporary test accounts...`);
    try {
      if (userIdA) {
        await adminClient.auth.admin.deleteUser(userIdA);
        console.log(`  ✓ Cleaned up User A (${userIdA}) and cascaded records`);
      }
      if (userIdB) {
        await adminClient.auth.admin.deleteUser(userIdB);
        console.log(`  ✓ Cleaned up User B (${userIdB}) and cascaded records`);
      }
      report.cleanupSuccessful = true;
    } catch (cleanupErr: any) {
      console.warn(`  ! Cleanup note: ${cleanupErr.message}`);
    }
  }

  console.log(`\n======================================================`);
  console.log(`TWO-USER RLS TEST SUMMARY:`);
  console.log(`- User A Created: ${report.userACreated ? 'PASS' : 'FAIL'}`);
  console.log(`- User B Created: ${report.userBCreated ? 'PASS' : 'FAIL'}`);
  console.log(`- User B Blocked from User A Stories: ${report.userBCrossReadBlockedSavedStories ? 'PASS' : 'FAIL'}`);
  console.log(`- User B Blocked from User A Vocab: ${report.userBCrossReadBlockedVocabulary ? 'PASS' : 'FAIL'}`);
  console.log(`- Anonymous Blocked from Private: ${report.anonymousBlockedFromPrivateData ? 'PASS' : 'FAIL'}`);
  console.log(`- Persistence Across Re-Login: ${report.userAPersistenceAfterReLogin ? 'PASS' : 'FAIL'}`);
  console.log(`- Cleanup Successful: ${report.cleanupSuccessful ? 'PASS' : 'FAIL'}`);
  console.log(`- Total Errors: ${report.errors.length}`);
  console.log(`======================================================\n`);

  return report;
}

if (process.argv[1] && process.argv[1].endsWith('testLiveAuthenticationAndRLS.ts')) {
  runLiveAuthenticationAndRLSTest()
    .then(res => {
      if (res.errors.length > 0 || !res.userBCrossReadBlockedSavedStories || !res.userBCrossReadBlockedVocabulary) {
        process.exit(1);
      }
      process.exit(0);
    })
    .catch(err => {
      console.error('[Fatal Error]', err);
      process.exit(1);
    });
}
