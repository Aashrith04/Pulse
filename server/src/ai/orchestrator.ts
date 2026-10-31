import { z } from 'zod';
import { 
  CanonicalStory, 
  PerspectiveAnalysis, 
  LanguageCode, 
  AskCitation, 
  HourlyPulseBriefing 
} from '../types/index.js';
import { 
  AITaskType, 
  SupportedAIProvider, 
  OrchestratorConfig, 
  AIProviderAdapter,
  StorySummarySchema,
  StorySummaryOutput,
  WhyItMattersSchema,
  WhyItMattersOutput,
  PerspectiveAnalysisSchema,
  PerspectiveAnalysisOutput,
  EvidenceAuditSchema,
  EvidenceAuditOutput,
  AskNewsSchema,
  AskNewsOutput,
  CatchMeUpSynthesisSchema,
  CatchMeUpSynthesisOutput,
  StoryEvolutionSchema,
  StoryEvolutionOutput,
  TranslationSchema,
  TranslationOutput,
  HourlyBriefingSynthesisSchema,
  HourlyBriefingSynthesisOutput,
  ContextualDefinitionSchema,
  ContextualDefinitionOutput,
  TASK_CONFIG,
} from './types.js';
import { OpenAIAdapter } from './adapters/openaiAdapter.js';
import { AnthropicAdapter } from './adapters/anthropicAdapter.js';
import { XAIAdapter } from './adapters/xaiAdapter.js';
import { FallbackAdapter } from './adapters/fallbackAdapter.js';
import { AICacheAndRateLimiter } from './cache/aiCache.js';
import { GroundingCitationValidator } from './grounding/citationValidator.js';
import { db } from '../db/database.js';

export class MultiModelAIOrchestrator {
  private config: OrchestratorConfig;
  private adapters: Map<SupportedAIProvider, AIProviderAdapter> = new Map();
  private cacheLimiter: AICacheAndRateLimiter;

  constructor() {
    this.config = {
      primaryProvider: (process.env.AI_PRIMARY_PROVIDER as SupportedAIProvider) || 'fallback',
      secondaryProvider: (process.env.AI_SECONDARY_PROVIDER as SupportedAIProvider) || 'fallback',
      openai: {
        apiKey: process.env.OPENAI_API_KEY?.trim(),
        baseUrl: process.env.OPENAI_BASE_URL?.trim() || 'https://api.openai.com/v1',
        economicalModel: process.env.OPENAI_MODEL_ECONOMICAL?.trim() || 'gpt-4o-mini',
        strongModel: process.env.OPENAI_MODEL?.trim() || 'gpt-4o',
        maxRetries: 1,
        rateLimitPerMinute: parseInt(process.env.OPENAI_RPM || '60', 10),
      },
      anthropic: {
        apiKey: process.env.ANTHROPIC_API_KEY?.trim(),
        baseUrl: process.env.ANTHROPIC_BASE_URL?.trim() || 'https://api.anthropic.com',
        economicalModel: process.env.ANTHROPIC_MODEL_ECONOMICAL?.trim() || 'claude-3-haiku-20240307',
        strongModel: process.env.ANTHROPIC_MODEL?.trim() || 'claude-3-5-sonnet-20241022',
        maxRetries: 1,
        rateLimitPerMinute: parseInt(process.env.ANTHROPIC_RPM || '60', 10),
      },
      xai: {
        apiKey: process.env.XAI_API_KEY?.trim(),
        baseUrl: process.env.XAI_BASE_URL?.trim() || 'https://api.x.ai/v1',
        economicalModel: process.env.XAI_MODEL_ECONOMICAL?.trim() || 'grok-2-mini',
        strongModel: process.env.XAI_MODEL?.trim() || 'grok-2-1212',
        maxRetries: 1,
        rateLimitPerMinute: parseInt(process.env.XAI_RPM || '60', 10),
      },
      cacheTtlSeconds: parseInt(process.env.AI_CACHE_TTL || '3600', 10),
      logUsage: process.env.AI_LOG_USAGE !== 'false',
    };

    this.cacheLimiter = new AICacheAndRateLimiter(this.config.cacheTtlSeconds);
    this.initAdapters();
  }

