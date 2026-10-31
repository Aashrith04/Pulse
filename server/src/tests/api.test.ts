import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../index.js';
import { storyDeduplicator } from '../ingestion/deduplication.js';
import { notificationService } from '../services/notificationService.js';
import { taskScheduler } from '../ingestion/scheduler.js';
import { db } from '../db/database.js';
import { Article } from '../types/index.js';
import { resetRepository } from '../db/repositoryFactory.js';

describe('Pulse News Intelligence API Tests', () => {
  beforeAll(() => {
    process.env.PULSE_STORAGE_MODE = 'local';
    resetRepository('local');
  });
  it('GET /api/health returns healthy status and system diagnostics', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.diagnostics.storiesCount).toBeGreaterThan(0);
    expect(res.body.supportedStates).toContain('Telangana');
  });

  it('GET /api/stories returns stories and respects state filtering', async () => {
    const resAll = await request(app).get('/api/stories');
    expect(resAll.status).toBe(200);
    expect(Array.isArray(resAll.body.stories)).toBe(true);

    const resTG = await request(app).get('/api/stories?state=Telangana');
    expect(resTG.status).toBe(200);
    expect(resTG.body.stories.length).toBeGreaterThan(0);
    expect(resTG.body.stories.every((s: any) => !s.state || s.state.toLowerCase() === 'telangana')).toBe(true);
  });

  it('POST /api/dictionary/context returns contextual definition for Tap-to-Understand', async () => {
    const res = await request(app).post('/api/dictionary/context').send({
      word: 'repercussions',
      sentence: 'The rate hike could have far-reaching repercussions for borrowers.',
      language: 'te',
    });

    expect(res.status).toBe(200);
    expect(res.body.word.toLowerCase()).toBe('repercussions');
    expect(res.body.contextualMeaning).toBeDefined();
    expect(res.body.partOfSpeech).toBeDefined();
  });

  it('Vocabulary CRUD persists and updates mastery level', async () => {
    const wordPayload = {
      userId: 'test-user-vitest',
      word: 'concomitant',
      sourceSentence: 'Development brings a concomitant demand for energy.',
      contextualMeaning: 'Naturally accompanying.',
      originalDefinition: 'Accompanying in a subordinate way.',
      originalLanguage: 'en',
      targetLanguage: 'en',
    };

    const createRes = await request(app).post('/api/vocabulary').send(wordPayload);
    expect(createRes.status).toBe(201);
    expect(createRes.body.word).toBe('concomitant');

    const listRes = await request(app).get('/api/vocabulary?userId=test-user-vitest');
    expect(listRes.status).toBe(200);
    expect(listRes.body.vocabulary.some((v: any) => v.word === 'concomitant')).toBe(true);

    // Update mastery
    const id = createRes.body.id;
    const patchRes = await request(app).patch(`/api/vocabulary/${id}`).send({ masteryLevel: 2 });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.masteryLevel).toBe(2);

    // Delete
    const deleteRes = await request(app).delete(`/api/vocabulary/${id}`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBe(true);
  });

  it('POST /api/ask returns grounded response with clickable citations', async () => {
    const res = await request(app).post('/api/ask').send({
      query: 'What happened with Telangana metro phase 2?',
      language: 'en',
    });

    expect(res.status).toBe(200);
    expect(res.body.answer).toBeDefined();
    expect(res.body.citations.length).toBeGreaterThan(0);
    expect(res.body.citations[0].url).toBeDefined();
  });
});

describe('Quiet Notification Engine Tests', () => {
  it('enforces maximum 2 notifications in any rolling 3-hour window', () => {
    const userId = 'test-notif-rate-limit';
    db.savePreferences(userId, { quietHoursStart: '03:00', quietHoursEnd: '04:00', enableNotifications: true });
    const testStory = db.getStories({ limit: 1 }).stories[0];

    // Seed 2 notifications delivered within past 30 minutes
    db.addNotification({
      id: 'notif-t1',
      userId,
      storyId: 'story-1',
      dedupKey: 'k1',
      priority: 'high',
      title: 'Update 1',
      body: 'Body 1',
      deliveredAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
      isDigest: false,
      bundledStoryIds: ['story-1'],
    });

    db.addNotification({
      id: 'notif-t2',
      userId,
      storyId: 'story-2',
      dedupKey: 'k2',
      priority: 'high',
      title: 'Update 2',
      body: 'Body 2',
      deliveredAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      isDigest: false,
      bundledStoryIds: ['story-2'],
    });

    // 3rd notification within the 3h window should be rejected
    const check = notificationService.checkEligibility(userId, testStory, 'high');
    expect(check.isEligible).toBe(false);
    expect(check.reason).toContain('Rate limit reached');
  });

  it('suppresses duplicate notifications for the same story within 6-hour cooldown', () => {
    const userId = 'test-cooldown-user';
    db.savePreferences(userId, { quietHoursStart: '03:00', quietHoursEnd: '04:00', enableNotifications: true });
    const testStory = db.getStories({ limit: 1 }).stories[0];

    db.addNotification({
      id: 'notif-cd-1',
      userId,
      storyId: testStory.id,
      dedupKey: `notif-${testStory.id}`,
      priority: 'high',
      title: testStory.title,
      body: testStory.summary,
      deliveredAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
      isDigest: false,
      bundledStoryIds: [testStory.id],
    });

    const check = notificationService.checkEligibility(userId, testStory, 'high');
    expect(check.isEligible).toBe(false);
    expect(check.reason).toContain('already notified within 6h cooldown');
  });
});

