import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { getRepository, getStorageMode, createRepository, resetRepository } from './repositoryFactory.js';
import { SupabaseNewsRepository } from './supabaseRepository.js';
import { stringToUuid } from './uuidUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.SUPABASE_URL?.trim() || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY?.trim() || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';

async function runLiveCloudActivationAudit() {
  console.log(`\n======================================================`);
  console.log(`PULSE LIVE SUPABASE CLOUD ACTIVATION VERIFICATION`);
  console.log(`Endpoint: ${supabaseUrl}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`======================================================\n`);

  const results: Record<string, boolean> = {};

  // -----------------------------------------------------------------
  // 1. REPOSITORY FACTORY SELECTION
  // -----------------------------------------------------------------
  console.log(`[1] TESTING REPOSITORY FACTORY SELECTION:`);
  const mode = getStorageMode();
  console.log(`  • Configured PULSE_STORAGE_MODE: "${mode}"`);
  results['storage_mode_is_cloud'] = mode === 'cloud';

  resetRepository('cloud');
  const repo = getRepository() as SupabaseNewsRepository;
  const isSupabaseRepo = repo instanceof SupabaseNewsRepository;
  console.log(`  • Repository class instantiated: ${repo.constructor.name}`);
  results['factory_selected_supabase'] = isSupabaseRepo;

  const repoMode = repo.getMode();
  console.log(`  • repo.getMode(): "${repoMode}"`);
  results['repo_mode_is_cloud'] = repoMode === 'cloud';

  const pingOk = await repo.ping();
  console.log(`  • repo.ping() PostgreSQL health ping: ${pingOk ? 'SUCCESS' : 'FAILED'}`);
  results['supabase_ping_success'] = pingOk;

  const diag = await repo.getDiagnostics();
  console.log(`  • Diagnostics: mode="${diag.mode}", isConnected=${diag.isConnected}, stories=${diag.storiesCount}, sources=${diag.sourcesCount}`);
  results['diagnostics_connected'] = diag.isConnected === true;

  // -----------------------------------------------------------------
  // 2. RETRIEVAL OF EDITORIAL DATA FROM SUPABASE
  // -----------------------------------------------------------------
  console.log(`\n[2] TESTING EDITORIAL DATA RETRIEVAL FROM SUPABASE:`);
  const sources = await repo.getSources();
  console.log(`  • Retrieved ${sources.length} news sources from Supabase`);
  results['sources_retrieved'] = sources.length >= 18;

  const { stories, total: totalStories } = await repo.getStories({ limit: 10 });
  console.log(`  • Retrieved stories: total=${totalStories}, page_limit=10, received=${stories.length}`);
  results['stories_retrieved'] = stories.length > 0 && totalStories > 0;

  if (stories.length > 0) {
    const sampleStory = await repo.getStoryById(stories[0].id);
    const hasArticles = (sampleStory?.articles?.length || 0) > 0;
    console.log(`  • Sample story [${sampleStory?.id}]: "${sampleStory?.title?.substring(0, 45)}..."`);
    console.log(`    Linked articles: ${sampleStory?.articles?.length || 0}, Timeline events: ${sampleStory?.timeline?.length || 0}`);
    results['story_detail_and_articles_retrieved'] = Boolean(sampleStory && hasArticles);
  }

  const briefings = await repo.getBriefings();
  console.log(`  • Briefings retrieved: ${briefings.length} total hourly briefings from Supabase`);
  results['briefings_retrieved'] = briefings.length > 0;

  // -----------------------------------------------------------------
  // 3. AUTHENTICATED USER OPERATIONS & RLS ISOLATION
  // -----------------------------------------------------------------
  console.log(`\n[3] TESTING AUTHENTICATED USER OPERATIONS & TWO-USER RLS:`);
  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const testStamp = Date.now();
  const emailA = `pulse_act_user_a_${testStamp}@example.com`;
  const emailB = `pulse_act_user_b_${testStamp}@example.com`;
  const passA = `PulseAct!${testStamp}A#`;
  const passB = `PulseAct!${testStamp}B#`;

  let userAId = '';
  let userBId = '';
  let tokenA = '';
  let tokenB = '';

  try {
    // Register User A
    const { data: crA, error: errCrA } = await adminClient.auth.admin.createUser({
      email: emailA,
      password: passA,
      email_confirm: true,
      user_metadata: { full_name: 'Activation User Alpha', state: 'Delhi' },
    });
    if (errCrA || !crA.user) throw new Error(`User A creation failed: ${errCrA?.message}`);
    userAId = crA.user.id;

    const { data: logA, error: errLogA } = await anonClient.auth.signInWithPassword({ email: emailA, password: passA });
    if (errLogA || !logA.session) throw new Error(`User A login failed: ${errLogA?.message}`);
    tokenA = logA.session.access_token;
    console.log(`  ✓ Registered and logged in User A (UUID: ${userAId})`);

    // Register User B
    const { data: crB, error: errCrB } = await adminClient.auth.admin.createUser({
      email: emailB,
      password: passB,
      email_confirm: true,
      user_metadata: { full_name: 'Activation User Beta', state: 'Karnataka' },
    });
    if (errCrB || !crB.user) throw new Error(`User B creation failed: ${errCrB?.message}`);
    userBId = crB.user.id;

    const { data: logB, error: errLogB } = await anonClient.auth.signInWithPassword({ email: emailB, password: passB });
    if (errLogB || !logB.session) throw new Error(`User B login failed: ${errLogB?.message}`);
    tokenB = logB.session.access_token;
    console.log(`  ✓ Registered and logged in User B (UUID: ${userBId})`);

    // A. Reading Preferences via User A JWT
    await repo.savePreferences(userAId, {
      newsReadingLanguage: 'hi',
      summaryLength: 'concise',
      theme: 'dark',
    }, tokenA);
    const fetchedPrefs = await repo.getPreferences(userAId, tokenA);
    const prefsOk = fetchedPrefs.newsReadingLanguage === 'hi' && fetchedPrefs.theme === 'dark';
    console.log(`  ✓ Reading Preferences saved & retrieved: language="${fetchedPrefs.newsReadingLanguage}", theme="${fetchedPrefs.theme}"`);
    results['user_preferences_crud'] = prefsOk;

    // B. Save & Retrieve Stories via User A JWT
    const targetStoryId = stories[0].id;
    await repo.saveStory(userAId, targetStoryId, 'Confidential note for Story A', tokenA);
    const savedList = await repo.getSavedStories(userAId, tokenA);
    const saveOk = savedList.length > 0 && savedList.some(s => s.storyId === targetStoryId);
    console.log(`  ✓ Save Story & Retrieve: count=${savedList.length}, matched target story: ${saveOk}`);
    results['user_save_story_crud'] = saveOk;

    // C. Vocabulary Persistence via User A JWT
    const vocabEntry = await repo.addVocabulary({
      id: `vocab-${testStamp}-hegemony`,
      userId: userAId,
      word: 'hegemony',
      sourceSentence: 'The report examines regional geopolitical hegemony.',
      contextualMeaning: 'Leadership or dominance by one country or social group over others.',
      originalDefinition: 'Dominant influence or authority over others.',
      originalLanguage: 'en',
      targetLanguage: 'hi',
      masteryLevel: 2,
      nextReviewDue: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    }, tokenA);
    const vocabList = await repo.getVocabulary(userAId, undefined, tokenA);
    const vocabOk = vocabList.length > 0 && vocabList[0].word === 'hegemony';
    console.log(`  ✓ Vocabulary persistence: word="${vocabList[0]?.word}", masteryLevel=${vocabList[0]?.masteryLevel}`);
    results['user_vocabulary_crud'] = vocabOk;

    // D. Reading History via User A JWT
    await repo.recordReading(userAId, targetStoryId, 180, tokenA);
    const historyList = await repo.getReadingHistory(userAId, 50, tokenA);
    const historyOk = historyList.length > 0 && historyList[0].storyId === targetStoryId;
    console.log(`  ✓ Reading History recorded & retrieved: entries=${historyList.length}, timeSpent=${historyList[0]?.timeSpentSeconds}s`);
    results['user_reading_history_crud'] = historyOk;

    // E. Two-User Cross-Tenant Isolation (RLS Verification)
    const bSaved = await repo.getSavedStories(userAId, tokenB);
    const bVocab = await repo.getVocabulary(userAId, undefined, tokenB);
    const bHist = await repo.getReadingHistory(userAId, 50, tokenB);
    const rlsBlockedSaved = bSaved.length === 0;
    const rlsBlockedVocab = bVocab.length === 0;
    const rlsBlockedHist = bHist.length === 0;
    console.log(`  ✓ RLS Check: User B reading User A saved stories -> ${bSaved.length} rows returned (Zero-Knowledge: ${rlsBlockedSaved})`);
    console.log(`  ✓ RLS Check: User B reading User A vocabulary -> ${bVocab.length} rows returned (Zero-Knowledge: ${rlsBlockedVocab})`);
    console.log(`  ✓ RLS Check: User B reading User A history -> ${bHist.length} rows returned (Zero-Knowledge: ${rlsBlockedHist})`);
    results['rls_two_user_isolation'] = rlsBlockedSaved && rlsBlockedVocab && rlsBlockedHist;

    // F. Anonymous Client Blocked from Private Data
    const { data: anonSaved } = await anonClient.from('saved_stories').select('*');
    const { data: anonVocab } = await anonClient.from('vocabulary_entries').select('*');
    const anonBlocked = (anonSaved?.length || 0) === 0 && (anonVocab?.length || 0) === 0;
    console.log(`  ✓ Anonymous Client blocked from private tables: ${anonBlocked}`);
    results['rls_anonymous_blocked'] = anonBlocked;

  } finally {
    // Cleanup temporary test accounts
    if (userAId) await adminClient.auth.admin.deleteUser(userAId);
    if (userBId) await adminClient.auth.admin.deleteUser(userBId);
    console.log(`  ✓ Cleaned up temporary test user accounts`);
  }

  // -----------------------------------------------------------------
  // 4. VERIFY CLOUD FAILURE DOES NOT FALL BACK TO LOCAL JSON
  // -----------------------------------------------------------------
  console.log(`\n[4] TESTING STRICT CLOUD OUTAGE / FAILURE HANDLING:`);
  let correctlyRejectedFallback = false;
  try {
    const origKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const origAnon = process.env.SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_ANON_KEY;

    createRepository('cloud'); // Must throw, must not return JsonFileRepository
    process.env.SUPABASE_SERVICE_ROLE_KEY = origKey;
    process.env.SUPABASE_ANON_KEY = origAnon;
  } catch (err: any) {
    correctlyRejectedFallback = err.message.includes('FATAL: PULSE_STORAGE_MODE is set to "cloud"');
    console.log(`  ✓ Missing cloud credentials test: ${err.message}`);
  }
  results['no_silent_fallback_on_missing_creds'] = correctlyRejectedFallback;

  // Restore env
  dotenv.config({ path: path.resolve(__dirname, '../../.env') });
  resetRepository('cloud');

  // -----------------------------------------------------------------
  // 5. LIVE HTTP API ENDPOINT TESTS (EXPRESS IN CLOUD MODE)
  // -----------------------------------------------------------------
  console.log(`\n[5] TESTING EXPRESS API ENDPOINTS IN CLOUD MODE:`);
  const baseUrl = 'http://localhost:3001';

  const resHealth = await fetch(`${baseUrl}/api/health`);
  const healthJson = await resHealth.json() as any;
  console.log(`  • GET /api/health: status=${resHealth.status}, storageMode="${healthJson.storageMode}", cloudConnected=${healthJson.cloudConnected}`);
  results['http_health_cloud_connected'] = resHealth.status === 200 && healthJson.storageMode === 'cloud' && healthJson.cloudConnected === true;

  const resStories = await fetch(`${baseUrl}/api/stories?limit=5`);
  const storiesJson = await resStories.json() as any;
  console.log(`  • GET /api/stories: status=${resStories.status}, total=${storiesJson.total}, count=${storiesJson.stories?.length}`);
  results['http_stories_endpoint'] = resStories.status === 200 && (storiesJson.stories?.length || 0) > 0;

  const resSources = await fetch(`${baseUrl}/api/sources`);
  const sourcesJson = await resSources.json() as any;
  const sourceCount = Array.isArray(sourcesJson) ? sourcesJson.length : 0;
  console.log(`  • GET /api/sources: status=${resSources.status}, count=${sourceCount}`);
  results['http_sources_endpoint'] = resSources.status === 200 && sourceCount >= 18;

  const resBriefings = await fetch(`${baseUrl}/api/briefings/latest?scope=international`);
  const briefingsJson = await resBriefings.json() as any;
  console.log(`  • GET /api/briefings/latest: status=${resBriefings.status}, scope="${briefingsJson?.scope}"`);
  results['http_briefings_endpoint'] = resBriefings.status === 200;

  // -----------------------------------------------------------------
  // SUMMARY REPORT
  // -----------------------------------------------------------------
  console.log(`\n======================================================`);
  console.log(`LIVE CLOUD ACTIVATION AUDIT SUMMARY`);
  console.log(`======================================================`);
  let allPassed = true;
  for (const [testName, passed] of Object.entries(results)) {
    console.log(`  ${passed ? '✓' : '✗'} ${testName.padEnd(42)}: ${passed ? 'PASS' : 'FAIL'}`);
    if (!passed) allPassed = false;
  }
  console.log(`======================================================`);
  console.log(`OVERALL CLOUD ACTIVATION STATUS: ${allPassed ? 'ALL PASS (READY)' : 'FAILED'}`);
  console.log(`======================================================\n`);

  if (!allPassed) {
    process.exit(1);
  }
}

runLiveCloudActivationAudit().catch(err => {
  console.error('[Fatal Activation Verification Error]', err);
  process.exit(1);
});
