import { db, PulseDatabase } from './database.js';
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
  IngestionMetric 
} from '../types/index.js';

/**
 * JsonFileRepository implements INewsRepository using the local atomic JSON database (pulse.db.json).
 * Preserves existing local demo mode with 100% feature parity.
 */
export class JsonFileRepository implements INewsRepository {
  private localDb: PulseDatabase;
  private savedStoriesMemory: Map<string, SavedStoryRecord[]> = new Map();
  private readingHistoryMemory: Map<string, ReadingHistoryRecord[]> = new Map();
  private vocabularyReviewsMemory: Map<string, VocabularyReviewRecord[]> = new Map();

  constructor(databaseInstance: PulseDatabase = db) {
    this.localDb = databaseInstance;
  }

  getMode(): StorageMode {
    return 'local';
  }

  async ping(): Promise<boolean> {
    return true;
  }

  async getDiagnostics(): Promise<RepositoryDiagnostics> {
    const diag = this.localDb.getDiagnostics();
    return {
      mode: 'local',
      storageMode: 'local',
      isConnected: true,
      connected: true,
      sourcesCount: diag.sourcesCount,
      activeSourcesCount: diag.activeSourcesCount,
      storiesCount: diag.storiesCount,
      articlesCount: diag.articlesCount,
      briefingsCount: diag.briefingsCount,
      perspectivesCount: diag.perspectivesCount,
      vocabularyCount: diag.vocabularyCount,
      lastHourlyPulseRun: diag.lastHourlyPulseRun,
      lastNotificationEvaluation: diag.lastNotificationEvaluation,
      cachedTranslationsCount: diag.cachedTranslationsCount,
      cachedDefinitionsCount: diag.cachedDefinitionsCount,
      latencyMs: 1,
    };
  }

  // News Sources
  async getSources(): Promise<NewsSource[]> {
    return this.localDb.getSources();
  }

  async getSourceById(id: string): Promise<NewsSource | undefined> {
    return this.localDb.getSourceById(id);
  }

  async updateSource(id: string, updates: Partial<NewsSource>): Promise<NewsSource | undefined> {
    return this.localDb.updateSource(id, updates);
  }

  async updateSourceHealth(id: string, success: boolean, error?: string): Promise<NewsSource | undefined> {
    return this.localDb.updateSourceHealth(id, success, error);
  }

  async upsertSource(source: NewsSource): Promise<NewsSource> {
    const existing = this.localDb.getSourceById(source.id);
    if (existing) {
      return this.localDb.updateSource(source.id, source) || source;
    }
    // Push new source to sources array
    this.localDb.getSources().push(source);
    return source;
  }

  // Articles & Canonical Stories
  async getArticles(): Promise<Article[]> {
    return this.localDb.getArticles();
  }

  async addArticle(article: Article): Promise<Article> {
    return this.localDb.addArticle(article);
  }

  async getStories(filter?: StoryFilterOptions): Promise<{ stories: CanonicalStory[]; total: number }> {
    return this.localDb.getStories(filter);
  }

  async getStoryById(id: string): Promise<CanonicalStory | undefined> {
    return this.localDb.getStoryById(id);
  }

  async upsertStory(story: CanonicalStory): Promise<CanonicalStory> {
    return this.localDb.upsertStory(story);
  }

  // Perspectives
  async getPerspective(storyId: string): Promise<PerspectiveAnalysis | undefined> {
    return this.localDb.getPerspective(storyId);
  }

  async savePerspective(perspective: PerspectiveAnalysis): Promise<PerspectiveAnalysis> {
    return this.localDb.savePerspective(perspective);
  }

  // Hourly Briefings
  async getBriefings(scope?: string, state?: string): Promise<HourlyPulseBriefing[]> {
    return this.localDb.getBriefings(scope, state);
  }

  async getLatestBriefing(scope: string = 'global'): Promise<HourlyPulseBriefing | undefined> {
    return this.localDb.getLatestBriefing(scope);
  }

  async addBriefing(briefing: HourlyPulseBriefing): Promise<HourlyPulseBriefing> {
    return this.localDb.addBriefing(briefing);
  }

