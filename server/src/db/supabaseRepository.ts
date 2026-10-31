import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient, getSupabaseAdminClient, createScopedSupabaseClient } from './supabaseClient.js';
import { 
  INewsRepository, 
  StorageMode, 
  StoryFilterOptions, 
  VocabularyFilterOptions, 
  SavedStoryRecord, 
  ReadingHistoryRecord, 
  VocabularyReviewRecord, 
  UserProfileRecord, 
  RepositoryDiagnostics 
} from './types.js';
import { 
  NewsSource, 
  Article, 
  CanonicalStory, 
  HourlyPulseBriefing, 
  PerspectiveAnalysis, 
  VocabularyEntry, 
  UserPreferences, 
  NotificationRecord, 
  PushSubscriptionRecord, 
  AskMessage, 
  IngestionMetric,
  StoryTimelineEvent
} from '../types/index.js';
import { stringToUuid, articleUrlToUuid } from './uuidUtils.js';

export class SupabaseNewsRepository implements INewsRepository {
  private anonClient: SupabaseClient | null;
  private adminClient: SupabaseClient | null;

  constructor() {
    this.anonClient = getSupabaseClient();
    this.adminClient = getSupabaseAdminClient();

    if (!this.adminClient && !this.anonClient) {
      throw new Error(
        '[SupabaseNewsRepository] Cannot initialize: Supabase credentials are not configured in server/.env. ' +
        'Set PULSE_STORAGE_MODE=local or configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
      );
    }
  }

  getMode(): StorageMode {
    return 'cloud';
  }

  /**
   * Helper to resolve the appropriate Supabase client:
   * 1. useAdmin = true: Strictly used for trusted server-side background tasks (ingestion, briefings, telemetry).
   * 2. token provided: Instantiates an immutable, request-scoped client carrying the verified user JWT,
   *    ensuring PostgreSQL RLS evaluates auth.uid() = user_id without mutable state leaks.
   * 3. no token: Uses the anonymous client for public editorial reads.
   */
  private getClient(tokenOrAdmin: string | boolean = false, explicitAdmin = false): SupabaseClient {
    const useAdmin = typeof tokenOrAdmin === 'boolean' ? tokenOrAdmin : explicitAdmin;
    const token = typeof tokenOrAdmin === 'string' ? tokenOrAdmin : undefined;

    if (useAdmin) {
      if (!this.adminClient) {
        throw new Error('[SupabaseNewsRepository] Service-role admin client unavailable for background task.');
      }
      return this.adminClient;
    }

    if (token) {
      return createScopedSupabaseClient(token);
    }

    if (this.anonClient) {
      return this.anonClient;
    }

    // Fallback if only adminClient was initialized in local test environment
    if (this.adminClient) {
      return this.adminClient;
    }

    throw new Error('[SupabaseNewsRepository] Supabase client unavailable.');
  }

  async ping(): Promise<boolean> {
    const t0 = Date.now();
    try {
      const client = this.getClient(true);
      const { error } = await client.from('news_sources').select('id', { count: 'exact', head: true });
      if (error) {
        console.error('[SupabaseNewsRepository] Ping failed:', error.message);
        return false;
      }
      return true;
    } catch (err: any) {
      console.error('[SupabaseNewsRepository] Connection ping exception:', err.message || err);
      return false;
    }
  }

  async getDiagnostics(): Promise<RepositoryDiagnostics> {
    const t0 = Date.now();
    try {
      const client = this.getClient(true);

      const [sourcesRes, storiesRes, articlesRes, briefingsRes, perspRes, vocabRes] = await Promise.all([
        client.from('news_sources').select('id, is_enabled', { count: 'exact' }),
        client.from('canonical_stories').select('id', { count: 'exact', head: true }),
        client.from('articles').select('id', { count: 'exact', head: true }),
        client.from('hourly_pulse_briefings').select('id, generated_at', { count: 'exact' }).order('generated_at', { ascending: false }).limit(1),
        client.from('perspective_analyses').select('id', { count: 'exact', head: true }),
        client.from('vocabulary_entries').select('id', { count: 'exact', head: true }),
      ]);

      const latencyMs = Date.now() - t0;
      const sources = sourcesRes.data || [];
      const latestBriefing = briefingsRes.data?.[0];

      return {
        mode: 'cloud',
        isConnected: !sourcesRes.error && !storiesRes.error,
        sourcesCount: sourcesRes.count || sources.length,
        activeSourcesCount: sources.filter(s => s.is_enabled).length,
        storiesCount: storiesRes.count || 0,
        articlesCount: articlesRes.count || 0,
        briefingsCount: briefingsRes.count || 0,
        perspectivesCount: perspRes.count || 0,
        vocabularyCount: vocabRes.count || 0,
        lastHourlyPulseRun: latestBriefing?.generated_at,
        cachedTranslationsCount: 0,
        cachedDefinitionsCount: 0,
        latencyMs,
      };
    } catch (err: any) {
      return {
        mode: 'cloud',
        isConnected: false,
        sourcesCount: 0,
        activeSourcesCount: 0,
        storiesCount: 0,
        articlesCount: 0,
        briefingsCount: 0,
        perspectivesCount: 0,
        vocabularyCount: 0,
        cachedTranslationsCount: 0,
        cachedDefinitionsCount: 0,
        latencyMs: Date.now() - t0,
        errorMessage: err.message,
      };
    }
  }

  // ==========================================
  // NEWS SOURCES
  // ==========================================
  async getSources(): Promise<NewsSource[]> {
    const client = this.getClient();
    const { data, error } = await client
      .from('news_sources')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw new Error(`[Supabase] Failed to fetch sources: ${error.message}`);
    return (data || []).map(this.mapSourceRowToDomain);
  }

  async getSourceById(id: string): Promise<NewsSource | undefined> {
    const client = this.getClient();
    const uuid = stringToUuid(id);
    const { data, error } = await client
      .from('news_sources')
      .select('*')
      .or(`id.eq.${uuid},slug.eq.${id}`)
      .maybeSingle();

    if (error) throw new Error(`[Supabase] Error finding source: ${error.message}`);
    return data ? this.mapSourceRowToDomain(data) : undefined;
  }

