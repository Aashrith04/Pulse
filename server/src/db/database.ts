import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
  CanonicalStory, 
  Article, 
  NewsSource, 
  HourlyPulseBriefing, 
  PerspectiveAnalysis, 
  VocabularyEntry, 
  UserPreferences, 
  NotificationRecord,
  AskMessage,
  IngestionMetric,
  PushSubscriptionRecord
} from '../types/index.js';
import { 
  INITIAL_NEWS_SOURCES, 
  SEED_STORIES, 
  SEED_PERSPECTIVES, 
  SEED_BRIEFINGS, 
  SEED_VOCABULARY 
} from './seedData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const DB_FILE = path.join(DATA_DIR, 'pulse.db.json');

export interface DatabaseState {
  sources: NewsSource[];
  articles: Article[];
  stories: CanonicalStory[];
  briefings: HourlyPulseBriefing[];
  perspectives: Record<string, PerspectiveAnalysis>;
  vocabulary: VocabularyEntry[];
  preferences: Record<string, UserPreferences>;
  notifications: NotificationRecord[];
  pushSubscriptions: PushSubscriptionRecord[];
  conversations: Record<string, { id: string; title: string; language: string; messages: AskMessage[] }>;
  cachedTranslations: Record<string, any>;
  cachedDefinitions: Record<string, any>;
  ingestionLogs: IngestionMetric[];
  aiLogs: any[];
  lastHourlyPulseRun?: string;
  lastNotificationEvaluation?: string;
}

export class PulseDatabase {
  private state: DatabaseState;
  private saveTimeout: NodeJS.Timeout | null = null;
  private isLoaded = false;

  constructor() {
    this.state = this.getInitialState();
    this.init();
  }

  private getInitialState(): DatabaseState {
    const defaultArticles: Article[] = [];
    SEED_STORIES.forEach(story => {
      story.articles.forEach(art => defaultArticles.push(art));
    });

    return {
      sources: [...INITIAL_NEWS_SOURCES],
      articles: defaultArticles,
      stories: [...SEED_STORIES],
      briefings: [...SEED_BRIEFINGS],
      perspectives: { ...SEED_PERSPECTIVES },
      vocabulary: [...SEED_VOCABULARY],
      preferences: {
        'guest-user-default': {
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
        }
      },
      notifications: [
        {
          id: 'notif-welcome',
          userId: 'guest-user-default',
          dedupKey: 'welcome-briefing',
          priority: 'normal',
          title: 'Welcome to Pulse',
          body: 'Your calm, evidence-grounded news intelligence feed is active. Notifications are set to a quiet 3-hour limit.',
          deliveredAt: new Date(Date.now() - 3600 * 1000).toISOString(),
          isDigest: false,
          bundledStoryIds: [],
        }
      ],
      pushSubscriptions: [],
      conversations: {},
      cachedTranslations: {},
      cachedDefinitions: {},
      ingestionLogs: [],
      aiLogs: [],
      lastHourlyPulseRun: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
      lastNotificationEvaluation: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    };
  }