  // User Profiles
  async getUserProfile(userId: string): Promise<UserProfileRecord | undefined> {
    return {
      id: userId,
      email: `${userId}@local.pulse.news`,
      fullName: 'Local Reader',
      isGuest: userId.startsWith('guest-'),
      isAdmin: userId === 'admin-system-user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async updateUserProfile(userId: string, updates: Partial<UserProfileRecord>): Promise<UserProfileRecord | undefined> {
    const current = await this.getUserProfile(userId);
    return current ? { ...current, ...updates, updatedAt: new Date().toISOString() } : undefined;
  }

  // User Preferences
  async getPreferences(userId: string): Promise<UserPreferences> {
    return this.localDb.getPreferences(userId);
  }

  async savePreferences(userId: string, prefs: Partial<UserPreferences>): Promise<UserPreferences> {
    return this.localDb.savePreferences(userId, prefs);
  }

  // Saved Stories
  async getSavedStories(userId: string): Promise<SavedStoryRecord[]> {
    return this.savedStoriesMemory.get(userId) || [];
  }

  async saveStory(userId: string, storyId: string, personalNotes?: string): Promise<SavedStoryRecord> {
    const list = this.savedStoriesMemory.get(userId) || [];
    const story = this.localDb.getStoryById(storyId);
    const existingIdx = list.findIndex(s => s.storyId === storyId);

    const record: SavedStoryRecord = {
      id: `saved-${userId}-${storyId}`,
      userId,
      storyId,
      personalNotes,
      savedAt: new Date().toISOString(),
      story,
    };

    if (existingIdx >= 0) {
      list[existingIdx] = record;
    } else {
      list.unshift(record);
    }
    this.savedStoriesMemory.set(userId, list);
    return record;
  }

  async removeSavedStory(userId: string, storyId: string): Promise<boolean> {
    const list = this.savedStoriesMemory.get(userId) || [];
    const initialLen = list.length;
    const filtered = list.filter(s => s.storyId !== storyId);
    this.savedStoriesMemory.set(userId, filtered);
    return filtered.length !== initialLen;
  }

  // Reading History
  async recordReading(userId: string, storyId: string, timeSpentSeconds = 0): Promise<ReadingHistoryRecord> {
    const list = this.readingHistoryMemory.get(userId) || [];
    const record: ReadingHistoryRecord = {
      id: `read-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userId,
      storyId,
      readAt: new Date().toISOString(),
      timeSpentSeconds,
    };
    list.unshift(record);
    if (list.length > 500) list.pop();
    this.readingHistoryMemory.set(userId, list);
    return record;
  }

  async getReadingHistory(userId: string, limit = 50): Promise<ReadingHistoryRecord[]> {
    const list = this.readingHistoryMemory.get(userId) || [];
    return list.slice(0, limit);
  }

  // Personal Vocabulary & Reviews
  async getVocabulary(userId: string, filter?: VocabularyFilterOptions): Promise<VocabularyEntry[]> {
    return this.localDb.getVocabulary(userId, filter);
  }

  async addVocabulary(entry: VocabularyEntry): Promise<VocabularyEntry> {
    return this.localDb.addVocabulary(entry);
  }

  async updateVocabulary(id: string, updates: Partial<VocabularyEntry>, _userId?: string): Promise<VocabularyEntry | undefined> {
    return this.localDb.updateVocabulary(id, updates);
  }

  async deleteVocabulary(id: string, _userId?: string): Promise<boolean> {
    return this.localDb.deleteVocabulary(id);
  }

  async addVocabularyReview(review: Omit<VocabularyReviewRecord, 'id'>): Promise<VocabularyReviewRecord> {
    const record: VocabularyReviewRecord = {
      id: `rev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ...review,
    };
    const list = this.vocabularyReviewsMemory.get(review.vocabularyId) || [];
    list.unshift(record);
    this.vocabularyReviewsMemory.set(review.vocabularyId, list);
    return record;
  }

  async getVocabularyReviews(vocabularyId: string): Promise<VocabularyReviewRecord[]> {
    return this.vocabularyReviewsMemory.get(vocabularyId) || [];
  }

  // Ask Conversations
  async getConversation(id: string, _userId?: string) {
    return this.localDb.getConversation(id);
  }

  async saveConversation(id: string, _userId: string, title: string, language: string, messages: AskMessage[]) {
    return this.localDb.saveConversation(id, title, language, messages);
  }

  // Notifications & Web Push
  async getNotifications(userId: string): Promise<NotificationRecord[]> {
    return this.localDb.getNotifications(userId);
  }

  async addNotification(notif: NotificationRecord): Promise<NotificationRecord> {
    return this.localDb.addNotification(notif);
  }

  async markNotificationRead(id: string, _userId?: string): Promise<boolean> {
    return this.localDb.markNotificationRead(id);
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    this.localDb.markAllNotificationsRead(userId);
  }

  async getPushSubscriptions(userId?: string, _token?: string): Promise<PushSubscriptionRecord[]> {
    return this.localDb.getPushSubscriptions(userId);
  }

  async addPushSubscription(sub: PushSubscriptionRecord, _token?: string): Promise<PushSubscriptionRecord> {
    return this.localDb.addPushSubscription(sub);
  }

  async updatePushSubscription(endpoint: string, updates: Partial<PushSubscriptionRecord>, _token?: string): Promise<PushSubscriptionRecord | undefined> {
    return this.localDb.updatePushSubscription(endpoint, updates);
  }

  async deletePushSubscription(endpoint: string, _token?: string): Promise<boolean> {
    return this.localDb.deletePushSubscription(endpoint);
  }

  // Cache & Translations
  async getCachedTranslation(hash: string, lang: string): Promise<any | undefined> {
    return this.localDb.getCachedTranslation(hash, lang);
  }

  async setCachedTranslation(hash: string, lang: string, data: any): Promise<void> {
    this.localDb.setCachedTranslation(hash, lang, data);
  }

  async getCachedDefinition(word: string, contextHash: string, lang: string): Promise<any | undefined> {
    return this.localDb.getCachedDefinition(word, contextHash, lang);
  }

  async setCachedDefinition(word: string, contextHash: string, lang: string, data: any): Promise<void> {
    this.localDb.setCachedDefinition(word, contextHash, lang, data);
  }

  // Telemetry & Logs
  async addIngestionLog(metric: IngestionMetric): Promise<void> {
    this.localDb.addIngestionLog(metric);
  }

  async getIngestionLogs(): Promise<IngestionMetric[]> {
    return this.localDb.getIngestionLogs();
  }

  async addAILog(log: any): Promise<void> {
    this.localDb.addAILog(log);
  }

  async getAILogs(): Promise<any[]> {
    return this.localDb.getAILogs();
  }
}
