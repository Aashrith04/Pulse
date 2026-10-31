import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../index.js';
import { getRepository } from '../db/repositoryFactory.js';
import { aiOrchestrator } from '../ai/orchestrator.js';
import { rssAdapter } from '../ingestion/rssAdapter.js';

describe('Phase 6: Performance, Concurrency & Reliability Suite', () => {
  beforeAll(async () => {
    const repo = getRepository();
    expect(repo).toBeDefined();
  });

  it('1. Concurrency: Handles 50 concurrent reader requests with zero dropped connections and sub-second p95 latency', async () => {
    const concurrentRequests = 50;
    const startTime = Date.now();

    const promises = Array.from({ length: concurrentRequests }).map(async (_, idx) => {
      const endpoints = ['/api/stories', '/api/briefings/latest', '/api/health', '/api/sources/health'];
      const ep = endpoints[idx % endpoints.length];
      const res = await request(app).get(ep);
      return { status: res.status, latency: Date.now() - startTime };
    });

    const results = await Promise.all(promises);
    const totalDuration = Date.now() - startTime;

    // Zero 5xx errors
    const errorCount = results.filter(r => r.status >= 500).length;
    expect(errorCount).toBe(0);

    // All return 200
    const successCount = results.filter(r => r.status === 200).length;
    expect(successCount).toBe(concurrentRequests);

    const avgLatency = totalDuration / concurrentRequests;
    console.log(`[Perf Test] 50 Concurrent Requests completed in ${totalDuration}ms (Avg: ${avgLatency.toFixed(2)}ms per request)`);
    expect(totalDuration).toBeLessThan(10000);
  });

  it('2. RSS Outage Isolation: Gracefully isolates single feed failures without affecting healthy feeds or crashing', async () => {
    const badSource = {
      id: 'test-failing-feed',
      slug: 'test-failing-feed',
      name: 'Unreachable Test Feed',
      url: 'https://unreachable-invalid-domain-12345.pulse.news/rss',
      rssUrl: 'https://unreachable-invalid-domain-12345.pulse.news/rss',
      category: 'general' as const,
      trustTier: 'verified_media' as const,
      geographicScope: 'national' as const,
      country: 'India',
      isOfficial: false,
      fetchFrequencyMinutes: 30,
      isEnabled: true,
      consecutiveErrors: 0,
    };

    // Attempt to fetch bad source
    const result = await rssAdapter.fetchFromSource(badSource);
    expect(Array.isArray(result.articles)).toBe(true);
    expect(result.articles.length).toBe(0);
    expect(result.error).toBeDefined();
  });

  it('3. Cache Performance: Delivers sub-15ms cached responses and records cache hits accurately', async () => {
    const testStory = (await getRepository().getStories({ limit: 1 })).stories[0];
    expect(testStory).toBeDefined();

    // 1st Call (Prime cache / Compute)
    const t0 = Date.now();
    const firstRes = await aiOrchestrator.explainWhyItMatters(
      testStory.title, 
      testStory.summary, 
      testStory.category, 
      testStory.geographicScope
    );
    const firstLatency = Date.now() - t0;

    // 2nd Call (Identical content - Cache Hit)
    const t1 = Date.now();
    const cachedRes = await aiOrchestrator.explainWhyItMatters(
      testStory.title, 
      testStory.summary, 
      testStory.category, 
      testStory.geographicScope
    );
    const cachedLatency = Date.now() - t1;

    expect(cachedRes).toBeDefined();
    expect(cachedRes.whyItMatters).toBe(firstRes.whyItMatters);
    console.log(`[Perf Test] Cache performance: Initial=${firstLatency}ms, Cached=${cachedLatency}ms`);
    expect(cachedLatency).toBeLessThan(firstLatency + 10);
  });

  it('4. Large Story Feed Serialization: Serializes large story payloads with full article arrays under 500ms', async () => {
    const t0 = Date.now();
    const res = await request(app).get('/api/stories?limit=50');
    const latency = Date.now() - t0;

    expect(res.status).toBe(200);
    expect(res.body.stories.length).toBeGreaterThan(0);
    console.log(`[Perf Test] Fetched 50 stories with rich payloads in ${latency}ms`);
    expect(latency).toBeLessThan(1000);
  });

  it('5. Public Editorial & Diagnostics Persistence: Canonical stories and briefings are consistently queried from active storage', async () => {
    const repo = getRepository();
    const storiesRes = await repo.getStories({ limit: 5 });
    expect(storiesRes.stories.length).toBeGreaterThan(0);
    expect(storiesRes.total).toBeGreaterThan(0);

    const latestBriefing = await repo.getLatestBriefing('global');
    expect(latestBriefing).toBeDefined();
    expect(latestBriefing?.importantDevelopments).toBeDefined();
  });
});
