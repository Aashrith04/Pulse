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

export type StorageMode = 'cloud' | 'local';

export interface StoryFilterOptions {
  scope?: string;
  state?: string;
  category?: string;
  search?: string;
  importance?: string;
  limit?: number;
  offset?: number;
}

export interface VocabularyFilterOptions {
  search?: string;
  mastery?: number;
}

export interface SavedStoryRecord {
  id: string;
  userId: string;
  storyId: string;
  personalNotes?: string;
  savedAt: string;
  story?: CanonicalStory;
}

export interface ReadingHistoryRecord {
  id: string;
  userId: string;
  storyId: string;
  readAt: string;
  timeSpentSeconds: number;
}

export interface VocabularyReviewRecord {
  id: string;
  vocabularyId: string;
  userId?: string;
  reviewedAt: string;
  recalledSuccessfully: boolean;
  recallQuality?: number;
  reviewMode: string;
}

export interface UserProfileRecord {
  id: string;
  email: string;
  fullName?: string;
  isGuest: boolean;
  isAdmin: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RepositoryDiagnostics {
  mode: StorageMode;
  storageMode?: StorageMode;
  isConnected: boolean;
  connected?: boolean;
  sourcesCount: number;
  activeSourcesCount: number;
  storiesCount: number;
  articlesCount: number;
  briefingsCount: number;
  perspectivesCount: number;
  vocabularyCount: number;
  lastHourlyPulseRun?: string;
  lastNotificationEvaluation?: string;
  cachedTranslationsCount: number;
  cachedDefinitionsCount: number;
  latencyMs?: number;
  errorMessage?: string;
}

export interface INewsRepository {
  // Operational Mode & Health
  getMode(): StorageMode;
  ping(): Promise<boolean>;
  getDiagnostics(): Promise<RepositoryDiagnostics>;

  // News Sources
  getSources(): Promise<NewsSource[]>;
  getSourceById(id: string): Promise<NewsSource | undefined>;
  updateSource(id: string, updates: Partial<NewsSource>): Promise<NewsSource | undefined>;
  updateSourceHealth(id: string, success: boolean, error?: string): Promise<NewsSource | undefined>;
  upsertSource(source: NewsSource): Promise<NewsSource>;

  // Articles & News Stories
  getArticles(limit?: number): Promise<Article[]>;
  addArticle(article: Article): Promise<Article>;
  getStories(filter?: StoryFilterOptions): Promise<{ stories: CanonicalStory[]; total: number }>;
  getStoryById(id: string): Promise<CanonicalStory | undefined>;
  upsertStory(story: CanonicalStory): Promise<CanonicalStory>;

  // Perspectives
  getPerspective(storyId: string): Promise<PerspectiveAnalysis | undefined>;
  savePerspective(perspective: PerspectiveAnalysis): Promise<PerspectiveAnalysis>;

  // Hourly Briefings
  getBriefings(scope?: string, state?: string): Promise<HourlyPulseBriefing[]>;
  getLatestBriefing(scope?: string): Promise<HourlyPulseBriefing | undefined>;
  addBriefing(briefing: HourlyPulseBriefing): Promise<HourlyPulseBriefing>;

  // User Profiles (Public users)
  getUserProfile(userId: string, token?: string): Promise<UserProfileRecord | undefined>;
  updateUserProfile(userId: string, updates: Partial<UserProfileRecord>, token?: string): Promise<UserProfileRecord | undefined>;

  // User Preferences
  getPreferences(userId: string, token?: string): Promise<UserPreferences>;
  savePreferences(userId: string, prefs: Partial<UserPreferences>, token?: string): Promise<UserPreferences>;

  // Saved Stories
  getSavedStories(userId: string, token?: string): Promise<SavedStoryRecord[]>;
  saveStory(userId: string, storyId: string, personalNotes?: string, token?: string): Promise<SavedStoryRecord>;
  removeSavedStory(userId: string, storyId: string, token?: string): Promise<boolean>;

  // Reading History
  recordReading(userId: string, storyId: string, timeSpentSeconds?: number, token?: string): Promise<ReadingHistoryRecord>;
  getReadingHistory(userId: string, limit?: number, token?: string): Promise<ReadingHistoryRecord[]>;

  // Personal Vocabulary & Reviews
  getVocabulary(userId: string, filter?: VocabularyFilterOptions, token?: string): Promise<VocabularyEntry[]>;
  addVocabulary(entry: VocabularyEntry, token?: string): Promise<VocabularyEntry>;
  updateVocabulary(id: string, updates: Partial<VocabularyEntry>, userId?: string, token?: string): Promise<VocabularyEntry | undefined>;
  deleteVocabulary(id: string, userId?: string, token?: string): Promise<boolean>;
  addVocabularyReview(review: Omit<VocabularyReviewRecord, 'id'>, token?: string): Promise<VocabularyReviewRecord>;
  getVocabularyReviews(vocabularyId: string, token?: string): Promise<VocabularyReviewRecord[]>;

  // Ask Conversations
  getConversation(id: string, userId?: string, token?: string): Promise<{ id: string; title: string; language: string; messages: AskMessage[] } | undefined>;
  saveConversation(id: string, userId: string, title: string, language: string, messages: AskMessage[], token?: string): Promise<any>;

  // Notifications & Web Push
  getNotifications(userId: string, token?: string): Promise<NotificationRecord[]>;
  addNotification(notif: NotificationRecord): Promise<NotificationRecord>;
  markNotificationRead(id: string, userId?: string, token?: string): Promise<boolean>;
  markAllNotificationsRead(userId: string, token?: string): Promise<void>;
  getPushSubscriptions(userId?: string, token?: string): Promise<PushSubscriptionRecord[]>;
  addPushSubscription(sub: PushSubscriptionRecord, token?: string): Promise<PushSubscriptionRecord>;
  updatePushSubscription(endpoint: string, updates: Partial<PushSubscriptionRecord>, token?: string): Promise<PushSubscriptionRecord | undefined>;
  deletePushSubscription(endpoint: string, token?: string): Promise<boolean>;

  // Cache & Translations
  getCachedTranslation(hash: string, lang: string): Promise<any | undefined>;
  setCachedTranslation(hash: string, lang: string, data: any): Promise<void>;
  getCachedDefinition(word: string, contextHash: string, lang: string): Promise<any | undefined>;
  setCachedDefinition(word: string, contextHash: string, lang: string, data: any): Promise<void>;

  // Telemetry & Logs
  addIngestionLog(metric: IngestionMetric): Promise<void>;
  getIngestionLogs(limit?: number): Promise<IngestionMetric[]>;
  addAILog(log: any): Promise<void>;
  getAILogs(limit?: number): Promise<any[]>;
}