  private initAdapters() {
    this.adapters.set('openai', new OpenAIAdapter(this.config.openai));
    this.adapters.set('anthropic', new AnthropicAdapter(this.config.anthropic));
    this.adapters.set('xai', new XAIAdapter(this.config.xai));
    this.adapters.set('fallback', new FallbackAdapter());
  }

  /**
   * Updates runtime configuration while preserving security rules
   */
  updateConfig(updates: Partial<OrchestratorConfig>) {
    this.config = { ...this.config, ...updates };
    this.initAdapters();
  }

  getConfig() {
    return {
      primaryProvider: this.config.primaryProvider,
      secondaryProvider: this.config.secondaryProvider,
      openaiModel: this.config.openai.strongModel,
      openaiEconomicalModel: this.config.openai.economicalModel,
      anthropicModel: this.config.anthropic.strongModel,
      anthropicEconomicalModel: this.config.anthropic.economicalModel,
      xaiModel: this.config.xai.strongModel,
      xaiEconomicalModel: this.config.xai.economicalModel,
      // Mask keys in UI to prevent secret leakage
      openaiApiKey: this.maskKey(this.config.openai.apiKey),
      anthropicApiKey: this.maskKey(this.config.anthropic.apiKey),
      xaiApiKey: this.maskKey(this.config.xai.apiKey),
    };
  }

  private maskKey(key?: string): string | undefined {
    if (!key || key.length < 8) return undefined;
    return '••••••••' + key.slice(-4);
  }

  getActiveStatus() {
    return {
      activeProvider: this.config.primaryProvider,
      secondaryProvider: this.config.secondaryProvider,
      openaiConfigured: Boolean(this.adapters.get('openai')?.isAvailable()),
      anthropicConfigured: Boolean(this.adapters.get('anthropic')?.isAvailable()),
      xaiConfigured: Boolean(this.adapters.get('xai')?.isAvailable()),
      isFallbackActive: this.config.primaryProvider === 'fallback' || 
        (!this.adapters.get('openai')?.isAvailable() && 
         !this.adapters.get('anthropic')?.isAvailable() && 
         !this.adapters.get('xai')?.isAvailable()),
    };
  }

  getMetrics() {
    return this.cacheLimiter.getMetrics();
  }

  getRecentLogs(limit?: number) {
    return this.cacheLimiter.getRecentLogs(limit);
  }

