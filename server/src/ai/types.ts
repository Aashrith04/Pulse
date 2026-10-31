import { z } from 'zod';
import { 
  CanonicalStory, 
  PerspectiveAnalysis, 
  LanguageCode, 
  AskCitation, 
  HourlyPulseBriefing, 
  EvidenceStatus 
} from '../types/index.js';

// ==========================================
// 1. AI PROVIDER & TASK TAXONOMY
// ==========================================

export type SupportedAIProvider = 'openai' | 'anthropic' | 'xai' | 'fallback';

export type AITaskType = 
  | 'summarize'
  | 'why_it_matters'
  | 'perspective'
  | 'evidence_audit'
  | 'ask'
  | 'catch_me_up'
  | 'story_evolution'
  | 'translate'
  | 'hourly_briefing'
  | 'dictionary';

export type ModelTier = 'economical' | 'strong';

export interface TaskTierMapping {
  tier: ModelTier;
  timeoutMs: number;
  maxTokens: number;
  temperature: number;
}

export const TASK_CONFIG: Record<AITaskType, TaskTierMapping> = {
  summarize: { tier: 'economical', timeoutMs: 7000, maxTokens: 400, temperature: 0.2 },
  why_it_matters: { tier: 'economical', timeoutMs: 7000, maxTokens: 300, temperature: 0.2 },
  perspective: { tier: 'strong', timeoutMs: 14000, maxTokens: 2500, temperature: 0.2 },
  evidence_audit: { tier: 'strong', timeoutMs: 12000, maxTokens: 1500, temperature: 0.1 },
  ask: { tier: 'strong', timeoutMs: 12000, maxTokens: 1200, temperature: 0.2 },
  catch_me_up: { tier: 'economical', timeoutMs: 8000, maxTokens: 600, temperature: 0.2 },
  story_evolution: { tier: 'economical', timeoutMs: 7000, maxTokens: 400, temperature: 0.1 },
  translate: { tier: 'economical', timeoutMs: 8000, maxTokens: 800, temperature: 0.1 },
  hourly_briefing: { tier: 'strong', timeoutMs: 14000, maxTokens: 2000, temperature: 0.2 },
  dictionary: { tier: 'economical', timeoutMs: 6000, maxTokens: 400, temperature: 0.2 },
};

// ==========================================
// 2. PROVIDER CONFIGURATION
// ==========================================

export interface ProviderSpecificConfig {
  apiKey?: string;
  baseUrl?: string;
  economicalModel: string;
  strongModel: string;
  maxRetries: number;
  rateLimitPerMinute: number;
}

export interface OrchestratorConfig {
  primaryProvider: SupportedAIProvider;
  secondaryProvider: SupportedAIProvider;
  openai: ProviderSpecificConfig;
  anthropic: ProviderSpecificConfig;
  xai: ProviderSpecificConfig;
  cacheTtlSeconds: number;
  logUsage: boolean;
}

// ==========================================
// 3. STRUCTURED OUTPUT ZOD SCHEMAS
// ==========================================

export const StorySummarySchema = z.object({
  summary: z.string().min(10),
  keyPoints: z.array(z.string()).optional(),
});
export type StorySummaryOutput = z.infer<typeof StorySummarySchema>;

export const WhyItMattersSchema = z.object({
  whyItMatters: z.string().min(10),
  civicSignificance: z.string().optional(),
});
export type WhyItMattersOutput = z.infer<typeof WhyItMattersSchema>;

export const PerspectiveAnalysisSchema = z.object({
  whatHappened: z.string(),
  generalTake: z.string(),
  whyItMatters: z.string(),
  perspectivesInFavor: z.array(z.object({
    argument: z.string(),
    citedSource: z.string(),
    affectedGroup: z.string(),
  })),
  perspectivesAgainst: z.array(z.object({
    argument: z.string(),
    citedSource: z.string(),
    affectedGroup: z.string(),
  })),
  affectedGroupsConcerns: z.array(z.object({
    group: z.string(),
    concern: z.string(),
    evidence: z.string(),
  })),
  expertInstitutionalViews: z.array(z.object({
    institution: z.string(),
    position: z.string(),
    source: z.string(),
  })),
  evidenceWellEstablished: z.array(z.string()),
  evidencePreliminary: z.array(z.string()),
  evidenceDisputed: z.array(z.string()),
  evidenceMissing: z.array(z.string()),
  possibleConsequencesPositive: z.array(z.string()),
  possibleConsequencesNegative: z.array(z.string()),
  whatToWatchNext: z.array(z.object({
    eventDescription: z.string(),
    expectedTimeline: z.string(),
    verifiableSource: z.string(),
  })),
  perspectiveComparison: z.array(z.object({
    topic: z.string(),
    positionA: z.object({
      title: z.string(),
      argument: z.string(),
      limitation: z.string(),
    }),
    positionB: z.object({
      title: z.string(),
      argument: z.string(),
      limitation: z.string(),
    }),
  })),
});
export type PerspectiveAnalysisOutput = z.infer<typeof PerspectiveAnalysisSchema>;

