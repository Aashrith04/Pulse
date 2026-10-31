export type GeographicScope = 'state' | 'national' | 'international' | 'global';

export type EvidenceStatus = 
  | 'official_documentation'
  | 'corroborated_by_sources'
  | 'reported_by_one_source'
  | 'attributed_claim'
  | 'developing_unverified'
  | 'conflicting_reports';

export type ImportanceLevel = 'critical' | 'high' | 'normal' | 'low';

export type LanguageCode = 
  | 'en' | 'te' | 'hi' | 'ta' | 'kn' | 'ml' 
  | 'bn' | 'mr' | 'gu' | 'pa' | 'or' | 'ur';

export interface NewsSource {
  id: string;
  slug: string;
  name: string;
  url: string;
  rssUrl?: string;
  geographicScope: GeographicScope;
  country: string;
  state?: string;
  category: string;
  isEnabled: boolean;
  isOfficial: boolean;
  trustTier: 'official_govt' | 'verified_media' | 'academic' | 'wire_agency';
  lastFetchedAt?: string;
  lastSuccessfulFetch?: string;
  lastError?: string;
  consecutiveErrors?: number;
  healthStatus?: 'healthy' | 'degraded' | 'stale' | 'failing';
  fetchFrequencyMinutes: number;
}

export interface PushSubscriptionRecord {
  id: string;
  userId: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  createdAt: string;
  lastDeliveredAt?: string;
  failureCount?: number;
}

export interface Article {
  id: string;
  sourceId: string;
  sourceName: string;
  title: string;
  summary: string;
  content: string;
  url: string;
  author?: string;
  leadImageUrl?: string;
  publishedAt: string;
  ingestedAt: string;
  geographicScope: GeographicScope;
  country: string;
  state?: string;
  category: string;
  language: string;
  evidenceLabel: EvidenceStatus;
  isOpinion: boolean;
  isLiveIngested?: boolean;
}

export interface StoryTimelineEvent {
  id: string;
  storyId: string;
  eventTimestamp: string;
  title: string;
  description: string;
  whatChanged?: string;
  sourceName: string;
  sourceUrl: string;
  evidenceStatus: EvidenceStatus;
}

export interface CanonicalStory {
  id: string;
  title: string;
  summary: string;
  whyItMatters: string;
  generalTake?: string;
  geographicScope: GeographicScope;
  country: string;
  state?: string;
  category: string;
  leadImageUrl?: string;
  evidenceStatus: EvidenceStatus;
  importanceLevel: ImportanceLevel;
  firstReportedAt: string;
  lastUpdatedAt: string;
  indiaImplication?: string;
  isPerspectiveAvailable: boolean;
  isLiveIngested?: boolean;
  articles: Article[];
  timeline: StoryTimelineEvent[];
}

export interface PerspectiveAnalysis {
  id: string;
  storyId: string;
  whatHappened: string;
  generalTake: string; // Clearly labeled as AI-generated analysis
  whyItMatters: string;
  perspectivesInFavor: { argument: string; citedSource: string; affectedGroup?: string }[];
  perspectivesAgainst: { argument: string; citedSource: string; affectedGroup?: string }[];
  affectedGroupsConcerns: { group: string; concern: string; evidence: string }[];
  expertInstitutionalViews: { institution: string; position: string; source: string }[];
  evidenceWellEstablished: string[];
  evidencePreliminary: string[];
  evidenceDisputed: string[];
  evidenceMissing: string[];
  possibleConsequencesPositive: string[];
  possibleConsequencesNegative: string[];
  whatToWatchNext: { eventDescription: string; expectedTimeline: string; verifiableSource: string }[];
  perspectiveComparison: {
    topic: string;
    positionA: { title: string; argument: string; limitation: string };
    positionB: { title: string; argument: string; limitation: string };
  }[];
  aiProvider: string;
  updatedAt: string;
}

export interface HourlyPulseBriefing {
  id: string;
  timeWindowStart: string;
  timeWindowEnd: string;
  generatedAt: string;
  scope: GeographicScope;
  state?: string;
  dataFreshnessMinutes: number;
  summaryOverview: string;
  importantDevelopments: {
    storyId: string;
    headline: string;
    whatHappened: string;
    whyItMatters: string;
    whatChanged: string;
    sources: { name: string; url: string }[];
    evidenceStatus: EvidenceStatus;
  }[];
  whatChangedSincePrevious: {
    newStoriesCount: number;
    substantiveUpdatesCount: number;
    highlights: string[];
  };
  sourceCount: number;
}

export interface VocabularyEntry {
  id: string;
  userId: string;
  storyId?: string;
  storyTitle?: string;
  word: string;
  sourceSentence: string;
  originalLanguage: string;
  targetLanguage: string;
  contextualMeaning: string;
  originalDefinition: string;
  pronunciation?: string;
  partOfSpeech?: string;
  exampleSentence?: string;
  synonyms?: string[];
  personalNotes?: string;
  masteryLevel: number; // 0: new, 1: practicing, 2: learned
  lastReviewedAt?: string;
  nextReviewDue: string;
  createdAt: string;
}

export interface UserPreferences {
  countryCode: string;
  state: string;
  city?: string;
  interfaceLanguage: LanguageCode;
  newsReadingLanguage: LanguageCode;
  summaryLength: 'concise' | 'balanced' | 'detailed';
  theme: 'light' | 'dark' | 'system';
  enableNotifications: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  topicsOfInterest: string[];
}

export interface NotificationRecord {
  id: string;
  userId: string;
  storyId?: string;
  dedupKey: string;
  priority: ImportanceLevel;
  title: string;
  body: string;
  deliveredAt: string;
  isDigest: boolean;
  bundledStoryIds: string[];
  readAt?: string;
}

export interface AskCitation {
  id: string;
  title: string;
  sourceName: string;
  url: string;
  publishedAt: string;
  evidenceStatus: EvidenceStatus;
  relevanceSnippet: string;
}

export interface AskMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citedSources?: AskCitation[];
  modelUsed?: string;
  createdAt: string;
}

export interface IngestionMetric {
  id: string;
  sourceName: string;
  status: 'success' | 'partial' | 'failed';
  articlesFetched: number;
  newStoriesCreated: number;
  durationMs: number;
  errorMessage?: string;
  createdAt: string;
}