  /**
   * Core task execution engine with automatic failover chain:
   * Primary Provider -> Secondary Provider -> Fallback Provider
   */
  async executeTask<T>(options: {
    taskType: AITaskType;
    systemPrompt: string;
    userPrompt: string;
    schema: z.ZodSchema<T>;
    cacheKeyPayload?: any;
    language?: string;
  }): Promise<{ data: T; modelUsed: string; isFromCache: boolean }> {
    // 1. Check in-memory / content cache
    const cacheKey = this.cacheLimiter.generateKey(options.taskType, options.cacheKeyPayload || options.userPrompt, options.language);
    const cached = this.cacheLimiter.get<T>(cacheKey);
    if (cached) {
      return { data: cached.data, modelUsed: `${cached.modelUsed} (cached)`, isFromCache: true };
    }

    // 2. Establish provider failover chain
    const chain: SupportedAIProvider[] = [];
    if (this.config.primaryProvider !== 'fallback') {
      chain.push(this.config.primaryProvider);
    }
    if (this.config.secondaryProvider !== 'fallback' && !chain.includes(this.config.secondaryProvider)) {
      chain.push(this.config.secondaryProvider);
    }
    chain.push('fallback'); // Guaranteed final safety net

    let lastError: Error | null = null;

    for (const provider of chain) {
      const adapter = this.adapters.get(provider);
      if (!adapter || !adapter.isAvailable()) {
        continue;
      }

      // Check rate limits
      if (provider !== 'fallback') {
        const rateLimitConfig = provider === 'openai' 
          ? this.config.openai.rateLimitPerMinute 
          : provider === 'anthropic' 
          ? this.config.anthropic.rateLimitPerMinute 
          : this.config.xai.rateLimitPerMinute;
        
        const rateCheck = this.cacheLimiter.checkAndRecordRateLimit(provider, rateLimitConfig);
        if (!rateCheck.allowed) {
          console.warn(`[AI Orchestrator] Provider ${provider} rate limited (${rateCheck.retryAfterSeconds}s). Failing over.`);
          continue;
        }
      }

      const startTime = Date.now();
      try {
        const result = await adapter.generateStructured({
          taskType: options.taskType,
          systemPrompt: options.systemPrompt,
          userPrompt: options.userPrompt,
          schema: options.schema,
        });

        // Cache successful response
        this.cacheLimiter.set(cacheKey, result.data, result.modelUsed);

        // Record telemetry log
        this.cacheLimiter.logUsage({
          taskType: options.taskType,
          provider,
          modelUsed: result.modelUsed,
          latencyMs: result.latencyMs,
          success: true,
          tokenEstimate: result.tokenEstimate,
        });

        return { data: result.data, modelUsed: result.modelUsed, isFromCache: false };
      } catch (err: any) {
        lastError = err;
        const latencyMs = Date.now() - startTime;
        console.warn(`[AI Orchestrator] Provider ${provider} failed on ${options.taskType}: ${err.message}. Triggering automatic failover.`);

        this.cacheLimiter.logUsage({
          taskType: options.taskType,
          provider,
          modelUsed: `${provider}-attempt`,
          latencyMs,
          success: false,
          errorMessage: err.message,
        });
      }
    }

    // Ultimate fallback if loop somehow terminated without success
    const fallbackAdapter = this.adapters.get('fallback')!;
    const fallbackResult = await fallbackAdapter.generateStructured({
      taskType: options.taskType,
      systemPrompt: options.systemPrompt,
      userPrompt: options.userPrompt,
      schema: options.schema,
    });
    return { data: fallbackResult.data, modelUsed: fallbackResult.modelUsed, isFromCache: false };
  }

  // ==========================================
  // 3. INTEGRATED PULSE FEATURES
  // ==========================================

  /**
   * 1. Story Summarization (Task: summarize)
   */
  async summarizeStory(
    title: string, 
    category: string, 
    articles: Array<{ sourceName: string; summary: string; content?: string }>
  ): Promise<StorySummaryOutput> {
    const systemPrompt = `You are an objective editorial summarizer for Pulse news intelligence. Provide a neutral, 2-sentence summary grounded strictly in the verified article content provided. Never editorialize or invent details.`;
    const userPrompt = JSON.stringify({
      title,
      category,
      articles: articles.map(a => ({ source: a.sourceName, excerpt: (a.content || a.summary).slice(0, 500) })),
    });

    const res = await this.executeTask({
      taskType: 'summarize',
      systemPrompt,
      userPrompt,
      schema: StorySummarySchema,
      cacheKeyPayload: { title, articles: articles.map(a => a.sourceName) },
    });
    return res.data;
  }

  /**
   * 2. Why This Matters Explanations (Task: why_it_matters)
   */
  async explainWhyItMatters(
    title: string, 
    summary: string, 
    category: string, 
    geographicScope: string
  ): Promise<WhyItMattersOutput> {
    const systemPrompt = `You are a civic policy analyst for Pulse. State in 1-2 concise, sober sentences why this development matters to citizens, governance, or institutional accountability. Avoid sensationalism.`;
    const userPrompt = JSON.stringify({ title, summary, category, geographicScope });

    const res = await this.executeTask({
      taskType: 'why_it_matters',
      systemPrompt,
      userPrompt,
      schema: WhyItMattersSchema,
      cacheKeyPayload: { title, summary, category },
    });
    return res.data;
  }

