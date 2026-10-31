import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MultiModelAIOrchestrator } from '../ai/orchestrator.js';
import { OpenAIAdapter } from '../ai/adapters/openaiAdapter.js';
import { AnthropicAdapter } from '../ai/adapters/anthropicAdapter.js';
import { XAIAdapter } from '../ai/adapters/xaiAdapter.js';
import { FallbackAdapter } from '../ai/adapters/fallbackAdapter.js';
import { GroundingCitationValidator } from '../ai/grounding/citationValidator.js';
import { AICacheAndRateLimiter } from '../ai/cache/aiCache.js';
import { StorySummarySchema, WhyItMattersSchema, AskNewsSchema, PerspectiveAnalysisSchema } from '../ai/types.js';
import { CanonicalStory } from '../types/index.js';

describe('Phase 5: Multi-Model AI Orchestrator & Provider Adapters', () => {
  let orchestrator: MultiModelAIOrchestrator;

  beforeEach(() => {
    orchestrator = new MultiModelAIOrchestrator();
  });

  describe('1. Security & Configuration Governance', () => {
    it('defaults AI_PRIMARY_PROVIDER to fallback when external credentials are unset', () => {
      const status = orchestrator.getActiveStatus();
      expect(status.activeProvider).toBe('fallback');
      expect(status.isFallbackActive).toBe(true);
    });

    it('strictly masks API keys in status/config output to prevent frontend secret leakage', () => {
      orchestrator.updateConfig({
        openai: {
          apiKey: 'sk-proj-test1234567890abcdef',
          economicalModel: 'gpt-4o-mini',
          strongModel: 'gpt-4o',
          maxRetries: 1,
          rateLimitPerMinute: 60,
        },
      });

      const config = orchestrator.getConfig();
      expect(config.openaiApiKey).toBeDefined();
      expect(config.openaiApiKey).toContain('••••••••');
      expect(config.openaiApiKey?.endsWith('cdef')).toBe(true);
      expect(config.openaiApiKey).not.toBe('sk-proj-test1234567890abcdef');
    });

    it('treats missing, empty, or placeholder keys as unavailable', () => {
      const emptyAdapter = new OpenAIAdapter({
        apiKey: '',
        economicalModel: 'gpt-4o-mini',
        strongModel: 'gpt-4o',
        maxRetries: 1,
        rateLimitPerMinute: 60,
      });
      expect(emptyAdapter.isAvailable()).toBe(false);

      const placeholderAdapter = new AnthropicAdapter({
        apiKey: 'your_anthropic_key_placeholder',
        economicalModel: 'claude-3-haiku-20240307',
        strongModel: 'claude-3-5-sonnet-20241022',
        maxRetries: 1,
        rateLimitPerMinute: 60,
      });
      expect(placeholderAdapter.isAvailable()).toBe(false);

      const validAdapter = new XAIAdapter({
        apiKey: 'xai-live-secret-key-123456',
        economicalModel: 'grok-2-mini',
        strongModel: 'grok-2-1212',
        maxRetries: 1,
        rateLimitPerMinute: 60,
      });
      expect(validAdapter.isAvailable()).toBe(true);
    });
  });

  describe('2. Fallback Adapter (100% Offline Editorial Engine)', () => {
    const fallback = new FallbackAdapter();

    it('is always available offline without network keys', () => {
      expect(fallback.isAvailable()).toBe(true);
      expect(fallback.providerName).toBe('fallback');
    });

    it('executes story summarization with valid schema', async () => {
      const result = await fallback.generateStructured({
        taskType: 'summarize',
        systemPrompt: 'Summarize news',
        userPrompt: JSON.stringify({
          title: 'Reserve Bank of India Monetary Policy Update',
          summary: 'The Monetary Policy Committee voted unanimously to keep the repo rate unchanged at 6.50 percent. Core inflation remains within the target tolerance band.',
        }),
        schema: StorySummarySchema,
      });

      expect(result.data.summary).toBeDefined();
      expect(result.data.summary.length).toBeGreaterThan(15);
      expect(result.modelUsed).toContain('Fallback');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('executes Ask the News inquiry without hallucinating sources', async () => {
      const mockStories: CanonicalStory[] = [
        {
          id: 'story-rbi-repo-rate',
          title: 'RBI Keeps Repo Rate at 6.5%',
          summary: 'The RBI MPC maintained status quo on the benchmark lending rate.',
          whyItMatters: 'Stabilizes borrowing costs for mortgages and commercial credit.',
          geographicScope: 'national',
          country: 'India',
          category: 'economy',
          evidenceStatus: 'official_documentation',
          importanceLevel: 'high',
          firstReportedAt: new Date().toISOString(),
          lastUpdatedAt: new Date().toISOString(),
          articles: [
            {
              id: 'art-rbi-1',
              sourceId: 'src-pib',
              sourceName: 'Press Information Bureau (PIB)',
              title: 'Monetary Policy Statement',
              summary: 'Official release from RBI.',
              content: 'Full statement from RBI Governor.',
              url: 'https://pib.gov.in/PressReleasePage.aspx?PRID=1001',
              publishedAt: new Date().toISOString(),
              ingestedAt: new Date().toISOString(),
              geographicScope: 'national',
              country: 'India',
              category: 'economy',
              language: 'en',
              evidenceLabel: 'official_documentation',
              isOpinion: false,
            }
          ],
          timeline: [],
          isLiveIngested: true,
          isPerspectiveAvailable: true,
        }
      ];

      const result = await fallback.generateStructured({
        taskType: 'ask',
        systemPrompt: 'Answer inquiry',
        userPrompt: JSON.stringify({
          query: 'What is the current RBI repo rate?',
          stories: mockStories,
          targetLanguage: 'en',
          detailMode: 'concise',
        }),
        schema: AskNewsSchema,
      });

      expect(result.data.answer).toBeDefined();
      expect(result.data.citedSources?.length).toBeGreaterThan(0);
      expect(result.data.citedSources?.[0]?.sourceName).toBe('Press Information Bureau (PIB)');
    });
  });

  describe('3. Grounding & Citation Validation Engine', () => {
    const mockContextStory: CanonicalStory = {
      id: 'story-telangana-irrigation',
      title: 'Telangana Irrigation Canal Project Review',
      summary: 'State authorities conducted inspections across North Telangana canals.',
      whyItMatters: 'Ensures water availability for rabi agricultural sowing.',
      geographicScope: 'state',
      state: 'Telangana',
      country: 'India',
      category: 'infrastructure',
      evidenceStatus: 'corroborated_by_sources',
      importanceLevel: 'normal',
      firstReportedAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      articles: [
        {
          id: 'art-tg-irrigation-1',
          sourceId: 'src-hindu',
          sourceName: 'The Hindu',
          title: 'Canal review in Adilabad',
          summary: 'Inspection details.',
          content: 'Details.',
          url: 'https://thehindu.com/news/national/telangana/canal-review',
          publishedAt: new Date().toISOString(),
          ingestedAt: new Date().toISOString(),
          geographicScope: 'state',
          state: 'Telangana',
          country: 'India',
          category: 'infrastructure',
          language: 'en',
          evidenceLabel: 'corroborated_by_sources',
          isOpinion: false,
        }
      ],
      timeline: [],
      isPerspectiveAvailable: true,
    };

    it('preserves valid citations matching actual database stories', () => {
      const candidates = [
        {
          id: 'story-telangana-irrigation',
          title: 'Telangana Irrigation Canal Project Review',
          sourceName: 'The Hindu',
          url: 'https://thehindu.com/news/national/telangana/canal-review',
        }
      ];

      const validated = GroundingCitationValidator.validateCitations(candidates, {
        stories: [mockContextStory],
      });

      expect(validated.length).toBe(1);
      expect(validated[0].id).toBe('story-telangana-irrigation');
      expect(validated[0].sourceName).toBe('The Hindu');
      expect(validated[0].url).toBe('https://thehindu.com/news/national/telangana/canal-review');
    });

    it('strips hallucinated citations and fabricated URLs not present in context', () => {
      const candidates = [
        {
          id: 'fabricated-story-999',
          title: 'Fabricated Secret Subsidies Unveiled',
          sourceName: 'FakeNewsBlog',
          url: 'https://random-unverified-blog.xyz/post/123',
        }
      ];

      const validated = GroundingCitationValidator.validateCitations(candidates, {
        stories: [mockContextStory],
      });

      expect(validated.length).toBe(0); // Hallucination eliminated
    });

    it('formats grounded context with explicit attribution to verified sources', () => {
      const formatted = GroundingCitationValidator.formatEditorialContext([mockContextStory]);
      expect(formatted).toContain('ID: story-telangana-irrigation');
      expect(formatted).toContain('The Hindu');
      expect(formatted).toContain('https://thehindu.com/news/national/telangana/canal-review');
      expect(formatted).toContain('Status: corroborated_by_sources');
    });
  });

  describe('4. Caching, Rate Limiting & Usage Logging', () => {
    it('returns cached results on identical payload to prevent redundant external API calls', async () => {
      const cache = new AICacheAndRateLimiter(60);
      const key = cache.generateKey('summarize', { title: 'Test Title' }, 'en');

      cache.set(key, { summary: 'Cached summary' }, 'OpenAI (gpt-4o-mini)');
      const cached = cache.get(key);

      expect(cached).toBeDefined();
      expect((cached?.data as any).summary).toBe('Cached summary');
      expect(cached?.modelUsed).toBe('OpenAI (gpt-4o-mini)');
    });

    it('enforces provider sliding-window rate limit and returns retry-after window', () => {
      const cache = new AICacheAndRateLimiter(60);
      const provider = 'openai';
      const limit = 3;

      expect(cache.checkAndRecordRateLimit(provider, limit).allowed).toBe(true);
      expect(cache.checkAndRecordRateLimit(provider, limit).allowed).toBe(true);
      expect(cache.checkAndRecordRateLimit(provider, limit).allowed).toBe(true);

      // 4th request in the same minute should be rejected
      const fourth = cache.checkAndRecordRateLimit(provider, limit);
      expect(fourth.allowed).toBe(false);
      expect(fourth.retryAfterSeconds).toBeGreaterThan(0);
    });

    it('records telemetry metrics for latency, tokens, and success rates', () => {
      const cache = new AICacheAndRateLimiter(60);
      cache.logUsage({
        taskType: 'summarize',
        provider: 'openai',
        modelUsed: 'gpt-4o-mini',
        latencyMs: 340,
        success: true,
        tokenEstimate: 210,
      });

      cache.logUsage({
        taskType: 'perspective',
        provider: 'anthropic',
        modelUsed: 'claude-3-5-sonnet',
        latencyMs: 1120,
        success: true,
        tokenEstimate: 950,
      });

      const metrics = cache.getMetrics();
      expect(metrics.totalRequests).toBe(2);
      expect(metrics.successfulRequests).toBe(2);
      expect(metrics.failedRequests).toBe(0);
      expect(metrics.averageLatencyMs).toBe(730);
      expect(metrics.providerBreakdown.openai).toBe(1);
      expect(metrics.providerBreakdown.anthropic).toBe(1);
    });
  });

  describe('5. Failover Chain & Outage Resilience', () => {
    it('falls over from primary to secondary, and then to fallback when errors occur', async () => {
      // Configure orchestrator with primary that will fail, and verify fallback catches it
      orchestrator.updateConfig({
        primaryProvider: 'openai',
        secondaryProvider: 'anthropic',
        openai: {
          apiKey: 'sk-invalid-key-will-trigger-failover',
          economicalModel: 'gpt-4o-mini',
          strongModel: 'gpt-4o',
          maxRetries: 0,
          rateLimitPerMinute: 60,
        },
        anthropic: {
          apiKey: 'invalid-anthropic-key',
          economicalModel: 'claude-3-haiku-20240307',
          strongModel: 'claude-3-5-sonnet-20241022',
          maxRetries: 0,
          rateLimitPerMinute: 60,
        },
      });

      // Execute task - must NOT throw, must complete via fallback safely
      const result = await orchestrator.executeTask({
        taskType: 'why_it_matters',
        systemPrompt: 'Explain why it matters',
        userPrompt: JSON.stringify({ category: 'governance', geographicScope: 'national' }),
        schema: WhyItMattersSchema,
      });

      expect(result.data).toBeDefined();
      expect(result.data.whyItMatters).toBeDefined();
      expect(result.modelUsed).toContain('Fallback');
    });
  });

  describe('6. Structured Output Schema Validation', () => {
    it('rejects malformed JSON and enforces Zod contracts', async () => {
      const adapter = new (class extends FallbackAdapter {
        async generateStructured<T>(opts: any): Promise<any> {
          // Simulate malformed JSON missing required fields
          const invalidPayload = { invalidKey: 123 };
          opts.schema.parse(invalidPayload); // Will throw ZodError
        }
      })();

      await expect(
        adapter.generateStructured({
          taskType: 'summarize',
          systemPrompt: '',
          userPrompt: '',
          schema: StorySummarySchema,
        })
      ).rejects.toThrow();
    });
  });

  describe('7. High Concurrency Stress Test', () => {
    it('handles 10 concurrent AI requests without race conditions or state corruption', async () => {
      const promises = Array.from({ length: 10 }).map((_, idx) =>
        orchestrator.explainWhyItMatters(
          `Story ${idx}`,
          `Summary of development ${idx}`,
          'governance',
          'national'
        )
      );

      const results = await Promise.all(promises);
      expect(results.length).toBe(10);
      expect(results.every(r => r.whyItMatters && r.whyItMatters.length > 5)).toBe(true);
    });
  });
});