  private init() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        this.state = {
          ...this.getInitialState(),
          ...parsed,
          // Ensure essential seed entities and any newly configured sources exist
          sources: INITIAL_NEWS_SOURCES.map(initSrc => {
            const existing = (parsed.sources || []).find((s: any) => s.id === initSrc.id);
            return existing ? { ...initSrc, ...existing } : initSrc;
          }),
          stories: parsed.stories?.length ? parsed.stories : SEED_STORIES,
          perspectives: { ...SEED_PERSPECTIVES, ...(parsed.perspectives || {}) },
          briefings: parsed.briefings?.length ? parsed.briefings : SEED_BRIEFINGS,
          vocabulary: parsed.vocabulary?.length ? parsed.vocabulary : SEED_VOCABULARY,
          pushSubscriptions: parsed.pushSubscriptions || [],
        };
      } else {
        this.persistImmediate();
      }
      this.isLoaded = true;
    } catch (err) {
      console.error('[DB] Failed to load local database, initializing fresh state:', err);
      this.state = this.getInitialState();
    }
  }

  private scheduleSave() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.persistImmediate();
    }, 500);
  }

  private persistImmediate() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const tempPath = `${DB_FILE}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(this.state, null, 2), 'utf-8');
      fs.renameSync(tempPath, DB_FILE);
    } catch (err) {
      console.error('[DB] Error persisting database file:', err);
    }
  }

  // --- SOURCES ---
  getSources(): NewsSource[] {
    return this.state.sources;
  }

  getSourceById(id: string): NewsSource | undefined {
    return this.state.sources.find(s => s.id === id);
  }

  updateSource(id: string, updates: Partial<NewsSource>): NewsSource | undefined {
    const idx = this.state.sources.findIndex(s => s.id === id);
    if (idx === -1) return undefined;
    this.state.sources[idx] = { ...this.state.sources[idx], ...updates };
    this.scheduleSave();
    return this.state.sources[idx];
  }

  updateSourceHealth(id: string, success: boolean, error?: string): NewsSource | undefined {
    const src = this.getSourceById(id);
    if (!src) return undefined;

    const now = new Date().toISOString();
    if (success) {
      return this.updateSource(id, {
        lastFetchedAt: now,
        lastSuccessfulFetch: now,
        lastError: undefined,
        consecutiveErrors: 0,
        healthStatus: 'healthy',
      });
    } else {
      const errCount = (src.consecutiveErrors || 0) + 1;
      return this.updateSource(id, {
        lastFetchedAt: now,
        lastError: error,
        consecutiveErrors: errCount,
        healthStatus: errCount >= 3 ? 'failing' : 'degraded',
      });
    }
  }

  getSourceHealthReport() {
    const now = Date.now();
    return this.state.sources.map(s => {
      let status = s.healthStatus || 'healthy';
      if (s.lastSuccessfulFetch) {
        const hoursSinceSuccess = (now - new Date(s.lastSuccessfulFetch).getTime()) / (3600 * 1000);
        if (hoursSinceSuccess > 24 && status === 'healthy') {
          status = 'stale';
        }
      }
      return {
        id: s.id,
        name: s.name,
        slug: s.slug,
        geographicScope: s.geographicScope,
        state: s.state,
        isEnabled: s.isEnabled,
        isOfficial: s.isOfficial,
        trustTier: s.trustTier,
        lastFetchedAt: s.lastFetchedAt,
        lastSuccessfulFetch: s.lastSuccessfulFetch,
        lastError: s.lastError,
        consecutiveErrors: s.consecutiveErrors || 0,
        healthStatus: status,
      };
    });
  }

  // --- STORIES ---
  getStories(filter?: {
    scope?: string;
    state?: string;
    category?: string;
    search?: string;
    importance?: string;
    limit?: number;
    offset?: number;
  }): { stories: CanonicalStory[]; total: number } {
    let result = [...this.state.stories];

    if (filter?.scope && filter.scope !== 'all') {
      result = result.filter(s => s.geographicScope === filter.scope);
    }

    if (filter?.state && filter.state !== 'all') {
      result = result.filter(s => !s.state || s.state.toLowerCase() === filter.state?.toLowerCase());
    }

    if (filter?.category && filter.category !== 'all') {
      result = result.filter(s => s.category.toLowerCase() === filter.category?.toLowerCase());
    }

    if (filter?.importance && filter.importance !== 'all') {
      result = result.filter(s => s.importanceLevel === filter.importance);
    }

    if (filter?.search && filter.search.trim()) {
      const q = filter.search.toLowerCase().trim();
      result = result.filter(s => 
        s.title.toLowerCase().includes(q) ||
        s.summary.toLowerCase().includes(q) ||
        s.whyItMatters.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q)
      );
    }

    // Sort by lastUpdatedAt descending
    result.sort((a, b) => new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime());

    const total = result.length;
    const offset = filter?.offset || 0;
    const limit = filter?.limit || 20;
    const paged = result.slice(offset, offset + limit);

    return { stories: paged, total };
  }

  getStoryById(id: string): CanonicalStory | undefined {
    return this.state.stories.find(s => s.id === id);
  }

  upsertStory(story: CanonicalStory): CanonicalStory {
    const idx = this.state.stories.findIndex(s => s.id === story.id);
    if (idx >= 0) {
      this.state.stories[idx] = story;
    } else {
      this.state.stories.unshift(story);
    }
    this.scheduleSave();
    return story;
  }

  // --- ARTICLES ---
  getArticles(): Article[] {
    return this.state.articles;
  }

  addArticle(article: Article): Article {
    const existing = this.state.articles.find(a => a.url === article.url);
    if (existing) return existing;
    this.state.articles.unshift(article);
    this.scheduleSave();
    return article;
  }

  // --- PERSPECTIVES ---
  getPerspective(storyId: string): PerspectiveAnalysis | undefined {
    return this.state.perspectives[storyId];
  }

  savePerspective(perspective: PerspectiveAnalysis): PerspectiveAnalysis {
    this.state.perspectives[perspective.storyId] = perspective;
    this.scheduleSave();
    return perspective;
  }

  // --- BRIEFINGS ---
  getBriefings(scope?: string, state?: string): HourlyPulseBriefing[] {
    let result = [...this.state.briefings];
    if (scope && scope !== 'all') {
      result = result.filter(b => b.scope === scope);
    }
    if (state && state !== 'all') {
      result = result.filter(b => !b.state || b.state.toLowerCase() === state.toLowerCase());
    }
    result.sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
    return result;
  }

  getLatestBriefing(scope: string = 'global'): HourlyPulseBriefing | undefined {
    const list = this.getBriefings(scope);
    return list[0];
  }

  addBriefing(briefing: HourlyPulseBriefing): HourlyPulseBriefing {
    this.state.briefings.unshift(briefing);
    this.state.lastHourlyPulseRun = briefing.generatedAt;
    this.scheduleSave();
    return briefing;
  }

  // --- VOCABULARY ---
  getVocabulary(userId: string = 'guest-user-default', filter?: { search?: string; mastery?: number }): VocabularyEntry[] {
    let list = this.state.vocabulary.filter(v => v.userId === userId);
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(v => v.word.toLowerCase().includes(q) || v.contextualMeaning.toLowerCase().includes(q));
    }
    if (filter?.mastery !== undefined && filter.mastery >= 0) {
      list = list.filter(v => v.masteryLevel === filter.mastery);
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  addVocabulary(entry: VocabularyEntry): VocabularyEntry {
    const existingIdx = this.state.vocabulary.findIndex(
      v => v.userId === entry.userId && v.word.toLowerCase() === entry.word.toLowerCase()
    );
    if (existingIdx >= 0) {
      this.state.vocabulary[existingIdx] = { ...this.state.vocabulary[existingIdx], ...entry };
      this.scheduleSave();
      return this.state.vocabulary[existingIdx];
    }
    this.state.vocabulary.unshift(entry);
    this.scheduleSave();
    return entry;
  }

  updateVocabulary(id: string, updates: Partial<VocabularyEntry>): VocabularyEntry | undefined {
    const idx = this.state.vocabulary.findIndex(v => v.id === id);
    if (idx === -1) return undefined;
    this.state.vocabulary[idx] = { ...this.state.vocabulary[idx], ...updates };
    this.scheduleSave();
    return this.state.vocabulary[idx];
  }

  deleteVocabulary(id: string): boolean {
    const initialLen = this.state.vocabulary.length;
    this.state.vocabulary = this.state.vocabulary.filter(v => v.id !== id);
    const deleted = this.state.vocabulary.length < initialLen;
    if (deleted) this.scheduleSave();
    return deleted;
  }

  // --- NOTIFICATIONS ---
  getNotifications(userId: string = 'guest-user-default'): NotificationRecord[] {
    return this.state.notifications
      .filter(n => n.userId === userId)
      .sort((a, b) => new Date(b.deliveredAt).getTime() - new Date(a.deliveredAt).getTime());
  }

  addNotification(notif: NotificationRecord): NotificationRecord {
    this.state.notifications.unshift(notif);
    this.state.lastNotificationEvaluation = notif.deliveredAt;
    this.scheduleSave();
    return notif;
  }

  markNotificationRead(id: string): boolean {
    const notif = this.state.notifications.find(n => n.id === id);
    if (notif) {
      notif.readAt = new Date().toISOString();
      this.scheduleSave();
      return true;
    }
    return false;
  }

  markAllNotificationsRead(userId: string = 'guest-user-default'): void {
    const now = new Date().toISOString();
    this.state.notifications
      .filter(n => n.userId === userId)
      .forEach(n => { n.readAt = now; });
    this.scheduleSave();
  }

  // --- PUSH NOTIFICATIONS ---
  addPushSubscription(sub: PushSubscriptionRecord): PushSubscriptionRecord {
    const idx = this.state.pushSubscriptions.findIndex(s => s.endpoint === sub.endpoint);
    if (idx >= 0) {
      this.state.pushSubscriptions[idx] = sub;
    } else {
      this.state.pushSubscriptions.push(sub);
    }
    this.scheduleSave();
    return sub;
  }

  getPushSubscriptions(userId?: string): PushSubscriptionRecord[] {
    if (userId) {
      return this.state.pushSubscriptions.filter(s => s.userId === userId);
    }
    return this.state.pushSubscriptions;
  }

  updatePushSubscription(endpoint: string, updates: Partial<PushSubscriptionRecord>): PushSubscriptionRecord | undefined {
    const idx = this.state.pushSubscriptions.findIndex(s => s.endpoint === endpoint);
    if (idx === -1) return undefined;
    this.state.pushSubscriptions[idx] = { ...this.state.pushSubscriptions[idx], ...updates };
    this.scheduleSave();
    return this.state.pushSubscriptions[idx];
  }

  deletePushSubscription(endpoint: string): boolean {
    const initialLen = this.state.pushSubscriptions.length;
    this.state.pushSubscriptions = this.state.pushSubscriptions.filter(s => s.endpoint !== endpoint);
    if (this.state.pushSubscriptions.length !== initialLen) {
      this.scheduleSave();
      return true;
    }
    return false;
  }

  // --- PREFERENCES ---
  getPreferences(userId: string = 'guest-user-default'): UserPreferences {
    return this.state.preferences[userId] || {
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

  savePreferences(userId: string, prefs: Partial<UserPreferences>): UserPreferences {
    const current = this.getPreferences(userId);
    this.state.preferences[userId] = { ...current, ...prefs };
    this.scheduleSave();
    return this.state.preferences[userId];
  }

  // --- CONVERSATIONS (Ask the News) ---
  getConversation(id: string) {
    return this.state.conversations[id];
  }

  saveConversation(id: string, title: string, language: string, messages: AskMessage[]) {
    this.state.conversations[id] = { id, title, language, messages };
    this.scheduleSave();
    return this.state.conversations[id];
  }

  // --- CACHE (Translation & Dictionary) ---
  getCachedTranslation(hash: string, lang: string) {
    const key = `${hash}_${lang}`;
    return this.state.cachedTranslations[key];
  }

  setCachedTranslation(hash: string, lang: string, data: any) {
    const key = `${hash}_${lang}`;
    this.state.cachedTranslations[key] = { ...data, cachedAt: new Date().toISOString() };
    this.scheduleSave();
  }

  getCachedDefinition(word: string, contextHash: string, lang: string) {
    const key = `${word.toLowerCase()}_${contextHash}_${lang}`;
    return this.state.cachedDefinitions[key];
  }

  setCachedDefinition(word: string, contextHash: string, lang: string, data: any) {
    const key = `${word.toLowerCase()}_${contextHash}_${lang}`;
    this.state.cachedDefinitions[key] = { ...data, cachedAt: new Date().toISOString() };
    this.scheduleSave();
  }

  // --- LOGS & DIAGNOSTICS ---
  addIngestionLog(log: IngestionMetric) {
    this.state.ingestionLogs.unshift(log);
    if (this.state.ingestionLogs.length > 100) this.state.ingestionLogs.pop();
    this.scheduleSave();
  }

  getIngestionLogs(): IngestionMetric[] {
    return this.state.ingestionLogs;
  }

  addAILog(log: any) {
    this.state.aiLogs.unshift(log);
    if (this.state.aiLogs.length > 100) this.state.aiLogs.pop();
    this.scheduleSave();
  }

  getAILogs(): any[] {
    return this.state.aiLogs;
  }

  getDiagnostics() {
    return {
      sourcesCount: this.state.sources.length,
      activeSourcesCount: this.state.sources.filter(s => s.isEnabled).length,
      storiesCount: this.state.stories.length,
      articlesCount: this.state.articles.length,
      briefingsCount: this.state.briefings.length,
      perspectivesCount: Object.keys(this.state.perspectives).length,
      vocabularyCount: this.state.vocabulary.length,
      lastHourlyPulseRun: this.state.lastHourlyPulseRun,
      lastNotificationEvaluation: this.state.lastNotificationEvaluation,
      cachedTranslationsCount: Object.keys(this.state.cachedTranslations).length,
      cachedDefinitionsCount: Object.keys(this.state.cachedDefinitions).length,
    };
  }
}

export const db = new PulseDatabase();