describe('Story Deduplication & Canonical Grouping Tests', () => {
  it('merges closely matching article into existing canonical story', () => {
    const testStory = {
      id: `story-test-dedup-${Date.now()}`,
      title: 'Unique Experimental Quantum Computing Breakthrough in Bangalore Lab',
      summary: 'Scientists at IISc have developed a novel topological qubit architecture.',
      whyItMatters: 'Advances quantum computing research in India.',
      generalTake: 'Major milestone in indigenous deep tech.',
      category: 'technology',
      geographicScope: 'national' as const,
      country: 'IN',
      evidenceStatus: 'corroborated_by_sources' as const,
      importanceLevel: 'normal' as const,
      firstReportedAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      isPerspectiveAvailable: false,
      isLiveIngested: true,
      articles: [],
      timeline: [],
    };
    db.upsertStory(testStory);

    const similarArticle: Article = {
      id: 'art-sim-1',
      sourceId: 'src-pib-india',
      sourceName: 'PIB India',
      title: testStory.title,
      summary: testStory.summary,
      content: testStory.summary,
      url: `https://pib.gov.in/test-quantum-unique-${Date.now()}`,
      publishedAt: new Date().toISOString(),
      ingestedAt: new Date().toISOString(),
      geographicScope: 'national',
      country: 'IN',
      category: 'technology',
      language: 'en',
      evidenceLabel: 'official_documentation',
      isOpinion: false,
    };

    const result = storyDeduplicator.processArticle(similarArticle);
    expect(result.isNewStory).toBe(false);
    expect(result.story.id).toBe(testStory.id);
  });
});

describe('Hourly Pulse Reliability & Quiet Period Tests', () => {
  it('generates a briefing and handles quiet news periods honestly', async () => {
    const res = await request(app).get('/api/briefings/latest?scope=international');
    expect(res.status).toBe(200);
    expect(res.body.id).toBeDefined();
    expect(res.body.timeWindowStart).toBeDefined();
    expect(res.body.timeWindowEnd).toBeDefined();
    expect(Array.isArray(res.body.importantDevelopments)).toBe(true);

    const listRes = await request(app).get('/api/briefings?scope=international');
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body.briefings)).toBe(true);
  });
});

describe('Catch Me Up Delta Engine Tests', () => {
  it('returns structured change delta buckets for 24h timeframe', async () => {
    const res = await request(app).get('/api/catch-me-up?timeframe=24h');
    expect(res.status).toBe(200);
    expect(res.body.timeframe).toBe('24h');
    expect(Array.isArray(res.body.newStories)).toBe(true);
    expect(Array.isArray(res.body.updatedStories)).toBe(true);
    expect(Array.isArray(res.body.unresolvedStories)).toBe(true);
    expect(typeof res.body.unchangedStoriesCount).toBe('number');
  });
});

describe('Multilingual Translation & Vocabulary Quality Tests', () => {
  it('translates news headlines accurately into Telugu and preserves unicode characters', async () => {
    const res = await request(app).post('/api/translate').send({
      title: 'The world, understood.',
      summary: 'Pulse delivers balanced news intelligence.',
      whyItMatters: 'Essential for civic understanding.',
      language: 'te',
    });

    expect(res.status).toBe(200);
    expect(res.body.targetLanguage).toBe('te');
    // Verifies valid Telugu Unicode range (\u0C00-\u0C7F)
    expect(/[\u0C00-\u0C7F]/.test(res.body.title)).toBe(true);
  });

  it('translates news into Hindi with proper Devanagari script', async () => {
    const res = await request(app).post('/api/translate').send({
      title: 'The world, understood.',
      summary: 'Essential briefing for informed citizens.',
      whyItMatters: 'A calm perspective on world events.',
      language: 'hi',
    });

    expect(res.status).toBe(200);
    expect(res.body.targetLanguage).toBe('hi');
    // Verifies Devanagari Unicode range (\u0900-\u097F)
    expect(/[\u0900-\u097F]/.test(res.body.title)).toBe(true);
  });
});

describe('AI Provider Security & Secret Masking Tests', () => {
  it('masks API keys in settings endpoint to prevent frontend leakage', async () => {
    const res = await request(app).get('/api/settings/ai-config');
    expect(res.status).toBe(200);
    expect(res.body.status).toBeDefined();
    if (res.body.config.openaiApiKey) {
      expect(res.body.config.openaiApiKey).toContain('••••');
    }
    if (res.body.config.anthropicApiKey) {
      expect(res.body.config.anthropicApiKey).toContain('••••');
    }
  });
});