  /**
   * 3. Pro/Con Perspective Analysis (Task: perspective)
   */
  async getPerspective(story: CanonicalStory): Promise<PerspectiveAnalysis> {
    // Check repository database first
    const existing = db.getPerspective(story.id);
    if (existing) {
      return existing;
    }

    const systemPrompt = `You are the Perspective Desk analyst for Pulse. Given a verified news story and reporting sources, produce an intellectual, balanced perspective breakdown without manufacturing false balance.
STRICT GROUNDING: Distinguish established facts from institutional claims. Return JSON adhering to the PerspectiveAnalysis schema.`;

    const userPrompt = JSON.stringify({
      storyId: story.id,
      title: story.title,
      summary: story.summary,
      whyItMatters: story.whyItMatters,
      category: story.category,
      scope: story.geographicScope,
      state: story.state,
      articles: (story.articles || []).map(a => ({
        source: a.sourceName,
        url: a.url,
        summary: a.summary,
      })),
    });

    const res = await this.executeTask({
      taskType: 'perspective',
      systemPrompt,
      userPrompt,
      schema: PerspectiveAnalysisSchema,
      cacheKeyPayload: { id: story.id, updatedAt: story.lastUpdatedAt },
    });

    const perspectiveObj: PerspectiveAnalysis = {
      id: `persp-${story.id}`,
      storyId: story.id,
      whatHappened: res.data.whatHappened || story.summary,
      generalTake: res.data.generalTake,
      whyItMatters: res.data.whyItMatters || story.whyItMatters,
      perspectivesInFavor: res.data.perspectivesInFavor,
      perspectivesAgainst: res.data.perspectivesAgainst,
      affectedGroupsConcerns: res.data.affectedGroupsConcerns,
      expertInstitutionalViews: res.data.expertInstitutionalViews,
      evidenceWellEstablished: res.data.evidenceWellEstablished,
      evidencePreliminary: res.data.evidencePreliminary,
      evidenceDisputed: res.data.evidenceDisputed,
      evidenceMissing: res.data.evidenceMissing,
      possibleConsequencesPositive: res.data.possibleConsequencesPositive,
      possibleConsequencesNegative: res.data.possibleConsequencesNegative,
      whatToWatchNext: res.data.whatToWatchNext,
      perspectiveComparison: res.data.perspectiveComparison,
      aiProvider: res.modelUsed,
      updatedAt: new Date().toISOString(),
    };

    db.savePerspective(perspectiveObj);
    return perspectiveObj;
  }

  /**
   * 4. Evidence and Uncertainty Audits (Task: evidence_audit)
   */
  async auditEvidenceAndUncertainty(story: CanonicalStory): Promise<EvidenceAuditOutput> {
    const systemPrompt = `You are an evidentiary auditor for Pulse news intelligence. Categorize claims into: wellEstablished (official records), preliminaryEvidence (initial surveys/estimates), disputedClaims (contested statements), and missingInfo (unanswered audits).`;
    const userPrompt = JSON.stringify({
      title: story.title,
      summary: story.summary,
      evidenceStatus: story.evidenceStatus,
      sources: (story.articles || []).map(a => a.sourceName),
    });

    const res = await this.executeTask({
      taskType: 'evidence_audit',
      systemPrompt,
      userPrompt,
      schema: EvidenceAuditSchema,
      cacheKeyPayload: { id: story.id, updatedAt: story.lastUpdatedAt },
    });
    return res.data;
  }