export const EvidenceAuditSchema = z.object({
  wellEstablished: z.array(z.string()),
  preliminaryEvidence: z.array(z.string()),
  disputedClaims: z.array(z.string()),
  missingInfo: z.array(z.string()),
  overallReliabilityGrade: z.enum(['high', 'moderate', 'low', 'provisional']),
  auditSummary: z.string(),
});
export type EvidenceAuditOutput = z.infer<typeof EvidenceAuditSchema>;

export const AskNewsSchema = z.object({
  answer: z.string().min(5),
  citedSources: z.array(z.object({
    id: z.string(),
    title: z.string(),
    sourceName: z.string(),
    url: z.string(),
    publishedAt: z.string(),
    evidenceStatus: z.string(),
    relevanceSnippet: z.string(),
  })).default([]),
  isIncomplete: z.boolean().default(false),
  unansweredAspects: z.array(z.string()).optional(),
});
export type AskNewsOutput = z.infer<typeof AskNewsSchema>;

export const CatchMeUpSynthesisSchema = z.object({
  executiveSynthesis: z.string().min(10),
  keyDeltas: z.array(z.string()),
  watchItems: z.array(z.string()),
});
export type CatchMeUpSynthesisOutput = z.infer<typeof CatchMeUpSynthesisSchema>;

export const StoryEvolutionSchema = z.object({
  isSubstantiveUpdate: z.boolean(),
  whatChanged: z.string(),
  evidenceStatus: z.enum([
    'official_documentation',
    'corroborated_by_sources',
    'reported_by_one_source',
    'attributed_claim',
    'developing_unverified',
    'conflicting_reports'
  ]),
  timelineTitle: z.string().optional(),
  timelineDescription: z.string().optional(),
});
export type StoryEvolutionOutput = z.infer<typeof StoryEvolutionSchema>;

export const TranslationSchema = z.object({
  title: z.string(),
  summary: z.string(),
  whyItMatters: z.string(),
  targetLanguage: z.string(),
  isTranslated: z.boolean(),
});
export type TranslationOutput = z.infer<typeof TranslationSchema>;

export const HourlyBriefingSynthesisSchema = z.object({
  summaryOverview: z.string().min(10),
  developments: z.array(z.object({
    storyId: z.string(),
    headline: z.string(),
    whatHappened: z.string(),
    whyItMatters: z.string(),
    whatChanged: z.string(),
    sources: z.array(z.object({ name: z.string(), url: z.string() })),
    evidenceStatus: z.string(),
  })),
  whatChangedSincePrevious: z.object({
    newStoriesCount: z.number(),
    substantiveUpdatesCount: z.number(),
    highlights: z.array(z.string()),
  }),
});
export type HourlyBriefingSynthesisOutput = z.infer<typeof HourlyBriefingSynthesisSchema>;

export const ContextualDefinitionSchema = z.object({
  word: z.string(),
  contextualMeaning: z.string(),
  originalDefinition: z.string(),
  pronunciation: z.string().default(''),
  partOfSpeech: z.string().default(''),
  exampleSentence: z.string().default(''),
  synonyms: z.array(z.string()).default([]),
});
export type ContextualDefinitionOutput = z.infer<typeof ContextualDefinitionSchema>;

// ==========================================
// 4. ADAPTER INTERFACE
// ==========================================

export interface AIProviderAdapter {
  readonly providerName: SupportedAIProvider;
  
  isAvailable(): boolean;
  
  generateStructured<T>(options: {
    taskType: AITaskType;
    systemPrompt: string;
    userPrompt: string;
    schema: z.ZodSchema<T>;
    tier?: ModelTier;
    temperature?: number;
    timeoutMs?: number;
  }): Promise<{ data: T; modelUsed: string; latencyMs: number; tokenEstimate?: number }>;
}
