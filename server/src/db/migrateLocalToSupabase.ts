import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { getSupabaseAdminClient } from './supabaseClient.js';
import { 
  stringToUuid, 
  articleUrlToUuid, 
  generateArticleId, 
  normalizeArticleUrl 
} from './uuidUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const DB_PATH = path.resolve(__dirname, '../../data/pulse.db.json');
const BATCH_SIZE = 100;

export interface MigrationSummary {
  dryRun: boolean;
  timestamp: string;
  sourcesMigrated: number;
  articlesMigrated: number;
  storiesMigrated: number;
  storyArticlesLinked: number;
  timelineEventsMigrated: number;
  briefingsMigrated: number;
  briefingStoriesLinked: number;
  perspectivesMigrated: number;
  vocabularyMigrated: number;
  obsoleteArticlesPurged: number;
  skippedGuestRecords: number;
  errors: string[];
}

export async function runLocalToSupabaseMigration(dryRun = false): Promise<MigrationSummary> {
  const summary: MigrationSummary = {
    dryRun,
    timestamp: new Date().toISOString(),
    sourcesMigrated: 0,
    articlesMigrated: 0,
    storiesMigrated: 0,
    storyArticlesLinked: 0,
    timelineEventsMigrated: 0,
    briefingsMigrated: 0,
    briefingStoriesLinked: 0,
    perspectivesMigrated: 0,
    vocabularyMigrated: 0,
    obsoleteArticlesPurged: 0,
    skippedGuestRecords: 0,
    errors: [],
  };

  console.log(`\n======================================================`);
  console.log(`PULSE DATA MIGRATION: JSON -> SUPABASE POSTGRESQL`);
  console.log(`Mode: ${dryRun ? 'DRY-RUN (Simulated — No database writes)' : 'LIVE EXECUTION'}`);
  console.log(`Source: ${DB_PATH}`);
  console.log(`======================================================\n`);

  if (!fs.existsSync(DB_PATH)) {
    throw new Error(`[Migration] Local database file not found at ${DB_PATH}`);
  }

  const rawJson = fs.readFileSync(DB_PATH, 'utf-8');
  const localData = JSON.parse(rawJson);

  const adminClient = getSupabaseAdminClient();
  if (!dryRun && !adminClient) {
    throw new Error(
      '[Migration] Cannot run live migration: SUPABASE_SERVICE_ROLE_KEY is missing or invalid in server/.env.'
    );
  }

  // 1. MIGRATE NEWS SOURCES
  const sources = localData.sources || [];
  console.log(`[1/7] Migrating ${sources.length} news sources...`);
  const sourceRows: any[] = [];
  for (const src of sources) {
    const sourceUuid = stringToUuid(src.id || src.slug);
    sourceRows.push({
      id: sourceUuid,
      slug: src.slug,
      name: src.name,
      url: src.url,
      rss_url: src.rssUrl,
      geographic_scope: src.geographicScope || 'national',
      country: src.country || 'IN',
      state: src.state,
      category: src.category || 'general',
      is_enabled: src.isEnabled ?? true,
      is_official: src.isOfficial ?? false,
      trust_tier: src.trustTier || 'verified_media',
      fetch_frequency_minutes: src.fetchFrequencyMinutes || 30,
      last_fetched_at: src.lastFetchedAt,
      last_error: src.lastError,
      updated_at: new Date().toISOString(),
    });
  }

  if (!dryRun && adminClient && sourceRows.length > 0) {
    const { error } = await adminClient.from('news_sources').upsert(sourceRows, { onConflict: 'slug' });
    if (error) {
      summary.errors.push(`News sources batch upsert error: ${error.message}`);
      console.error('  ✗ Sources upsert failed:', error.message);
    } else {
      summary.sourcesMigrated = sourceRows.length;
      console.log(`  ✓ ${summary.sourcesMigrated} news sources upserted.`);
    }
  } else {
    summary.sourcesMigrated = sourceRows.length;
  }

  // 2. MIGRATE CANONICAL STORIES
  const stories = localData.stories || [];
  console.log(`\n[2/7] Migrating ${stories.length} canonical stories...`);
  const validStoryUuids = new Set<string>();
  const storyRows: any[] = [];
  const articleMap = new Map<string, any>();
  const storyArticleMap = new Map<string, any>();
  const timelineMap = new Map<string, any>();

  for (const s of stories) {
    const storyUuid = stringToUuid(s.id);
    validStoryUuids.add(storyUuid);

    storyRows.push({
      id: storyUuid,
      title: s.title,
      summary: s.summary,
      why_it_matters: s.whyItMatters,
      general_take: s.generalTake,
      geographic_scope: s.geographicScope || 'national',
      country: s.country || 'IN',
      state: s.state,
      category: s.category || 'general',
      lead_image_url: s.leadImageUrl,
      evidence_status: s.evidenceStatus || 'corroborated_by_sources',
      importance_level: s.importanceLevel || 'normal',
      first_reported_at: s.firstReportedAt || new Date().toISOString(),
      last_updated_at: s.lastUpdatedAt || new Date().toISOString(),
      india_implication: s.indiaImplication,
      is_perspective_available: s.isPerspectiveAvailable ?? true,
      is_live_ingested: s.isLiveIngested ?? true,
    });

    // Collect deduplicated articles using deterministic URL-based UUID
    if (s.articles && Array.isArray(s.articles)) {
      for (const art of s.articles) {
        if (!art.url) continue;
        const articleUuid = articleUrlToUuid(art.url);
        const sourceUuid = stringToUuid(art.sourceId);

        if (!articleMap.has(articleUuid)) {
          articleMap.set(articleUuid, {
            id: articleUuid,
            source_id: sourceUuid,
            external_id: generateArticleId(art.url),
            title: art.title,
            summary: art.summary,
            content: art.content || art.summary,
            url: art.url,
            author: art.author,
            lead_image_url: art.leadImageUrl,
            published_at: art.publishedAt || new Date().toISOString(),
            ingested_at: art.ingestedAt || new Date().toISOString(),
            geographic_scope: art.geographicScope || s.geographicScope || 'national',
            country: art.country || 'IN',
            state: art.state || s.state,
            category: art.category || s.category || 'general',
            language: art.language || 'en',
            evidence_label: art.evidenceLabel || 'reported_by_source',
            is_opinion: art.isOpinion ?? false,
            is_live_ingested: art.isLiveIngested ?? true,
          });
        }

        const linkKey = `${storyUuid}-${articleUuid}`;
        if (!storyArticleMap.has(linkKey)) {
          storyArticleMap.set(linkKey, {
            story_id: storyUuid,
            article_id: articleUuid,
            is_primary_source: s.articles[0]?.url === art.url,
            relevance_score: 1.0,
          });
        }
      }
    }

    // Collect deduplicated timeline events
    if (s.timeline && Array.isArray(s.timeline)) {
      for (const ev of s.timeline) {
        const evUuid = stringToUuid(ev.id || `${s.id}-${ev.eventTimestamp}`);
        if (!timelineMap.has(evUuid)) {
          timelineMap.set(evUuid, {
            id: evUuid,
            story_id: storyUuid,
            event_timestamp: ev.eventTimestamp || new Date().toISOString(),
            title: ev.title,
            description: ev.description,
            what_changed: ev.whatChanged,
            source_name: ev.sourceName || 'Verified Source',
            source_url: ev.sourceUrl || '',
            evidence_status: ev.evidenceStatus || 'corroborated_by_sources',
          });
        }
      }
    }
  }

  // Also scan top-level articles array to ensure any standalone ingested articles are preserved
  if (localData.articles && Array.isArray(localData.articles)) {
    for (const art of localData.articles) {
      if (!art.url) continue;
      const articleUuid = articleUrlToUuid(art.url);
      if (!articleMap.has(articleUuid)) {
        const sourceUuid = stringToUuid(art.sourceId);
        articleMap.set(articleUuid, {
          id: articleUuid,
          source_id: sourceUuid,
          external_id: generateArticleId(art.url),
          title: art.title,
          summary: art.summary,
          content: art.content || art.summary,
          url: art.url,
          author: art.author,
          lead_image_url: art.leadImageUrl,
          published_at: art.publishedAt || new Date().toISOString(),
          ingested_at: art.ingestedAt || new Date().toISOString(),
          geographic_scope: art.geographicScope || 'national',
          country: art.country || 'IN',
          state: art.state,
          category: art.category || 'general',
          language: art.language || 'en',
          evidence_label: art.evidenceLabel || 'reported_by_source',
          is_opinion: art.isOpinion ?? false,
          is_live_ingested: art.isLiveIngested ?? true,
        });
      }
    }
  }

  // Batch insert canonical stories
  if (!dryRun && adminClient) {
    for (let i = 0; i < storyRows.length; i += BATCH_SIZE) {
      const chunk = storyRows.slice(i, i + BATCH_SIZE);
      const { error } = await adminClient.from('canonical_stories').upsert(chunk, { onConflict: 'id' });
      if (error) {
        summary.errors.push(`Stories batch ${i / BATCH_SIZE + 1} failed: ${error.message}`);
      } else {
        summary.storiesMigrated += chunk.length;
      }
      process.stdout.write(`  Stories: ${summary.storiesMigrated}/${storyRows.length}\r`);
    }
    console.log(`  ✓ ${summary.storiesMigrated} canonical stories upserted.`);
  } else {
    summary.storiesMigrated = storyRows.length;
  }

  // 3. MIGRATE ARTICLES & STORY-ARTICLE RELATIONSHIPS
  const articleRows = Array.from(articleMap.values());
  console.log(`\n[3/7] Migrating ${articleRows.length} unique articles & ${storyArticleMap.size} story links...`);

  if (!dryRun && adminClient) {
    // Insert articles
    for (let i = 0; i < articleRows.length; i += BATCH_SIZE) {
      const chunk = articleRows.slice(i, i + BATCH_SIZE);
      const { error } = await adminClient.from('articles').upsert(chunk, { onConflict: 'id' });
      if (error) {
        summary.errors.push(`Articles batch ${i / BATCH_SIZE + 1} failed: ${error.message}`);
      } else {
        summary.articlesMigrated += chunk.length;
      }
      process.stdout.write(`  Articles: ${summary.articlesMigrated}/${articleRows.length}\r`);
    }
    console.log(`  ✓ ${summary.articlesMigrated} articles upserted.`);

    // Insert story-articles links
    const storyArticleRows = Array.from(storyArticleMap.values());
    for (let i = 0; i < storyArticleRows.length; i += BATCH_SIZE) {
      const chunk = storyArticleRows.slice(i, i + BATCH_SIZE);
      const { error } = await adminClient.from('story_articles').upsert(chunk, { onConflict: 'story_id,article_id' });
      if (error) {
        summary.errors.push(`Story articles batch ${i / BATCH_SIZE + 1} failed: ${error.message}`);
      } else {
        summary.storyArticlesLinked += chunk.length;
      }
      process.stdout.write(`  Story Links: ${summary.storyArticlesLinked}/${storyArticleRows.length}\r`);
    }
    console.log(`  ✓ ${summary.storyArticlesLinked} story-article links upserted.`);

    // Safe reconciliation & cleanup of obsolete collapsed records
    console.log(`\n[Reconciliation] Auditing cloud articles table for obsolete collapsed records...`);
    const validNewUuids = new Set(articleRows.map(a => a.id));
    const { data: cloudArticles, error: getCloudErr } = await adminClient
      .from('articles')
      .select('id, title, url');

    if (getCloudErr) {
      summary.errors.push(`Failed to audit existing cloud articles: ${getCloudErr.message}`);
    } else if (cloudArticles) {
      const obsoleteArticles = cloudArticles.filter(ca => !validNewUuids.has(ca.id));
      console.log(`  Cloud articles currently in database: ${cloudArticles.length}`);
      console.log(`  Identified obsolete collapsed records to purge: ${obsoleteArticles.length}`);

      if (obsoleteArticles.length > 0) {
        const obsoleteIds = obsoleteArticles.map(oa => oa.id);

        // Step A: Remove obsolete links from story_articles
        const { error: delLinkErr } = await adminClient
          .from('story_articles')
          .delete()
          .in('article_id', obsoleteIds);

        if (delLinkErr) {
          summary.errors.push(`Failed to clean up obsolete story_articles links: ${delLinkErr.message}`);
        } else {
          console.log(`  ✓ Cleaned up obsolete story_articles links.`);
        }

        // Step B: Remove obsolete records from articles
        const { error: delArtErr } = await adminClient
          .from('articles')
          .delete()
          .in('id', obsoleteIds);

        if (delArtErr) {
          summary.errors.push(`Failed to clean up obsolete article rows: ${delArtErr.message}`);
        } else {
          summary.obsoleteArticlesPurged = obsoleteIds.length;
          console.log(`  ✓ Successfully purged ${obsoleteIds.length} obsolete collapsed article records.`);
        }
      }
    }
  } else {
    summary.articlesMigrated = articleRows.length;
    summary.storyArticlesLinked = storyArticleMap.size;
  }

  // 4. MIGRATE TIMELINE EVENTS
  const timelineRows = Array.from(timelineMap.values());
  console.log(`\n[4/7] Migrating ${timelineRows.length} timeline events...`);

  if (!dryRun && adminClient) {
    for (let i = 0; i < timelineRows.length; i += BATCH_SIZE) {
      const chunk = timelineRows.slice(i, i + BATCH_SIZE);
      const { error } = await adminClient.from('story_timeline_events').upsert(chunk, { onConflict: 'id' });
      if (error) {
        summary.errors.push(`Timeline events batch ${i / BATCH_SIZE + 1} failed: ${error.message}`);
      } else {
        summary.timelineEventsMigrated += chunk.length;
      }
      process.stdout.write(`  Timeline: ${summary.timelineEventsMigrated}/${timelineRows.length}\r`);
    }
    console.log(`  ✓ ${summary.timelineEventsMigrated} timeline events upserted.`);
  } else {
    summary.timelineEventsMigrated = timelineRows.length;
  }

  // 5. MIGRATE HOURLY BRIEFINGS & BRIEFING-STORIES
  const briefings = localData.briefings || [];
  console.log(`\n[5/7] Migrating ${briefings.length} hourly briefings...`);
  const briefingRows: any[] = [];
  const briefingStoryRows: any[] = [];

  for (const b of briefings) {
    const briefingUuid = stringToUuid(b.id);
    briefingRows.push({
      id: briefingUuid,
      time_window_start: b.timeWindowStart || new Date().toISOString(),
      time_window_end: b.timeWindowEnd || new Date().toISOString(),
      generated_at: b.generatedAt || new Date().toISOString(),
      scope: b.scope || 'global',
      state: b.state,
      data_freshness_minutes: b.dataFreshnessMinutes || 5,
      summary_overview: b.summaryOverview,
      important_developments: b.importantDevelopments || [],
      what_changed_since_previous: b.whatChangedSincePrevious || { newStoriesCount: 0, substantiveUpdatesCount: 0, highlights: [] },
      source_count: b.sourceCount || 0,
    });

    // Link briefing stories if the referenced story exists
    if (b.importantDevelopments && Array.isArray(b.importantDevelopments)) {
      b.importantDevelopments.forEach((dev: any, idx: number) => {
        if (dev.storyId) {
          const storyUuid = stringToUuid(dev.storyId);
          if (validStoryUuids.has(storyUuid)) {
            briefingStoryRows.push({
              briefing_id: briefingUuid,
              story_id: storyUuid,
              order_index: idx,
            });
          }
        }
      });
    }
  }

  if (!dryRun && adminClient && briefingRows.length > 0) {
    const { error: brErr } = await adminClient.from('hourly_pulse_briefings').upsert(briefingRows, { onConflict: 'id' });
    if (brErr) {
      summary.errors.push(`Briefings upsert failed: ${brErr.message}`);
    } else {
      summary.briefingsMigrated = briefingRows.length;
      console.log(`  ✓ ${summary.briefingsMigrated} hourly briefings upserted.`);
    }

    if (briefingStoryRows.length > 0) {
      const { error: bsErr } = await adminClient.from('briefing_stories').upsert(briefingStoryRows, { onConflict: 'briefing_id,story_id' });
      if (bsErr) {
        summary.errors.push(`Briefing stories links upsert failed: ${bsErr.message}`);
      } else {
        summary.briefingStoriesLinked = briefingStoryRows.length;
        console.log(`  ✓ ${summary.briefingStoriesLinked} briefing-story links upserted.`);
      }
    }
  } else {
    summary.briefingsMigrated = briefingRows.length;
    summary.briefingStoriesLinked = briefingStoryRows.length;
  }

  // 6. MIGRATE PERSPECTIVES
  const perspectives = Object.values(localData.perspectives || {});
  console.log(`\n[6/7] Migrating ${perspectives.length} perspective analyses...`);
  const perspectiveRows: any[] = [];

  for (const p of perspectives as any[]) {
    const storyUuid = stringToUuid(p.storyId);
    if (!validStoryUuids.has(storyUuid)) {
      console.warn(`  ! Skipping perspective referencing unknown story: ${p.storyId}`);
      continue;
    }

    const perspUuid = stringToUuid(p.id || `persp-${p.storyId}`);
    perspectiveRows.push({
      id: perspUuid,
      story_id: storyUuid,
      what_happened: p.whatHappened,
      general_take: p.generalTake,
      why_it_matters: p.whyItMatters,
      perspectives_in_favor: p.perspectivesInFavor || [],
      perspectives_against: p.perspectivesAgainst || [],
      affected_groups_concerns: p.affectedGroupsConcerns || [],
      expert_institutional_views: p.expertInstitutionalViews || [],
      evidence_well_established: p.evidenceWellEstablished || [],
      evidence_preliminary: p.evidencePreliminary || [],
      evidence_disputed: p.evidenceDisputed || [],
      evidence_missing: p.evidenceMissing || [],
      possible_consequences_positive: p.possibleConsequencesPositive || [],
      possible_consequences_negative: p.possibleConsequencesNegative || [],
      what_to_watch_next: p.whatToWatchNext || [],
      perspective_comparison: p.perspectiveComparison || [],
      ai_provider: p.aiProvider || 'pulse-orchestrator',
      updated_at: new Date().toISOString(),
    });
  }

  if (!dryRun && adminClient && perspectiveRows.length > 0) {
    const { error: pErr } = await adminClient.from('perspective_analyses').upsert(perspectiveRows, { onConflict: 'story_id' });
    if (pErr) {
      summary.errors.push(`Perspectives upsert failed: ${pErr.message}`);
    } else {
      summary.perspectivesMigrated = perspectiveRows.length;
      console.log(`  ✓ ${summary.perspectivesMigrated} perspective analyses upserted.`);
    }
  } else {
    summary.perspectivesMigrated = perspectiveRows.length;
  }

  // 7. GUEST USER DATA SAFETY RULE
  const vocab = localData.vocabulary || [];
  console.log(`\n[7/7] Reviewing ${vocab.length} vocabulary entries for guest ownership safety...`);
  for (const v of vocab) {
    if (v.userId === 'guest-user-default' || v.userId?.startsWith('guest-')) {
      summary.skippedGuestRecords++;
    } else {
      summary.vocabularyMigrated++;
    }
  }
  console.log(`  ✓ ${summary.skippedGuestRecords} unmapped guest records preserved in pulse.db.json (Not orphaned into cloud)`);

  console.log(`\n======================================================`);
  console.log(`MIGRATION SUMMARY RESULT:`);
  console.log(`- Mode: ${dryRun ? 'DRY RUN' : 'LIVE COMPLETED'}`);
  console.log(`- News Sources: ${summary.sourcesMigrated}`);
  console.log(`- Canonical Stories: ${summary.storiesMigrated}`);
  console.log(`- Articles: ${summary.articlesMigrated}`);
  console.log(`- Story Articles Linked: ${summary.storyArticlesLinked}`);
  console.log(`- Timeline Events: ${summary.timelineEventsMigrated}`);
  console.log(`- Hourly Briefings: ${summary.briefingsMigrated}`);
  console.log(`- Briefing Stories Linked: ${summary.briefingStoriesLinked}`);
  console.log(`- Perspectives: ${summary.perspectivesMigrated}`);
  console.log(`- Obsolete Articles Purged: ${summary.obsoleteArticlesPurged}`);
  console.log(`- Skipped Unmapped Guest Records: ${summary.skippedGuestRecords} (Preserved in pulse.db.json)`);
  console.log(`- Total Errors: ${summary.errors.length}`);
  console.log(`======================================================\n`);

  return summary;
}

// Allow direct CLI invocation
if (process.argv[1] && process.argv[1].endsWith('migrateLocalToSupabase.ts')) {
  const isDryRun = process.argv.includes('--dry-run');
  runLocalToSupabaseMigration(isDryRun)
    .then(res => {
      if (res.errors.length > 0) {
        process.exit(1);
      }
      process.exit(0);
    })
    .catch(err => {
      console.error('[Migration] Failed:', err);
      process.exit(1);
    });
}