  /**
   * 5. Ask the News (Task: ask)
   * Grounded conversational inquiry strictly citing verified database records
   */
  async askNews(
    query: string,
    targetLanguage: LanguageCode = 'en',
    detailMode: 'concise' | 'deep' = 'concise'
  ): Promise<{ answer: string; citations: AskCitation[]; modelUsed: string; isIncomplete: boolean }> {
    const stories = db.getStories({ limit: 50 }).stories;
    const qLower = query.toLowerCase().trim();

    // Context retrieval: search relevant stories
    const matchedStories = stories.filter(s => {
      const text = `${s.title} ${s.summary} ${s.whyItMatters} ${s.category} ${s.state || ''}`.toLowerCase();
      return qLower.split(/\s+/).filter(w => w.length > 2).some(token => text.includes(token));
    }).slice(0, 5);

    if (matchedStories.length === 0) {
      return {
        answer: targetLanguage === 'te'
          ? `క్షమించండి, మీ ప్రశ్న "${query}" కు సంబంధించిన ఖచ్చితమైన సమాచారం ప్రస్తుత ధృవీకరించబడిన డేటాబేస్‌లో లభించలేదు. పల్స్ ఊహాజనిత వార్తలను సృష్టించదు.`
          : `No verified reporting in the current news index matches your query "${query}". Pulse adheres to the principle of never fabricating headlines or claims. Please try refining your query or consulting official administrative gazettes.`,
        citations: [],
        modelUsed: 'Pulse Grounded Retrieval Filter',
        isIncomplete: true,
      };
    }

    const contextText = GroundingCitationValidator.formatEditorialContext(matchedStories);
    const systemPrompt = `You are the Pulse Ask the News AI research assistant.
STRICT GROUNDING RULES:
1. Answer the user's question using ONLY the provided verified news records.
2. NEVER fabricate facts, citations, sources, or URLs not present in the context.
3. Language: Respond in ${targetLanguage}.
4. Detail Level: ${detailMode}.
5. Return JSON with keys: answer (markdown string), citedSources (array of { id, title, sourceName, url, publishedAt, evidenceStatus, relevanceSnippet }), isIncomplete (boolean).`;

    const userPrompt = `USER QUESTION: "${query}"\n\nVERIFIED NEWS RECORDS:\n${contextText}`;

    const res = await this.executeTask({
      taskType: 'ask',
      systemPrompt,
      userPrompt,
      schema: AskNewsSchema,
      language: targetLanguage,
    });

    // Validate citations strictly against verified database records
    const validatedCitations = GroundingCitationValidator.validateCitations(res.data.citedSources || [], {
      stories: matchedStories,
    });

    // Fallback citations if AI failed to include them
    const finalCitations = validatedCitations.length > 0 ? validatedCitations : matchedStories.slice(0, 2).map(s => ({
      id: s.id,
      title: s.title,
      sourceName: s.articles[0]?.sourceName || 'Verified Source',
      url: s.articles[0]?.url || 'https://pulse.news',
      publishedAt: s.lastUpdatedAt,
      evidenceStatus: s.evidenceStatus,
      relevanceSnippet: s.summary,
    }));

    return {
      answer: res.data.answer,
      citations: finalCitations,
      modelUsed: res.modelUsed,
      isIncomplete: Boolean(res.data.isIncomplete),
    };
  }

  /**
   * 6. Catch Me Up Synthesis (Task: catch_me_up)
   */
  async generateCatchMeUpSynthesis(
    timeframe: string, 
    newCount: number, 
    updatedCount: number, 
    unresolvedCount: number
  ): Promise<CatchMeUpSynthesisOutput> {
    const systemPrompt = `You are the executive briefing editor for Pulse Catch Me Up. Summarize what changed over the selected timeframe in a concise, authoritative synthesis.`;
    const userPrompt = JSON.stringify({ timeframe, newCount, updatedCount, unresolvedCount });

    const res = await this.executeTask({
      taskType: 'catch_me_up',
      systemPrompt,
      userPrompt,
      schema: CatchMeUpSynthesisSchema,
      cacheKeyPayload: { timeframe, newCount, updatedCount },
    });
    return res.data;
  }

  /**
   * 7. Story Evolution and Change Detection (Task: story_evolution)
   */
  async detectStoryEvolution(
    existingStory: CanonicalStory, 
    newArticleSnippet: string
  ): Promise<StoryEvolutionOutput> {
    const systemPrompt = `You are a chronological news tracking analyst. Compare the existing story record with the newly ingested article excerpt. Determine if it constitutes a substantive factual update.`;
    const userPrompt = JSON.stringify({
      existingTitle: existingStory.title,
      existingSummary: existingStory.summary,
      newArticleExcerpt: newArticleSnippet.slice(0, 600),
    });

    const res = await this.executeTask({
      taskType: 'story_evolution',
      systemPrompt,
      userPrompt,
      schema: StoryEvolutionSchema,
    });
    return res.data;
  }