  async updateSource(id: string, updates: Partial<NewsSource>): Promise<NewsSource | undefined> {
    const client = this.getClient(true); // admin/service-role for source mutation
    const uuid = stringToUuid(id);

    const payload: any = { updated_at: new Date().toISOString() };
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.url !== undefined) payload.url = updates.url;
    if (updates.rssUrl !== undefined) payload.rss_url = updates.rssUrl;
    if (updates.isEnabled !== undefined) payload.is_enabled = updates.isEnabled;
    if (updates.isOfficial !== undefined) payload.is_official = updates.isOfficial;
    if (updates.trustTier !== undefined) payload.trust_tier = updates.trustTier;
    if (updates.fetchFrequencyMinutes !== undefined) payload.fetch_frequency_minutes = updates.fetchFrequencyMinutes;
    if (updates.lastFetchedAt !== undefined) payload.last_fetched_at = updates.lastFetchedAt;
    if (updates.lastError !== undefined) payload.last_error = updates.lastError;

    const { data, error } = await client
      .from('news_sources')
      .update(payload)
      .or(`id.eq.${uuid},slug.eq.${id}`)
      .select()
      .maybeSingle();

    if (error) throw new Error(`[Supabase] Failed to update source: ${error.message}`);
    return data ? this.mapSourceRowToDomain(data) : undefined;
  }

  async updateSourceHealth(id: string, success: boolean, errorMsg?: string): Promise<NewsSource | undefined> {
    const client = this.getClient(true);
    const now = new Date().toISOString();
    const current = await this.getSourceById(id);
    if (!current) return undefined;

    const consecutive = success ? 0 : (current.consecutiveErrors || 0) + 1;
    const payload = {
      last_fetched_at: now,
      last_error: success ? null : (errorMsg || 'Fetch error'),
      updated_at: now,
    };

    return this.updateSource(id, {
      ...payload,
      lastSuccessfulFetch: success ? now : current.lastSuccessfulFetch,
      consecutiveErrors: consecutive,
      healthStatus: success ? 'healthy' : (consecutive >= 3 ? 'failing' : 'degraded'),
    } as any);
  }

  async upsertSource(source: NewsSource): Promise<NewsSource> {
    const client = this.getClient(true);
    const row = {
      id: stringToUuid(source.id || source.slug),
      slug: source.slug,
      name: source.name,
      url: source.url,
      rss_url: source.rssUrl,
      geographic_scope: source.geographicScope,
      country: source.country,
      state: source.state,
      category: source.category,
      is_enabled: source.isEnabled,
      is_official: source.isOfficial,
      trust_tier: source.trustTier,
      fetch_frequency_minutes: source.fetchFrequencyMinutes,
      last_fetched_at: source.lastFetchedAt,
      last_error: source.lastError,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await client
      .from('news_sources')
      .upsert(row, { onConflict: 'slug' })
      .select()
      .single();

    if (error) throw new Error(`[Supabase] Failed to upsert source: ${error.message}`);
    return this.mapSourceRowToDomain(data);
  }

  // ==========================================
  // ARTICLES & CANONICAL STORIES
  // ==========================================
  async getArticles(limit = 100): Promise<Article[]> {
    const client = this.getClient();
    const { data, error } = await client
      .from('articles')
      .select('*, news_sources(name)')
      .order('published_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`[Supabase] Failed to fetch articles: ${error.message}`);
    return (data || []).map(this.mapArticleRowToDomain);
  }

  async addArticle(article: Article): Promise<Article> {
    const client = this.getClient(true); // Ingestion runs via service-role
    const articleUuid = articleUrlToUuid(article.url || article.id);
    const sourceUuid = stringToUuid(article.sourceId);

    const row = {
      id: articleUuid,
      source_id: sourceUuid,
      external_id: article.id,
      title: article.title,
      summary: article.summary,
      content: article.content,
      url: article.url,
      author: article.author,
      lead_image_url: article.leadImageUrl,
      published_at: article.publishedAt,
      ingested_at: article.ingestedAt || new Date().toISOString(),
      geographic_scope: article.geographicScope,
      country: article.country,
      state: article.state,
      category: article.category,
      language: article.language,
      evidence_label: article.evidenceLabel,
      is_opinion: article.isOpinion,
      is_live_ingested: article.isLiveIngested ?? true,
    };

    const { data, error } = await client
      .from('articles')
      .upsert(row, { onConflict: 'id' })
      .select()
      .single();

    if (error) throw new Error(`[Supabase] Failed to persist article: ${error.message}`);
    return this.mapArticleRowToDomain(data);
  }

  async getStories(filter?: StoryFilterOptions): Promise<{ stories: CanonicalStory[]; total: number }> {
    const client = this.getClient();
    let query = client
      .from('canonical_stories')
      .select(`
        *,
        story_articles(
          article_id,
          is_primary_source,
          articles(*, news_sources(name))
        ),
        story_timeline_events(*)
      `, { count: 'exact' });

    if (filter?.scope && filter.scope !== 'all') {
      query = query.eq('geographic_scope', filter.scope);
    }
    if (filter?.state && filter.state !== 'all') {
      query = query.ilike('state', filter.state);
    }
    if (filter?.category && filter.category !== 'all') {
      query = query.ilike('category', filter.category);
    }
    if (filter?.importance && filter.importance !== 'all') {
      query = query.eq('importance_level', filter.importance);
    }
    if (filter?.search?.trim()) {
      const q = `%${filter.search.trim()}%`;
      query = query.or(`title.ilike.${q},summary.ilike.${q},why_it_matters.ilike.${q}`);
    }

    query = query.order('last_updated_at', { ascending: false });

    const offset = filter?.offset || 0;
    const limit = filter?.limit || 20;
    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;
    if (error) throw new Error(`[Supabase] Failed to get stories: ${error.message}`);

    const stories = (data || []).map(this.mapStoryRowToDomain);
    return { stories, total: count || stories.length };
  }

  async getStoryById(id: string): Promise<CanonicalStory | undefined> {
    const client = this.getClient();
    const storyUuid = stringToUuid(id);

    const { data, error } = await client
      .from('canonical_stories')
      .select(`
        *,
        story_articles(
          article_id,
          is_primary_source,
          articles(*, news_sources(name))
        ),
        story_timeline_events(*)
      `)
      .eq('id', storyUuid)
      .maybeSingle();

    if (error) throw new Error(`[Supabase] Failed to fetch story by id: ${error.message}`);
    return data ? this.mapStoryRowToDomain(data) : undefined;
  }

  async upsertStory(story: CanonicalStory): Promise<CanonicalStory> {
    const client = this.getClient(true); // Service-role ingestion
    const storyUuid = stringToUuid(story.id);

    const storyRow = {
      id: storyUuid,
      title: story.title,
      summary: story.summary,
      why_it_matters: story.whyItMatters,
      general_take: story.generalTake,
      geographic_scope: story.geographicScope,
      country: story.country,
      state: story.state,
      category: story.category,
      lead_image_url: story.leadImageUrl,
      evidence_status: story.evidenceStatus,
      importance_level: story.importanceLevel,
      first_reported_at: story.firstReportedAt,
      last_updated_at: story.lastUpdatedAt,
      india_implication: story.indiaImplication,
      is_perspective_available: story.isPerspectiveAvailable,
      is_live_ingested: story.isLiveIngested ?? true,
    };

    const { error: storyErr } = await client
      .from('canonical_stories')
      .upsert(storyRow, { onConflict: 'id' });

    if (storyErr) throw new Error(`[Supabase] Failed to upsert canonical story: ${storyErr.message}`);

    // Link articles
    if (story.articles && story.articles.length > 0) {
      for (const art of story.articles) {
        await this.addArticle(art);
        const articleUuid = articleUrlToUuid(art.url || art.id);
        await client.from('story_articles').upsert({
          story_id: storyUuid,
          article_id: articleUuid,
          is_primary_source: story.articles[0]?.url === art.url,
          relevance_score: 1.0,
        }, { onConflict: 'story_id,article_id' });
      }
    }

    // Persist timeline events
    if (story.timeline && story.timeline.length > 0) {
      for (const ev of story.timeline) {
        const evUuid = stringToUuid(ev.id || `${story.id}-${ev.eventTimestamp}`);
        await client.from('story_timeline_events').upsert({
          id: evUuid,
          story_id: storyUuid,
          event_timestamp: ev.eventTimestamp,
          title: ev.title,
          description: ev.description,
          what_changed: ev.whatChanged,
          source_name: ev.sourceName,
          source_url: ev.sourceUrl,
          evidence_status: ev.evidenceStatus,
        }, { onConflict: 'id' });
      }
    }

    return story;
  }

  // ==========================================
  // PERSPECTIVES
  // ==========================================
  async getPerspective(storyId: string): Promise<PerspectiveAnalysis | undefined> {
    const client = this.getClient();
    const storyUuid = stringToUuid(storyId);

    const { data, error } = await client
      .from('perspective_analyses')
      .select('*')
      .eq('story_id', storyUuid)
      .maybeSingle();

    if (error) throw new Error(`[Supabase] Failed to fetch perspective: ${error.message}`);
    return data ? this.mapPerspectiveRowToDomain(data) : undefined;
  }

  async savePerspective(perspective: PerspectiveAnalysis): Promise<PerspectiveAnalysis> {
    const client = this.getClient(true);
    const storyUuid = stringToUuid(perspective.storyId);
    const perspUuid = stringToUuid(perspective.id || `persp-${perspective.storyId}`);

    const row = {
      id: perspUuid,
      story_id: storyUuid,
      what_happened: perspective.whatHappened,
      general_take: perspective.generalTake,
      why_it_matters: perspective.whyItMatters,
      perspectives_in_favor: perspective.perspectivesInFavor,
      perspectives_against: perspective.perspectivesAgainst,
      affected_groups_concerns: perspective.affectedGroupsConcerns,
      expert_institutional_views: perspective.expertInstitutionalViews,
      evidence_well_established: perspective.evidenceWellEstablished,
      evidence_preliminary: perspective.evidencePreliminary,
      evidence_disputed: perspective.evidenceDisputed,
      evidence_missing: perspective.evidenceMissing,
      possible_consequences_positive: perspective.possibleConsequencesPositive,
      possible_consequences_negative: perspective.possibleConsequencesNegative,
      what_to_watch_next: perspective.whatToWatchNext,
      perspective_comparison: perspective.perspectiveComparison,
      ai_provider: perspective.aiProvider,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await client
      .from('perspective_analyses')
      .upsert(row, { onConflict: 'story_id' })
      .select()
      .single();

    if (error) throw new Error(`[Supabase] Failed to save perspective: ${error.message}`);
    return this.mapPerspectiveRowToDomain(data);
  }

  // ==========================================
  // HOURLY PULSE BRIEFINGS
  // ==========================================
  async getBriefings(scope?: string, state?: string): Promise<HourlyPulseBriefing[]> {
    const client = this.getClient();
    let query = client
      .from('hourly_pulse_briefings')
      .select('*')
      .order('generated_at', { ascending: false });

    if (scope && scope !== 'all') query = query.eq('scope', scope);
    if (state && state !== 'all') query = query.ilike('state', state);

    const { data, error } = await query;
    if (error) throw new Error(`[Supabase] Failed to fetch briefings: ${error.message}`);
    return (data || []).map(this.mapBriefingRowToDomain);
  }

  async getLatestBriefing(scope = 'global'): Promise<HourlyPulseBriefing | undefined> {
    const client = this.getClient();
    let query = client
      .from('hourly_pulse_briefings')
      .select('*')
      .order('generated_at', { ascending: false })
      .limit(1);

    if (scope && scope !== 'global' && scope !== 'all') {
      query = query.eq('scope', scope);
    }

    const { data, error } = await query.maybeSingle();
    if (error) throw new Error(`[Supabase] Failed to fetch latest briefing: ${error.message}`);
    return data ? this.mapBriefingRowToDomain(data) : undefined;
  }

  async addBriefing(briefing: HourlyPulseBriefing): Promise<HourlyPulseBriefing> {
    const client = this.getClient(true);
    const briefingUuid = stringToUuid(briefing.id);

    const row = {
      id: briefingUuid,
      time_window_start: briefing.timeWindowStart,
      time_window_end: briefing.timeWindowEnd,
      generated_at: briefing.generatedAt,
      scope: briefing.scope,
      state: briefing.state,
      data_freshness_minutes: briefing.dataFreshnessMinutes,
      summary_overview: briefing.summaryOverview,
      important_developments: briefing.importantDevelopments,
      what_changed_since_previous: briefing.whatChangedSincePrevious,
      source_count: briefing.sourceCount,
    };

    const { data, error } = await client
      .from('hourly_pulse_briefings')
      .upsert(row, { onConflict: 'id' })
      .select()
      .single();

    if (error) throw new Error(`[Supabase] Failed to add briefing: ${error.message}`);

    // Link briefing stories
    if (briefing.importantDevelopments) {
      for (let i = 0; i < briefing.importantDevelopments.length; i++) {
        const dev = briefing.importantDevelopments[i];
        if (dev.storyId) {
          const storyUuid = stringToUuid(dev.storyId);
          await client.from('briefing_stories').upsert({
            briefing_id: briefingUuid,
            story_id: storyUuid,
            order_index: i,
          }, { onConflict: 'briefing_id,story_id' });
        }
      }
    }

    return this.mapBriefingRowToDomain(data);
  }

  // ==========================================
  // USER PROFILES
  // ==========================================
  async getUserProfile(userId: string, token?: string): Promise<UserProfileRecord | undefined> {
    const client = this.getClient(token);
    const userUuid = stringToUuid(userId);

    const { data, error } = await client
      .from('users')
      .select('*')
      .eq('id', userUuid)
      .maybeSingle();

    if (error) throw new Error(`[Supabase] Failed to fetch user profile: ${error.message}`);
    if (!data) return undefined;

    return {
      id: data.id,
      email: data.email,
      fullName: data.full_name,
      isGuest: data.is_guest,
      isAdmin: data.is_admin,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async updateUserProfile(userId: string, updates: Partial<UserProfileRecord>, token?: string): Promise<UserProfileRecord | undefined> {
    const client = this.getClient(token);
    const userUuid = stringToUuid(userId);

    const payload: any = { updated_at: new Date().toISOString() };
    if (updates.fullName !== undefined) payload.full_name = updates.fullName;

    const { data, error } = await client
      .from('users')
      .update(payload)
      .eq('id', userUuid)
      .select()
      .maybeSingle();

    if (error) throw new Error(`[Supabase] Failed to update profile: ${error.message}`);
    return data ? this.getUserProfile(userId, token) : undefined;
  }

  // ==========================================
  // USER PREFERENCES
  // ==========================================
  async getPreferences(userId: string, token?: string): Promise<UserPreferences> {
    const client = this.getClient(token);
    const userUuid = stringToUuid(userId);

    const { data } = await client
      .from('user_preferences')
      .select('*')
      .eq('user_id', userUuid)
      .maybeSingle();

    if (!data) {
      return {
        countryCode: 'IN',
        state: 'Telangana',
        interfaceLanguage: 'en',
        newsReadingLanguage: 'en',
        summaryLength: 'balanced',
        theme: 'light',
        enableNotifications: true,
        quietHoursStart: '22:00',
        quietHoursEnd: '07:00',
        topicsOfInterest: ['governance', 'technology', 'economy', 'infrastructure', 'education'],
      };
    }

    return {
      countryCode: data.country_code,
      state: data.state,
      city: data.city,
      interfaceLanguage: data.interface_language,
      newsReadingLanguage: data.news_reading_language,
      summaryLength: data.summary_length,
      theme: data.theme,
      enableNotifications: data.enable_notifications,
      quietHoursStart: data.quiet_hours_start,
      quietHoursEnd: data.quiet_hours_end,
      topicsOfInterest: Array.isArray(data.topics_of_interest) ? data.topics_of_interest : [],
    };
  }

  async savePreferences(userId: string, prefs: Partial<UserPreferences>, token?: string): Promise<UserPreferences> {
    const client = this.getClient(token);
    const userUuid = stringToUuid(userId);
    const current = await this.getPreferences(userId, token);
    const merged = { ...current, ...prefs };

    const row = {
      user_id: userUuid,
      country_code: merged.countryCode,
      state: merged.state,
      city: merged.city,
      interface_language: merged.interfaceLanguage,
      news_reading_language: merged.newsReadingLanguage,
      summary_length: merged.summaryLength,
      theme: merged.theme,
      enable_notifications: merged.enableNotifications,
      quiet_hours_start: merged.quietHoursStart,
      quiet_hours_end: merged.quietHoursEnd,
      topics_of_interest: merged.topicsOfInterest,
      updated_at: new Date().toISOString(),
    };

    const { error } = await client
      .from('user_preferences')
      .upsert(row, { onConflict: 'user_id' });

    if (error) throw new Error(`[Supabase] Failed to save preferences: ${error.message}`);
    return merged;
  }

  // ==========================================
  // SAVED STORIES
  // ==========================================
  async getSavedStories(userId: string, token?: string): Promise<SavedStoryRecord[]> {
    const client = this.getClient(token);
    const userUuid = stringToUuid(userId);

    const { data, error } = await client
      .from('saved_stories')
      .select('*, canonical_stories(*)')
      .eq('user_id', userUuid)
      .order('saved_at', { ascending: false });

    if (error) throw new Error(`[Supabase] Failed to get saved stories: ${error.message}`);
    return (data || []).map(row => ({
      id: row.id,
      userId: row.user_id,
      storyId: row.story_id,
      personalNotes: row.personal_notes,
      savedAt: row.saved_at,
      story: row.canonical_stories ? this.mapStoryRowToDomain(row.canonical_stories) : undefined,
    }));
  }

  async saveStory(userId: string, storyId: string, personalNotes?: string, token?: string): Promise<SavedStoryRecord> {
    const client = this.getClient(token);
    const userUuid = stringToUuid(userId);
    const storyUuid = stringToUuid(storyId);

    const row = {
      user_id: userUuid,
      story_id: storyUuid,
      personal_notes: personalNotes,
      saved_at: new Date().toISOString(),
    };

    const { data, error } = await client
      .from('saved_stories')
      .upsert(row, { onConflict: 'user_id,story_id' })
      .select('*, canonical_stories(*)')
      .single();

    if (error) throw new Error(`[Supabase] Failed to save story bookmark: ${error.message}`);
    return {
      id: data.id,
      userId: data.user_id,
      storyId: data.story_id,
      personalNotes: data.personal_notes,
      savedAt: data.saved_at,
      story: data.canonical_stories ? this.mapStoryRowToDomain(data.canonical_stories) : undefined,
    };
  }

  async removeSavedStory(userId: string, storyId: string, token?: string): Promise<boolean> {
    const client = this.getClient(token);
    const userUuid = stringToUuid(userId);
    const storyUuid = stringToUuid(storyId);

    const { error } = await client
      .from('saved_stories')
      .delete()
      .eq('user_id', userUuid)
      .eq('story_id', storyUuid);

    if (error) throw new Error(`[Supabase] Failed to remove saved story: ${error.message}`);
    return true;
  }

  // ==========================================
  // READING HISTORY
  // ==========================================
  async recordReading(userId: string, storyId: string, timeSpentSeconds = 0, token?: string): Promise<ReadingHistoryRecord> {
    const client = this.getClient(token);
    const userUuid = stringToUuid(userId);
    const storyUuid = stringToUuid(storyId);

    const row = {
      user_id: userUuid,
      story_id: storyUuid,
      time_spent_seconds: timeSpentSeconds,
      read_at: new Date().toISOString(),
    };

    const { data, error } = await client
      .from('reading_history')
      .insert(row)
      .select()
      .single();

    if (error) throw new Error(`[Supabase] Failed to log reading history: ${error.message}`);
    return {
      id: data.id,
      userId: data.user_id,
      storyId: data.story_id,
      readAt: data.read_at,
      timeSpentSeconds: data.time_spent_seconds,
    };
  }

  async getReadingHistory(userId: string, limit = 50, token?: string): Promise<ReadingHistoryRecord[]> {
    const client = this.getClient(token);
    const userUuid = stringToUuid(userId);

    const { data, error } = await client
      .from('reading_history')
      .select('*')
      .eq('user_id', userUuid)
      .order('read_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`[Supabase] Failed to get reading history: ${error.message}`);
    return (data || []).map(r => ({
      id: r.id,
      userId: r.user_id,
      storyId: r.story_id,
      readAt: r.read_at,
      timeSpentSeconds: r.time_spent_seconds,
    }));
  }

  // ==========================================
  // VOCABULARY & REVIEWS
  // ==========================================
  // ==========================================
  // VOCABULARY & REVIEWS
  // ==========================================
  async getVocabulary(userId: string, filter?: VocabularyFilterOptions, token?: string): Promise<VocabularyEntry[]> {
    const client = this.getClient(token);
    const userUuid = stringToUuid(userId);

    let query = client
      .from('vocabulary_entries')
      .select('*')
      .eq('user_id', userUuid)
      .order('created_at', { ascending: false });

    if (filter?.search?.trim()) {
      const q = `%${filter.search.trim().toLowerCase()}%`;
      query = query.or(`word.ilike.${q},contextual_meaning.ilike.${q}`);
    }
    if (filter?.mastery !== undefined) {
      query = query.eq('mastery_level', filter.mastery);
    }

    const { data, error } = await query;
    if (error) throw new Error(`[Supabase] Failed to fetch vocabulary: ${error.message}`);
    return (data || []).map(this.mapVocabularyRowToDomain);
  }

  async addVocabulary(entry: VocabularyEntry, token?: string): Promise<VocabularyEntry> {
    const client = this.getClient(token);
    const userUuid = stringToUuid(entry.userId);
    const storyUuid = entry.storyId ? stringToUuid(entry.storyId) : null;
    const entryUuid = stringToUuid(entry.id);

    const row = {
      id: entryUuid,
      user_id: userUuid,
      story_id: storyUuid,
      word: entry.word,
      source_sentence: entry.sourceSentence,
      original_language: entry.originalLanguage,
      target_language: entry.targetLanguage,
      contextual_meaning: entry.contextualMeaning,
      original_definition: entry.originalDefinition,
      pronunciation: entry.pronunciation,
      part_of_speech: entry.partOfSpeech,
      example_sentence: entry.exampleSentence,
      synonyms: entry.synonyms || [],
      personal_notes: entry.personalNotes,
      mastery_level: entry.masteryLevel || 0,
      next_review_due: entry.nextReviewDue || new Date().toISOString(),
      created_at: entry.createdAt || new Date().toISOString(),
    };

    const { data, error } = await client
      .from('vocabulary_entries')
      .upsert(row, { onConflict: 'id' })
      .select()
      .single();

    if (error) throw new Error(`[Supabase] Failed to add vocabulary: ${error.message}`);
    return this.mapVocabularyRowToDomain(data);
  }

  async updateVocabulary(id: string, updates: Partial<VocabularyEntry>, userId?: string, token?: string): Promise<VocabularyEntry | undefined> {
    const client = this.getClient(token);
    const entryUuid = stringToUuid(id);

    const payload: any = {};
    if (updates.masteryLevel !== undefined) payload.mastery_level = updates.masteryLevel;
    if (updates.personalNotes !== undefined) payload.personal_notes = updates.personalNotes;
    if (updates.nextReviewDue !== undefined) payload.next_review_due = updates.nextReviewDue;
    if (updates.lastReviewedAt !== undefined) payload.last_reviewed_at = updates.lastReviewedAt;

    let query = client.from('vocabulary_entries').update(payload).eq('id', entryUuid);
    if (userId) {
      query = query.eq('user_id', stringToUuid(userId));
    }

    const { data, error } = await query.select().maybeSingle();
    if (error) throw new Error(`[Supabase] Failed to update vocabulary: ${error.message}`);
    return data ? this.mapVocabularyRowToDomain(data) : undefined;
  }

  async deleteVocabulary(id: string, userId?: string, token?: string): Promise<boolean> {
    const client = this.getClient(token);
    const entryUuid = stringToUuid(id);

    let query = client.from('vocabulary_entries').delete().eq('id', entryUuid);
    if (userId) {
      query = query.eq('user_id', stringToUuid(userId));
    }

    const { error } = await query;
    if (error) throw new Error(`[Supabase] Failed to delete vocabulary: ${error.message}`);
    return true;
  }

  async addVocabularyReview(review: Omit<VocabularyReviewRecord, 'id'>, token?: string): Promise<VocabularyReviewRecord> {
    const client = this.getClient(token);
    const vocabUuid = stringToUuid(review.vocabularyId);

    const row = {
      vocabulary_id: vocabUuid,
      reviewed_at: review.reviewedAt || new Date().toISOString(),
      recalled_successfully: review.recalledSuccessfully,
      review_mode: review.reviewMode || 'recall_quiz',
    };

    const { data, error } = await client
      .from('vocabulary_reviews')
      .insert(row)
      .select()
      .single();

    if (error) throw new Error(`[Supabase] Failed to save review: ${error.message}`);
    return {
      id: data.id,
      vocabularyId: data.vocabulary_id,
      reviewedAt: data.reviewed_at,
      recalledSuccessfully: data.recalled_successfully,
      reviewMode: data.review_mode,
    };
  }

  async getVocabularyReviews(vocabularyId: string, token?: string): Promise<VocabularyReviewRecord[]> {
    const client = this.getClient(token);
    const vocabUuid = stringToUuid(vocabularyId);

    const { data, error } = await client
      .from('vocabulary_reviews')
      .select('*')
      .eq('vocabulary_id', vocabUuid)
      .order('reviewed_at', { ascending: false });

    if (error) throw new Error(`[Supabase] Failed to fetch reviews: ${error.message}`);
    return (data || []).map(r => ({
      id: r.id,
      vocabularyId: r.vocabulary_id,
      reviewedAt: r.reviewed_at,
      recalledSuccessfully: r.recalled_successfully,
      reviewMode: r.review_mode,
    }));
  }

  // ==========================================
  // ASK CONVERSATIONS
  // ==========================================
  async getConversation(id: string, userId?: string, token?: string) {
    const client = this.getClient(token);
    const convUuid = stringToUuid(id);

    let query = client
      .from('ask_conversations')
      .select('*, ask_messages(*)')
      .eq('id', convUuid);

    if (userId) {
      query = query.eq('user_id', stringToUuid(userId));
    }

    const { data, error } = await query.maybeSingle();
    if (error) throw new Error(`[Supabase] Failed to get conversation: ${error.message}`);
    if (!data) return undefined;

    return {
      id: data.id,
      title: data.title,
      language: data.language,
      messages: (data.ask_messages || []).map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        citedSources: m.cited_sources,
        modelUsed: m.model_used,
        createdAt: m.created_at,
      })),
    };
  }

  async saveConversation(id: string, userId: string, title: string, language: string, messages: AskMessage[], token?: string) {
    const client = this.getClient(token);
    const convUuid = stringToUuid(id);
    const userUuid = stringToUuid(userId);

    const convRow = {
      id: convUuid,
      user_id: userUuid,
      title,
      language,
      updated_at: new Date().toISOString(),
    };

    const { error: convErr } = await client
      .from('ask_conversations')
      .upsert(convRow, { onConflict: 'id' });

    if (convErr) throw new Error(`[Supabase] Failed to save conversation: ${convErr.message}`);

    // Insert messages
    if (messages && messages.length > 0) {
      const msgRows = messages.map(m => ({
        id: stringToUuid(m.id || `${id}-${m.createdAt}`),
        conversation_id: convUuid,
        role: m.role,
        content: m.content,
        cited_sources: m.citedSources || [],
        model_used: m.modelUsed,
        created_at: m.createdAt,
      }));

      await client.from('ask_messages').upsert(msgRows, { onConflict: 'id' });
    }

    return { id, title, language, messages };
  }

  // ==========================================
  // NOTIFICATIONS & PUSH
  // ==========================================
  async getNotifications(userId: string, token?: string): Promise<NotificationRecord[]> {
    const client = this.getClient(token);
    const userUuid = stringToUuid(userId);

    const { data, error } = await client
      .from('notification_delivery_history')
      .select('*')
      .eq('user_id', userUuid)
      .order('delivered_at', { ascending: false });

    if (error) throw new Error(`[Supabase] Failed to fetch notifications: ${error.message}`);
    return (data || []).map(this.mapNotificationRowToDomain);
  }

  private async ensureUserExists(userId: string): Promise<string> {
    const userUuid = stringToUuid(userId);
    const admin = this.getClient(true);
    const { data } = await admin.from('users').select('id').eq('id', userUuid).maybeSingle();
    if (!data) {
      await admin.from('users').upsert({
        id: userUuid,
        email: `${userId.replace(/[^a-zA-Z0-9_-]/g, '')}@pulse.guest`,
        full_name: 'Pulse Reader',
        is_guest: true,
        is_admin: false,
      }, { onConflict: 'id' });
    }
    return userUuid;
  }

  async addNotification(notif: NotificationRecord): Promise<NotificationRecord> {
    const client = this.getClient(true); // Notifications are dispatched by background tasks
    const notifUuid = stringToUuid(notif.id || `${notif.userId}-${notif.dedupKey}`);
    const userUuid = await this.ensureUserExists(notif.userId);
    const storyUuid = notif.storyId ? stringToUuid(notif.storyId) : null;

    const row = {
      id: notifUuid,
      user_id: userUuid,
      story_id: storyUuid,
      dedup_key: notif.dedupKey,
      priority: notif.priority,
      title: notif.title,
      body: notif.body,
      delivered_at: notif.deliveredAt || new Date().toISOString(),
      is_digest: notif.isDigest ?? false,
      bundled_story_ids: notif.bundledStoryIds || [],
      read_at: notif.readAt,
    };

    const { data, error } = await client
      .from('notification_delivery_history')
      .upsert(row, { onConflict: 'id' })
      .select()
      .single();

    if (error) throw new Error(`[Supabase] Failed to persist notification: ${error.message}`);
    return this.mapNotificationRowToDomain(data);
  }

  async markNotificationRead(id: string, userId?: string, token?: string): Promise<boolean> {
    const client = this.getClient(token);
    const notifUuid = stringToUuid(id);

    let query = client
      .from('notification_delivery_history')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notifUuid);

    if (userId) {
      query = query.eq('user_id', stringToUuid(userId));
    }

    const { error } = await query;
    if (error) throw new Error(`[Supabase] Failed to mark notification read: ${error.message}`);
    return true;
  }

  async markAllNotificationsRead(userId: string, token?: string): Promise<void> {
    const client = this.getClient(token);
    const userUuid = stringToUuid(userId);

    const { error } = await client
      .from('notification_delivery_history')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', userUuid)
      .is('read_at', null);

    if (error) throw new Error(`[Supabase] Failed to mark all read: ${error.message}`);
  }

  async getPushSubscriptions(userId?: string): Promise<PushSubscriptionRecord[]> {
    const client = this.getClient(true); // Service-role for background push dispatcher
    let query = client.from('push_subscriptions').select('*');
    if (userId) {
      query = query.eq('user_id', stringToUuid(userId));
    }

    const { data, error } = await query;
    if (error) {
      console.warn('[Supabase] Failed to fetch push subscriptions:', error.message);
      return [];
    }

    return (data || []).map(r => ({
      id: r.id,
      userId: r.user_id,
      endpoint: r.endpoint,
      keys: {
        p256dh: r.p256dh_key,
        auth: r.auth_key,
      },
      failureCount: r.failure_count || 0,
      createdAt: r.created_at,
      lastDeliveredAt: r.last_delivered_at,
    }));
  }

  async addPushSubscription(sub: PushSubscriptionRecord): Promise<PushSubscriptionRecord> {
    const client = this.getClient(true);
    const userUuid = await this.ensureUserExists(sub.userId);
    const row = {
      id: stringToUuid(sub.id),
      user_id: userUuid,
      endpoint: sub.endpoint,
      p256dh_key: sub.keys.p256dh,
      auth_key: sub.keys.auth,
      failure_count: sub.failureCount || 0,
      created_at: sub.createdAt || new Date().toISOString(),
    };

    const { data, error } = await client
      .from('push_subscriptions')
      .upsert(row, { onConflict: 'endpoint' })
      .select()
      .single();

    if (error) throw new Error(`[Supabase] Failed to save push subscription: ${error.message}`);
    return {
      id: data.id,
      userId: data.user_id,
      endpoint: data.endpoint,
      keys: {
        p256dh: data.p256dh_key,
        auth: data.auth_key,
      },
      failureCount: data.failure_count || 0,
      createdAt: data.created_at,
      lastDeliveredAt: data.last_delivered_at,
    };
  }

  async updatePushSubscription(endpoint: string, updates: Partial<PushSubscriptionRecord>): Promise<PushSubscriptionRecord | undefined> {
    const client = this.getClient(true);
    const dbUpdates: any = {};
    if (updates.failureCount !== undefined) dbUpdates.failure_count = updates.failureCount;
    if (updates.lastDeliveredAt) dbUpdates.last_delivered_at = updates.lastDeliveredAt;

    const { data, error } = await client
      .from('push_subscriptions')
      .update(dbUpdates)
      .eq('endpoint', endpoint)
      .select()
      .maybeSingle();

    if (error || !data) return undefined;
    return {
      id: data.id,
      userId: data.user_id,
      endpoint: data.endpoint,
      keys: {
        p256dh: data.p256dh_key,
        auth: data.auth_key,
      },
      failureCount: data.failure_count || 0,
      createdAt: data.created_at,
      lastDeliveredAt: data.last_delivered_at,
    };
  }

  async deletePushSubscription(endpoint: string): Promise<boolean> {
    const client = this.getClient(true);
    const { error } = await client
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', endpoint);

    return !error;
  }

  // ==========================================
  // CACHING & TELEMETRY
  // ==========================================
  async getCachedTranslation(hash: string, lang: string): Promise<any | undefined> {
    const client = this.getClient();
    const { data } = await client
      .from('cached_translations')
      .select('*')
      .eq('content_hash', hash)
      .eq('target_language', lang)
      .maybeSingle();

    if (!data) return undefined;
    return {
      title: data.translated_title,
      summary: data.translated_summary,
      content: data.translated_content,
      whyItMatters: data.translated_why_it_matters,
      targetLanguage: data.target_language,
      isTranslated: true,
    };
  }

  async setCachedTranslation(hash: string, lang: string, data: any): Promise<void> {
    const client = this.getClient(true);
    await client.from('cached_translations').upsert({
      content_hash: hash,
      source_language: 'en',
      target_language: lang,
      translated_title: data.title,
      translated_summary: data.summary,
      translated_content: data.content,
      translated_why_it_matters: data.whyItMatters,
      created_at: new Date().toISOString(),
    }, { onConflict: 'content_hash,source_language,target_language' });
  }

  async getCachedDefinition(word: string, contextHash: string, lang: string): Promise<any | undefined> {
    const client = this.getClient();
    const { data } = await client
      .from('cached_definitions')
      .select('definition_payload')
      .eq('word', word.toLowerCase())
      .eq('context_sentence_hash', contextHash)
      .eq('target_language', lang)
      .maybeSingle();

    return data?.definition_payload;
  }

  async setCachedDefinition(word: string, contextHash: string, lang: string, data: any): Promise<void> {
    const client = this.getClient(true);
    await client.from('cached_definitions').upsert({
      word: word.toLowerCase(),
      context_sentence_hash: contextHash,
      target_language: lang,
      definition_payload: data,
      created_at: new Date().toISOString(),
    }, { onConflict: 'word,context_sentence_hash,target_language' });
  }

  async addIngestionLog(metric: IngestionMetric): Promise<void> {
    const client = this.getClient(true);
    await client.from('ingestion_job_history').insert({
      status: metric.status,
      articles_fetched: metric.articlesFetched,
      new_stories_created: metric.newStoriesCreated,
      duration_ms: metric.durationMs,
      error_message: metric.errorMessage,
      created_at: metric.createdAt || new Date().toISOString(),
    });
  }

  async getIngestionLogs(limit = 50): Promise<IngestionMetric[]> {
    const client = this.getClient(true);
    const { data } = await client
      .from('ingestion_job_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    return (data || []).map(r => ({
      id: r.id,
      sourceName: 'RSS Feed Batch',
      status: r.status,
      articlesFetched: r.articles_fetched,
      newStoriesCreated: r.new_stories_created,
      durationMs: r.duration_ms,
      errorMessage: r.error_message,
      createdAt: r.created_at,
    }));
  }

  async addAILog(log: any): Promise<void> {
    const client = this.getClient(true);
    await client.from('ai_request_logs').insert({
      task_type: log.taskType || 'ai-operation',
      provider: log.provider || 'unknown',
      model_name: log.modelUsed,
      tokens_used: log.tokensUsed || 0,
      latency_ms: log.latencyMs || 0,
      success: log.success ?? true,
      error_message: log.error,
      created_at: new Date().toISOString(),
    });
  }

  async getAILogs(limit = 50): Promise<any[]> {
    const client = this.getClient(true);
    const { data } = await client
      .from('ai_request_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    return data || [];
  }

  // ==========================================
  // ROW MAPPERS (PostgreSQL snake_case -> Domain camelCase)
  // ==========================================
  private mapSourceRowToDomain(r: any): NewsSource {
    return {
      id: r.id,
      slug: r.slug,
      name: r.name,
      url: r.url,
      rssUrl: r.rss_url,
      geographicScope: r.geographic_scope,
      country: r.country,
      state: r.state,
      category: r.category,
      isEnabled: r.is_enabled,
      isOfficial: r.is_official,
      trustTier: r.trust_tier,
      lastFetchedAt: r.last_fetched_at,
      lastError: r.last_error,
      fetchFrequencyMinutes: r.fetch_frequency_minutes,
      healthStatus: r.last_error ? 'degraded' : 'healthy',
    };
  }

  private mapArticleRowToDomain(r: any): Article {
    return {
      id: r.id,
      sourceId: r.source_id,
      sourceName: r.news_sources?.name || 'Verified Source',
      title: r.title,
      summary: r.summary,
      content: r.content || r.summary,
      url: r.url,
      author: r.author,
      leadImageUrl: r.lead_image_url,
      publishedAt: r.published_at,
      ingestedAt: r.ingested_at,
      geographicScope: r.geographic_scope,
      country: r.country,
      state: r.state,
      category: r.category,
      language: r.language,
      evidenceLabel: r.evidence_label,
      isOpinion: r.is_opinion,
      isLiveIngested: r.is_live_ingested,
    };
  }

  private mapStoryRowToDomain(r: any): CanonicalStory {
    const articles = (r.story_articles || []).map((sa: any) => {
      const art = sa.articles;
      return art ? {
        id: art.id,
        sourceId: art.source_id,
        sourceName: art.news_sources?.name || 'Verified Publisher',
        title: art.title,
        summary: art.summary,
        content: art.content || art.summary,
        url: art.url,
        author: art.author,
        leadImageUrl: art.lead_image_url,
        publishedAt: art.published_at,
        ingestedAt: art.ingested_at,
        geographicScope: art.geographic_scope,
        country: art.country,
        state: art.state,
        category: art.category,
        language: art.language,
        evidenceLabel: art.evidence_label,
        isOpinion: art.is_opinion,
        isLiveIngested: art.is_live_ingested,
      } : null;
    }).filter(Boolean);

    const timeline = (r.story_timeline_events || []).map((te: any) => ({
      id: te.id,
      storyId: te.story_id,
      eventTimestamp: te.event_timestamp,
      title: te.title,
      description: te.description,
      whatChanged: te.what_changed,
      sourceName: te.source_name,
      sourceUrl: te.source_url,
      evidenceStatus: te.evidence_status,
    })).sort((a: any, b: any) => new Date(a.eventTimestamp).getTime() - new Date(b.eventTimestamp).getTime());

    return {
      id: r.id,
      title: r.title,
      summary: r.summary,
      whyItMatters: r.why_it_matters,
      generalTake: r.general_take,
      geographicScope: r.geographic_scope,
      country: r.country,
      state: r.state,
      category: r.category,
      leadImageUrl: r.lead_image_url,
      evidenceStatus: r.evidence_status,
      importanceLevel: r.importance_level,
      firstReportedAt: r.first_reported_at,
      lastUpdatedAt: r.last_updated_at,
      indiaImplication: r.india_implication,
      isPerspectiveAvailable: r.is_perspective_available,
      isLiveIngested: r.is_live_ingested,
      articles,
      timeline,
    };
  }

  private mapPerspectiveRowToDomain(r: any): PerspectiveAnalysis {
    return {
      id: r.id,
      storyId: r.story_id,
      whatHappened: r.what_happened,
      generalTake: r.general_take,
      whyItMatters: r.why_it_matters,
      perspectivesInFavor: r.perspectives_in_favor || [],
      perspectivesAgainst: r.perspectives_against || [],
      affectedGroupsConcerns: r.affected_groups_concerns || [],
      expertInstitutionalViews: r.expert_institutional_views || [],
      evidenceWellEstablished: r.evidence_well_established || [],
      evidencePreliminary: r.evidence_preliminary || [],
      evidenceDisputed: r.evidence_disputed || [],
      evidenceMissing: r.evidence_missing || [],
      possibleConsequencesPositive: r.possible_consequences_positive || [],
      possibleConsequencesNegative: r.possible_consequences_negative || [],
      whatToWatchNext: r.what_to_watch_next || [],
      perspectiveComparison: r.perspective_comparison || [],
      aiProvider: r.ai_provider,
      updatedAt: r.updated_at,
    };
  }

  private mapBriefingRowToDomain(r: any): HourlyPulseBriefing {
    return {
      id: r.id,
      timeWindowStart: r.time_window_start,
      timeWindowEnd: r.time_window_end,
      generatedAt: r.generated_at,
      scope: r.scope,
      state: r.state,
      dataFreshnessMinutes: r.data_freshness_minutes,
      summaryOverview: r.summary_overview,
      importantDevelopments: r.important_developments || [],
      whatChangedSincePrevious: r.what_changed_since_previous || { newStoriesCount: 0, substantiveUpdatesCount: 0, highlights: [] },
      sourceCount: r.source_count,
    };
  }

  private mapVocabularyRowToDomain(r: any): VocabularyEntry {
    return {
      id: r.id,
      userId: r.user_id,
      storyId: r.story_id,
      word: r.word,
      sourceSentence: r.source_sentence,
      originalLanguage: r.original_language,
      targetLanguage: r.target_language,
      contextualMeaning: r.contextual_meaning,
      originalDefinition: r.original_definition,
      pronunciation: r.pronunciation,
      partOfSpeech: r.part_of_speech,
      exampleSentence: r.example_sentence,
      synonyms: r.synonyms || [],
      personalNotes: r.personal_notes,
      masteryLevel: r.mastery_level,
      lastReviewedAt: r.last_reviewed_at,
      nextReviewDue: r.next_review_due,
      createdAt: r.created_at,
    };
  }

  private mapNotificationRowToDomain(r: any): NotificationRecord {
    return {
      id: r.id,
      userId: r.user_id,
      storyId: r.story_id,
      dedupKey: r.dedup_key,
      priority: r.priority,
      title: r.title,
      body: r.body,
      deliveredAt: r.delivered_at,
      isDigest: r.is_digest,
      bundledStoryIds: r.bundled_story_ids || [],
      readAt: r.read_at,
    };
  }
}