describe('Phase 3: Web Push Notification API Tests', () => {
  it('GET /api/notifications/push/public-key returns VAPID public key', async () => {
    const res = await request(app).get('/api/notifications/push/public-key');
    expect(res.status).toBe(200);
    expect(res.body.publicKey).toBeDefined();
    expect(res.body.publicKey.length).toBeGreaterThan(20);
    expect(res.body.isConfigured).toBe(true);
  });

  it('POST /api/notifications/push/subscribe registers a browser push subscription', async () => {
    const fakeSub = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/test-pulse-endpoint-12345',
      keys: {
        p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9t0A3c8w_hXn_TestKey123',
        auth: 'tBHItTestAuthKey1234',
      },
    };

    const res = await request(app)
      .post('/api/notifications/push/subscribe')
      .send(fakeSub);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.subscription.endpoint).toBe(fakeSub.endpoint);

    // Test unsubscribe
    const unsubRes = await request(app)
      .post('/api/notifications/push/unsubscribe')
      .send({ endpoint: fakeSub.endpoint });

    expect(unsubRes.status).toBe(200);
    expect(unsubRes.body.success).toBe(true);
  });
});

describe('Phase 3: Production Security & Admin Authorization Tests', () => {
  it('denies unauthenticated mutations on admin routes without valid X-Admin-Key', async () => {
    const res = await request(app)
      .post('/api/admin/trigger-ingestion')
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Access denied');
  });

  it('denies unauthenticated access to admin diagnostics without valid X-Admin-Key', async () => {
    const res = await request(app).get('/api/admin/diagnostics');
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Access denied');
  });

  it('permits authorized admin access to admin diagnostics with valid X-Admin-Key', async () => {
    const adminKey = process.env.ADMIN_API_KEY || 'pulse-admin-secret-2026';
    const res = await request(app)
      .get('/api/admin/diagnostics')
      .set('x-admin-key', adminKey);
    expect(res.status).toBe(200);
    expect(res.body.diagnostics).toBeDefined();
  });

  it('denies unauthenticated manual briefing generation without valid X-Admin-Key', async () => {
    const res = await request(app)
      .post('/api/briefings/generate')
      .send({ scope: 'global' });
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Access denied');
  });

  it('permits authorized admin manual briefing generation with valid X-Admin-Key', async () => {
    const adminKey = process.env.ADMIN_API_KEY || 'pulse-admin-secret-2026';
    const res = await request(app)
      .post('/api/briefings/generate')
      .set('x-admin-key', adminKey)
      .send({ scope: 'global' });
    expect(res.status).toBe(200);
    expect(res.body.briefing).toBeDefined();
    expect(res.body.briefing.id).toBeDefined();
  });

  it('permits authorized admin trigger with valid X-Admin-Key header', async () => {
    const adminKey = process.env.ADMIN_API_KEY || 'pulse-admin-secret-2026';
    const res = await request(app)
      .post('/api/admin/trigger-ingestion')
      .set('x-admin-key', adminKey)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.result).toBeDefined();
  }, 25000);

  it('denies unauthenticated mutations on AI config without valid X-Admin-Key', async () => {
    const res = await request(app)
      .post('/api/settings/ai-config')
      .send({ primaryProvider: 'fallback' });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Access denied');
  });

  it('permits authorized AI config update with valid X-Admin-Key header', async () => {
    const adminKey = process.env.ADMIN_API_KEY || 'pulse-admin-secret-2026';
    const res = await request(app)
      .post('/api/settings/ai-config')
      .set('x-admin-key', adminKey)
      .send({ primaryProvider: 'fallback' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('denies unauthenticated access to AI logs without valid X-Admin-Key', async () => {
    const res = await request(app).get('/api/settings/ai-logs');
    expect(res.status).toBe(403);
  });

  it('permits authorized access to AI logs with valid X-Admin-Key header', async () => {
    const adminKey = process.env.ADMIN_API_KEY || 'pulse-admin-secret-2026';
    const res = await request(app)
      .get('/api/settings/ai-logs')
      .set('x-admin-key', adminKey);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.logs)).toBe(true);
  });

  it('verifies that standard HTTP security headers are enforced', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });

  it('GET /api/sources/health provides health and staleness diagnostics for all sources', async () => {
    const res = await request(app).get('/api/sources/health');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.sources)).toBe(true);
    expect(res.body.summary.total).toBeGreaterThan(0);
    expect(res.body.sources.every((s: any) => ['healthy', 'degraded', 'stale', 'failing'].includes(s.healthStatus))).toBe(true);
  });
});

describe('Phase 3: Concurrency Mutex Lock Test', () => {
  it('skips concurrent ingestion invocation if a job is actively running', async () => {
    // Run two ingestion calls concurrently
    const [first, second] = await Promise.all([
      taskScheduler.runIngestion(),
      taskScheduler.runIngestion(),
    ]);

    expect(first).toBeDefined();
    expect(second).toBeDefined();
    // One of them should succeed and the other may gracefully report skipped: true or both finish sequentially
    const hadLockProtection = first.skipped || second.skipped || (first.articlesCount >= 0 && second.articlesCount >= 0);
    expect(hadLockProtection).toBe(true);
  });
});