  /**
   * 8. Multilingual Translation and Explanations (Task: translate)
   */
  async translateNews(
    title: string, 
    summary: string, 
    whyItMatters: string, 
    targetLanguage: LanguageCode
  ): Promise<TranslationOutput> {
    if (targetLanguage === 'en') {
      return { title, summary, whyItMatters, targetLanguage, isTranslated: false };
    }

    const contentHash = Buffer.from(title + summary).toString('base64').slice(0, 24);
    const cached = db.getCachedTranslation(contentHash, targetLanguage);
    if (cached) {
      return { ...cached, isFromCache: true };
    }

    const systemPrompt = `Translate news headlines and analytical summaries accurately into ${targetLanguage}.
CRITICAL RULES:
1. Preserve proper nouns, statutory institution names, and numbers accurately.
2. Maintain journalistic objectivity.
3. Return JSON with keys: title, summary, whyItMatters, targetLanguage, isTranslated (boolean: true).`;

    const userPrompt = JSON.stringify({ title, summary, whyItMatters, targetLanguage });

    const res = await this.executeTask({
      taskType: 'translate',
      systemPrompt,
      userPrompt,
      schema: TranslationSchema,
      cacheKeyPayload: { contentHash, targetLanguage },
      language: targetLanguage,
    });

    db.setCachedTranslation(contentHash, targetLanguage, res.data);
    return res.data;
  }

  /**
   * 9. Hourly Briefing Generation (Task: hourly_briefing)
   */
  async generateHourlyBriefing(
    scope: string, 
    stories: CanonicalStory[], 
    windowStart: string, 
    windowEnd: string
  ): Promise<HourlyBriefingSynthesisOutput> {
    const systemPrompt = `You are the executive editor for Pulse Hourly Briefings. Synthesize the top verified developments into an executive overview and highlight significant developments with what changed since the previous hour.`;
    const userPrompt = JSON.stringify({
      scope,
      windowStart,
      windowEnd,
      stories: stories.slice(0, 5).map(s => ({
        id: s.id,
        title: s.title,
        summary: s.summary,
        whyItMatters: s.whyItMatters,
        evidenceStatus: s.evidenceStatus,
        sources: (s.articles || []).map(a => ({ name: a.sourceName, url: a.url })),
      })),
    });

    const res = await this.executeTask({
      taskType: 'hourly_briefing',
      systemPrompt,
      userPrompt,
      schema: HourlyBriefingSynthesisSchema,
      cacheKeyPayload: { scope, storyIds: stories.slice(0, 5).map(s => s.id) },
    });
    return res.data;
  }

  /**
   * 10. Contextual Tap-to-Understand Explanations (Task: dictionary)
   */
  async getContextualDefinition(
    word: string, 
    contextSentence: string, 
    targetLanguage: LanguageCode = 'en'
  ): Promise<ContextualDefinitionOutput & { isDemoFallback?: boolean; modelUsed?: string }> {
    const hash = Buffer.from(contextSentence).toString('base64').slice(0, 16);
    const cached = db.getCachedDefinition(word, hash, targetLanguage);
    if (cached) {
      return { ...cached, isFromCache: true };
    }

    const systemPrompt = `You are an editorial lexicographer for Pulse news intelligence. Provide a concise contextual definition of the selected word based strictly on the sentence context.
Return JSON with keys: word, contextualMeaning (in target language: ${targetLanguage}), originalDefinition (in English), pronunciation (phonetic), partOfSpeech, exampleSentence, synonyms (array of strings).`;

    const userPrompt = JSON.stringify({ word, contextSentence, targetLanguage });

    const res = await this.executeTask({
      taskType: 'dictionary',
      systemPrompt,
      userPrompt,
      schema: ContextualDefinitionSchema,
      cacheKeyPayload: { word, hash, targetLanguage },
      language: targetLanguage,
    });

    const result: ContextualDefinitionOutput & { isDemoFallback?: boolean; modelUsed?: string } = {
      word: res.data.word,
      contextualMeaning: res.data.contextualMeaning,
      originalDefinition: res.data.originalDefinition,
      pronunciation: res.data.pronunciation || '',
      partOfSpeech: res.data.partOfSpeech || '',
      exampleSentence: res.data.exampleSentence || '',
      synonyms: res.data.synonyms || [],
      modelUsed: res.modelUsed,
      isDemoFallback: res.modelUsed.includes('Fallback'),
    };

    db.setCachedDefinition(word, hash, targetLanguage, result);
    return result;
  }
}

export const aiOrchestrator = new MultiModelAIOrchestrator();
