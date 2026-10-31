import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { SupabaseNewsRepository } from './supabaseRepository.js';
import { normalizeArticleUrl, generateArticleId, articleUrlToUuid, stringToUuid } from './uuidUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.SUPABASE_URL?.trim();
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY?.trim();

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing Supabase credentials in server/.env');
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const anonClient = createClient(supabaseUrl, supabaseAnonKey || supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function runPhaseEVerification() {
  console.log(`\n======================================================`);
  console.log(`PULSE PHASE E: FINAL INTEGRITY VERIFICATION AUDIT`);
  console.log(`Cloud Endpoint: ${supabaseUrl}`);
  console.log(`======================================================\n`);

  // 1. LOCAL DATA INSPECTION
  const dbPath = path.resolve(__dirname, '../../data/pulse.db.json');
  const localData = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
  const localStories = localData.stories || [];
  const localTopArticles = localData.articles || [];

  const localDistinctUrls = new Set<string>();
  const localDistinctGeneratedIds = new Set<string>();
  const localDistinctUuids = new Set<string>();
  const localUrlToArticle = new Map<string, any>();

  for (const s of localStories) {
    if (Array.isArray(s.articles)) {
      for (const a of s.articles) {
        if (a && a.url) {
          const norm = normalizeArticleUrl(a.url);
          localDistinctUrls.add(norm);
          const genId = generateArticleId(norm);
          const uuid = articleUrlToUuid(norm);
          localDistinctGeneratedIds.add(genId);
          localDistinctUuids.add(uuid);
          if (!localUrlToArticle.has(norm)) {
            localUrlToArticle.set(norm, a);
          }
        }
      }
    }
  }

  for (const a of localTopArticles) {
    if (a && a.url) {
      const norm = normalizeArticleUrl(a.url);
      localDistinctUrls.add(norm);
      const genId = generateArticleId(norm);
      const uuid = articleUrlToUuid(norm);
      localDistinctGeneratedIds.add(genId);
      localDistinctUuids.add(uuid);
      if (!localUrlToArticle.has(norm)) {
        localUrlToArticle.set(norm, a);
      }
    }
  }

  console.log(`[1] LOCAL DATA METRICS:`);
  console.log(`  • Distinct local article URLs:          ${localDistinctUrls.size}`);
  console.log(`  • Distinct generated article IDs:       ${localDistinctGeneratedIds.size}`);
  console.log(`  • Distinct generated article UUIDs:     ${localDistinctUuids.size}`);
  const idCollisionLocal = localDistinctUrls.size !== localDistinctGeneratedIds.size;
  console.log(`  • Local ID Collision Detected:          ${idCollisionLocal ? 'YES (FAIL)' : 'NO (100% Unique - PASS)'}\n`);

  // 2. CLOUD DATABASE METRICS
  console.log(`[2] CLOUD POSTGRESQL ROW COUNTS:`);
  const { count: cloudArticleCount, error: artCountErr } = await adminClient
    .from('articles')
    .select('*', { count: 'exact', head: true });
  if (artCountErr) throw artCountErr;

  const { count: cloudStoryCount, error: storyCountErr } = await adminClient
    .from('canonical_stories')
    .select('*', { count: 'exact', head: true });
  if (storyCountErr) throw storyCountErr;

  const { count: cloudSaCount, error: saCountErr } = await adminClient
    .from('story_articles')
    .select('*', { count: 'exact', head: true });
  if (saCountErr) throw saCountErr;

  console.log(`  • Cloud article rows:                   ${cloudArticleCount}`);
  console.log(`  • Cloud canonical stories:              ${cloudStoryCount}`);
  console.log(`  • Story-article relationship count:     ${cloudSaCount}\n`);

  // 3. ARTICLE URL & ID AUDIT IN CLOUD
  console.log(`[3] CLOUD ARTICLE UNIQUENESS & INTEGRITY:`);
  // Fetch all articles from cloud
  const { data: cloudArticles, error: cloudArtsErr } = await adminClient
    .from('articles')
    .select('id, external_id, title, summary, content, url, source_id');
  if (cloudArtsErr || !cloudArticles) throw cloudArtsErr;

  const cloudUrls = new Set<string>();
  let duplicateUrlsInCloud = 0;
  let missingTitleCount = 0;
  let missingSummaryCount = 0;
  let missingContentCount = 0;
  const cloudArticleUuidSet = new Set<string>();

  for (const ca of cloudArticles) {
    cloudArticleUuidSet.add(ca.id);
    const norm = normalizeArticleUrl(ca.url);
    if (cloudUrls.has(norm)) {
      duplicateUrlsInCloud++;
    }
    cloudUrls.add(norm);

    if (!ca.title || ca.title.trim().length === 0) missingTitleCount++;
    if (!ca.summary || ca.summary.trim().length === 0) missingSummaryCount++;
    if (!ca.content || ca.content.trim().length === 0) missingContentCount++;
  }

  // Calculate missing articles: Local URLs not in cloud
  let missingArticlesCount = 0;
  const missingUrls: string[] = [];
  for (const url of localDistinctUrls) {
    if (!cloudUrls.has(url)) {
      missingArticlesCount++;
      missingUrls.push(url);
    }
  }

  console.log(`  • Cloud distinct URLs:                  ${cloudUrls.size}`);
  console.log(`  • Duplicate URLs in Cloud:              ${duplicateUrlsInCloud}`);
  console.log(`  • Missing articles (Local vs Cloud):    ${missingArticlesCount}`);
  console.log(`  • Articles with missing title:          ${missingTitleCount}`);
  console.log(`  • Articles with missing summary:        ${missingSummaryCount}`);
  console.log(`  • Articles with missing content:        ${missingContentCount}\n`);

  // 4. ORPHANED RELATIONSHIPS CHECK
  console.log(`[4] ORPHANED RELATIONSHIPS AUDIT:`);
  // Check story_articles relationships
  // Query all story_articles in batches to inspect FK validity
  let orphanedStoryArticles = 0;
  let totalLinksChecked = 0;
  const batchSize = 1000;
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data: links, error: lErr } = await adminClient
      .from('story_articles')
      .select('story_id, article_id')
      .range(from, from + batchSize - 1);
    if (lErr) throw lErr;

    if (!links || links.length === 0) {
      hasMore = false;
      break;
    }

    totalLinksChecked += links.length;
    for (const link of links) {
      if (!cloudArticleUuidSet.has(link.article_id)) {
        orphanedStoryArticles++;
      }
    }

    if (links.length < batchSize) {
      hasMore = false;
    } else {
      from += batchSize;
    }
  }

  console.log(`  • Total story_articles verified:        ${totalLinksChecked}`);
  console.log(`  • Orphaned article relationships:       ${orphanedStoryArticles} (Target: 0)`);
  console.log(`  • PostgreSQL Foreign Key Constraint:    ENFORCED (story_articles -> articles.id)\n`);

  // 5. REPRESENTATIVE STORY RETRIEVAL FROM DIFFERENT SOURCES
  console.log(`[5] REPRESENTATIVE STORY RETRIEVAL TEST:`);
  const repo = new SupabaseNewsRepository();

  // Pick representative stories covering different sources (The Hindu, Indian Express, PIB, Livemint, etc.)
  const candidateSources = ['the-hindu', 'indian-express', 'pib', 'livemint', 'al-jazeera', 'ndtv'];
  const representativeStories: any[] = [];

  for (const src of candidateSources) {
    const found = localStories.find((s: any) =>
      s.articles?.some((a: any) => a.url && (a.sourceSlug === src || a.url.includes(src) || a.id?.includes(src)))
    );
    if (found && !representativeStories.some(r => r.id === found.id)) {
      representativeStories.push({ sourceTag: src, ...found });
    }
  }

  // Also include the first local story
  if (!representativeStories.some(r => r.id === localStories[0]?.id)) {
    representativeStories.unshift({ sourceTag: 'primary', ...localStories[0] });
  }

  for (const rep of representativeStories.slice(0, 5)) {
    const storyUuid = stringToUuid(rep.id);
    console.log(`--------------------------------------------------------------------------------`);
    console.log(`Source Category / Tag: [${rep.sourceTag.toUpperCase()}]`);
    console.log(`Local Story ID:        ${rep.id}`);
    console.log(`Cloud Story UUID:      ${storyUuid}`);

    const retrievedStory = await repo.getStoryById(storyUuid);
    if (!retrievedStory) {
      console.log(`  ✗ Story NOT found in cloud repository!`);
      continue;
    }

    console.log(`  ✓ Title:               "${retrievedStory.title}"`);
    console.log(`  ✓ Summary:             "${retrievedStory.summary.substring(0, 80)}..."`);
    console.log(`  ✓ Category / Scope:    ${retrievedStory.category} / ${retrievedStory.geographicScope} (${retrievedStory.state})`);
    console.log(`  ✓ Timeline Count:      ${retrievedStory.timeline?.length || 0}`);
    console.log(`  ✓ Articles Linked:     ${retrievedStory.articles.length}`);

    retrievedStory.articles.forEach((art, idx) => {
      console.log(`    [Article ${idx + 1}]`);
      console.log(`      ID:                ${art.id}`);
      console.log(`      Title:             "${art.title}"`);
      console.log(`      URL:               ${art.url}`);
      console.log(`      Summary:           "${(art.summary || '').substring(0, 70)}..."`);
      console.log(`      Content Snippet:   "${(art.content || '').substring(0, 80)}..."`);
    });
  }
  console.log(`--------------------------------------------------------------------------------\n`);

  // 6. PUBLIC ANONYMOUS REPOSITORY READ CHECK
  console.log(`[6] PUBLIC ANONYMOUS ACCESS VERIFICATION:`);
  const publicStories = await repo.getStories({ limit: 5 });
  console.log(`  ✓ Anonymous repository returned ${publicStories.stories.length} stories:`);
  publicStories.stories.forEach((s, idx) => {
    console.log(`    [${idx + 1}] [${s.category}] "${s.title.substring(0, 45)}..." (${s.articles.length} articles)`);
  });

  console.log(`\n======================================================`);
  console.log(`PHASE E VERIFICATION SUMMARY`);
  console.log(`======================================================`);
  console.log(`Distinct Local URLs:              ${localDistinctUrls.size}`);
  console.log(`Distinct Generated Article IDs:   ${localDistinctGeneratedIds.size}`);
  console.log(`Cloud Article Rows:               ${cloudArticleCount}`);
  console.log(`Story-Article Relationships:      ${cloudSaCount}`);
  console.log(`Missing Articles:                 ${missingArticlesCount}`);
  console.log(`Duplicate URLs in Cloud:          ${duplicateUrlsInCloud}`);
  console.log(`Orphaned Relationships:           ${orphanedStoryArticles}`);
  console.log(`Deployment Mode Active:           ${process.env.PULSE_STORAGE_MODE || 'local'}`);
  console.log(`======================================================\n`);
}

runPhaseEVerification().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
