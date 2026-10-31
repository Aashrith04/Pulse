import { Router } from 'express';
import { z } from 'zod';
import { getRepository, getStorageMode } from '../db/repositoryFactory.js';
import { db } from '../db/database.js';
import { aiOrchestrator } from '../ai/orchestrator.js';
import { hourlyPulseService } from '../services/hourlyPulseService.js';
import { notificationService } from '../services/notificationService.js';
import { pushNotificationService } from '../services/pushNotificationService.js';
import { taskScheduler } from '../ingestion/scheduler.js';
import { INDIAN_STATES_AND_UTS } from '../db/seedData.js';
import { 
  requireAdmin, 
  requireAuth, 
  isSupabaseConfigured,
  getSupabaseClient,
  getSupabaseAdminClient
} from '../db/supabaseClient.js';

const router = Router();

// ==========================================
// 1. HEALTH & INTEGRATION STATUS
// ==========================================
router.get('/health', async (req, res) => {
  try {
    const repo = getRepository();
    const mode = getStorageMode();
    const pingOk = await repo.ping();
    const diag = await repo.getDiagnostics();
    const aiStatus = aiOrchestrator.getActiveStatus();
    const schedulerStatus = taskScheduler.getStatus();

    res.json({
      status: pingOk ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      storageMode: mode,
      cloudConnected: mode === 'cloud' ? pingOk : false,
      diagnostics: diag,
      aiIntegrations: aiStatus,
      scheduler: schedulerStatus,
      supportedStates: INDIAN_STATES_AND_UTS,
    });
  } catch (err: any) {
    console.error('[API] /health error:', err.message);
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      storageMode: getStorageMode(),
      error: err.message || 'Health check failed',
    });
  }
});

// ==========================================
// 1B. AUTHENTICATION & USER SESSIONS
// ==========================================
const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  fullName: z.string().min(1).optional(),
  state: z.string().optional(),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
});

router.post('/auth/register', async (req, res) => {
  try {
    const parseResult = RegisterSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.issues[0]?.message || 'Invalid registration payload' });
    }
    const { email, password, fullName, state } = parseResult.data;

    const admin = getSupabaseAdminClient();
    const anon = getSupabaseClient();
    if (!admin || !anon) {
      return res.status(503).json({ error: 'Supabase authentication is not configured on the server.' });
    }

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName || email.split('@')[0],
        state: state || 'Telangana',
      },
    });

    if (createErr || !created.user) {
      return res.status(400).json({ error: createErr?.message || 'Failed to create user account' });
    }

    // Automatically sign in to return live JWT
    const { data: signInData, error: signInErr } = await anon.auth.signInWithPassword({
      email,
      password,
    });

    if (signInErr || !signInData.session) {
      return res.status(201).json({
        user: {
          id: created.user.id,
          email: created.user.email,
          fullName: created.user.user_metadata?.full_name,
          state: created.user.user_metadata?.state,
        },
        message: 'Account created successfully. Please sign in.',
      });
    }

    res.status(201).json({
      user: {
        id: signInData.user.id,
        email: signInData.user.email,
        fullName: signInData.user.user_metadata?.full_name,
        state: signInData.user.user_metadata?.state,
      },
      session: {
        access_token: signInData.session.access_token,
        refresh_token: signInData.session.refresh_token,
        expires_at: signInData.session.expires_at,
      },
    });
  } catch (err: any) {
    console.error('[API] /auth/register error:', err.message);
    res.status(500).json({ error: 'Registration error', details: err.message });
  }
});

router.post('/auth/login', async (req, res) => {
  try {
    const parseResult = LoginSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.issues[0]?.message || 'Invalid login payload' });
    }
    const { email, password } = parseResult.data;

    const anon = getSupabaseClient();
    if (!anon) {
      return res.status(503).json({ error: 'Supabase authentication is not configured on the server.' });
    }

    const { data, error } = await anon.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      return res.status(401).json({ error: error?.message || 'Invalid email or password' });
    }

    res.json({
      user: {
        id: data.user.id,
        email: data.user.email,
        fullName: data.user.user_metadata?.full_name,
        state: data.user.user_metadata?.state,
      },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
      },
    });
  } catch (err: any) {
    console.error('[API] /auth/login error:', err.message);
    res.status(500).json({ error: 'Login error', details: err.message });
  }
});

router.post('/auth/logout', async (req, res) => {
  res.json({ success: true, message: 'Logged out successfully' });
});

router.get('/auth/me', async (req, res) => {
  if (req.user && !req.user.isGuest) {
    return res.json({
      authenticated: true,
      user: {
        id: req.user.id,
        email: req.user.email,
        isAdmin: req.user.isAdmin,
      },
    });
  }
  res.json({ authenticated: false, user: null });
});

// ==========================================
// 2. CANONICAL STORIES & NEWS FEEDS
// ==========================================
router.get('/stories', async (req, res) => {
  try {
    const repo = getRepository();
    const { scope, state, category, search, importance, limit, offset } = req.query;

    const result = await repo.getStories({
      scope: scope as string,
      state: state as string,
      category: category as string,
      search: search as string,
      importance: importance as string,
      limit: limit ? parseInt(limit as string, 10) : 20,
      offset: offset ? parseInt(offset as string, 10) : 0,
    });

    res.json({
      stories: result.stories,
      total: result.total,
      returned: result.stories.length,
    });
  } catch (err: any) {
    console.error('[API] /stories error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve stories', details: err.message });
  }
});

router.get('/stories/:id', async (req, res) => {
  try {
    const repo = getRepository();
    const story = await repo.getStoryById(req.params.id);
    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }
    res.json(story);
  } catch (err: any) {
    console.error('[API] /stories/:id error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve story', details: err.message });
  }
});

// Catch Me Up endpoint: Summarizes changes over specific timeframes
router.get('/catch-me-up', async (req, res) => {
  try {
    const repo = getRepository();
    const { timeframe = '24h', state } = req.query;
    const hoursMap: Record<string, number> = {
      '3h': 3,
      '6h': 6,
      '12h': 12,
      '24h': 24,
      '7d': 168,
    };
    const hours = hoursMap[timeframe as string] || 24;
    const cutoff = new Date(Date.now() - hours * 3600 * 1000).getTime();

    const { stories: all } = await repo.getStories({ state: state as string, limit: 50 });

    const newStories = all.filter(s => new Date(s.firstReportedAt).getTime() >= cutoff);
    const updatedStories = all.filter(s => 
      new Date(s.firstReportedAt).getTime() < cutoff && 
      new Date(s.lastUpdatedAt).getTime() >= cutoff
    );
    const unresolvedStories = all.filter(s => 
      s.evidenceStatus === 'developing_unverified' || s.evidenceStatus === 'conflicting_reports'
    );
    const unchangedStories = all.filter(s => 
      new Date(s.lastUpdatedAt).getTime() < cutoff && 
      !unresolvedStories.some(u => u.id === s.id)
    );

    let executiveSynthesis = `In the last ${timeframe}, ${newStories.length} new stories emerged and ${updatedStories.length} received verifiable updates.`;
    let keyDeltas: string[] = [];
    let watchItems: string[] = [];

    try {
      const synthesis = await aiOrchestrator.generateCatchMeUpSynthesis(
        timeframe as string,
        newStories.length,
        updatedStories.length,
        unresolvedStories.length
      );
      executiveSynthesis = synthesis.executiveSynthesis;
      keyDeltas = synthesis.keyDeltas;
      watchItems = synthesis.watchItems;
    } catch (e: any) {
      console.warn('[API] Catch Me Up AI synthesis error, using fallback:', e.message);
    }

    res.json({
      timeframe,
      windowStart: new Date(cutoff).toISOString(),
      summary: executiveSynthesis,
      executiveSynthesis,
      keyDeltas,
      watchItems,
      newStories,
      updatedStories,
      unresolvedStories,
      unchangedStoriesCount: unchangedStories.length,
    });
  } catch (err: any) {
    console.error('[API] /catch-me-up error:', err.message);
    res.status(500).json({ error: 'Failed to compute Catch Me Up', details: err.message });
  }
});

router.get('/stories/:id/audit', async (req, res) => {
  try {
    const repo = getRepository();
    const story = await repo.getStoryById(req.params.id);
    if (!story) {
      return res.status(404).json({ error: 'Story not found for evidence audit' });
    }
    const audit = await aiOrchestrator.auditEvidenceAndUncertainty(story);
    res.json(audit);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to audit evidence and uncertainty', details: err.message });
  }
});

router.get('/stories/:id/evolution', async (req, res) => {
  try {
    const repo = getRepository();
    const story = await repo.getStoryById(req.params.id);
    if (!story) {
      return res.status(404).json({ error: 'Story not found for evolution analysis' });
    }
    const latestArticleContent = story.articles[0]?.content || story.articles[0]?.summary || story.summary;
    const evolution = await aiOrchestrator.detectStoryEvolution(story, latestArticleContent);
    res.json(evolution);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to analyze story evolution', details: err.message });
  }
});

// ==========================================
// 3. HOURLY PULSE BRIEFINGS
// ==========================================
router.get('/briefings', async (req, res) => {
  try {
    const repo = getRepository();
    const { scope, state } = req.query;
    const briefings = await repo.getBriefings(scope as string, state as string);
    res.json({ briefings });
  } catch (err: any) {
    console.error('[API] /briefings error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve briefings', details: err.message });
  }
});

router.get('/briefings/latest', async (req, res) => {
  try {
    const repo = getRepository();
    const { scope = 'global' } = req.query;
    const latest = await repo.getLatestBriefing(scope as string);
    if (!latest) {
      // Generate fresh if none exist
      const generated = hourlyPulseService.generateBriefing({ scope: scope as any });
      await repo.addBriefing(generated.briefing);
      return res.json(generated.briefing);
    }
    res.json(latest);
  } catch (err: any) {
    console.error('[API] /briefings/latest error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve latest briefing', details: err.message });
  }
});

router.post('/briefings/generate', requireAdmin, async (req, res) => {
  try {
    const repo = getRepository();
    const { scope = 'global', state } = req.body;
    const result = hourlyPulseService.generateBriefing({ scope, state, force: true });
    await repo.addBriefing(result.briefing);
    res.json(result);
  } catch (err: any) {
    console.error('[API] /briefings/generate error:', err.message);
    res.status(500).json({ error: 'Failed to generate briefing', details: err.message });
  }
});

// ==========================================
// 4. PERSPECTIVE DESK
// ==========================================
router.get('/perspectives/:storyId', async (req, res) => {
  try {
    const repo = getRepository();
    const existing = await repo.getPerspective(req.params.storyId);
    if (existing) {
      return res.json(existing);
    }

    const story = await repo.getStoryById(req.params.storyId);
    if (!story) {
      return res.status(404).json({ error: 'Story not found for perspective analysis' });
    }

    const perspective = await aiOrchestrator.getPerspective(story);
    await repo.savePerspective(perspective);
    res.json(perspective);
  } catch (err: any) {
    console.error('[API] /perspectives/:storyId error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve perspective analysis', details: err.message });
  }
});

// ==========================================
// 5. TAP-TO-UNDERSTAND (CONTEXTUAL DICTIONARY)
// ==========================================
const DictionarySchema = z.object({
  word: z.string().min(1),
  sentence: z.string().min(1),
  language: z.string().default('en'),
});

router.post('/dictionary/context', async (req, res) => {
  const parseResult = DictionarySchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid word or sentence payload', details: parseResult.error });
  }

  const { word, sentence, language } = parseResult.data;
  const definition = await aiOrchestrator.getContextualDefinition(word, sentence, language as any);
  res.json(definition);
});

// ==========================================
// 6. MULTILINGUAL TRANSLATION
// ==========================================
const TranslationSchema = z.object({
  title: z.string(),
  summary: z.string(),
  whyItMatters: z.string().optional().default(''),
  targetLanguage: z.string().optional(),
  language: z.string().optional(),
});

router.post('/translate', async (req, res) => {
  const parseResult = TranslationSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid translation payload' });
  }

  const { title, summary, whyItMatters, targetLanguage, language } = parseResult.data;
  const lang = (targetLanguage || language || 'en') as any;
  const translation = await aiOrchestrator.translateNews(title, summary, whyItMatters, lang);
  res.json(translation);
});

// ==========================================
// 7. ASK THE NEWS (GROUNDED CONVERSATIONAL ASSISTANT)
// ==========================================
const AskSchema = z.object({
  query: z.string().min(2),
  language: z.string().default('en'),
  detailMode: z.enum(['concise', 'deep']).default('concise'),
  conversationId: z.string().optional(),
});

router.post('/ask', async (req, res) => {
  const parseResult = AskSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid question query' });
  }

  const { query, language, detailMode } = parseResult.data;
  const response = await aiOrchestrator.askNews(query, language as any, detailMode);
  res.json(response);
});

// ==========================================
// 8. ASK CONVERSATIONS (PERSISTENCE)
// ==========================================
router.get('/conversations/:id', async (req, res) => {
  try {
    const repo = getRepository();
    const userId = req.user?.id;
    const conversation = await repo.getConversation(req.params.id, userId, req.user?.token);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    res.json(conversation);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve conversation', details: err.message });
  }
});

router.post('/conversations', requireAuth, async (req, res) => {
  try {
    const repo = getRepository();
    const userId = req.user?.id || req.body.userId || 'guest-session-default';
    const { id, title, language = 'en', messages } = req.body;
    if (!id || !title || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'id, title, and messages array are required' });
    }
    const saved = await repo.saveConversation(id, userId, title, language, messages, req.user?.token);
    res.json(saved);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to save conversation', details: err.message });
  }
});

// ==========================================
// 9. PERSONAL VOCABULARY & PRACTICE
// ==========================================
router.get('/vocabulary', async (req, res) => {
  try {
    const repo = getRepository();
    const targetUserId = (req.query.userId as string) || req.user?.id || 'guest-session-default';
    const { search, mastery } = req.query;
    const list = await repo.getVocabulary(targetUserId, {
      search: search as string,
      mastery: mastery !== undefined ? parseInt(mastery as string, 10) : undefined,
    }, req.user?.token);
    res.json({ vocabulary: list, count: list.length });
  } catch (err: any) {
    console.error('[API] /vocabulary error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve vocabulary', details: err.message });
  }
});

router.post('/vocabulary', requireAuth, async (req, res) => {
  try {
    const repo = getRepository();
    const targetUserId = req.body.userId || req.user?.id || 'guest-session-default';
    const { 
      storyId,
      storyTitle,
      word, 
      sourceSentence, 
      originalLanguage = 'en', 
      targetLanguage = 'en',
      contextualMeaning,
      originalDefinition,
      pronunciation,
      partOfSpeech,
      exampleSentence,
      synonyms = [],
      personalNotes 
    } = req.body;

    if (!word || !sourceSentence || !contextualMeaning) {
      return res.status(400).json({ error: 'Word, sourceSentence, and contextualMeaning are required' });
    }

    const entry = await repo.addVocabulary({
      id: `vocab-${Date.now()}-${word.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
      userId: targetUserId,
      storyId,
      storyTitle,
      word,
      sourceSentence,
      originalLanguage,
      targetLanguage,
      contextualMeaning,
      originalDefinition: originalDefinition || contextualMeaning,
      pronunciation,
      partOfSpeech,
      exampleSentence,
      synonyms,
      personalNotes,
      masteryLevel: 0,
      nextReviewDue: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    }, req.user?.token);

    res.status(201).json(entry);
  } catch (err: any) {
    console.error('[API] POST /vocabulary error:', err.message);
    res.status(500).json({ error: 'Failed to add vocabulary entry', details: err.message });
  }
});

router.patch('/vocabulary/:id', requireAuth, async (req, res) => {
  try {
    const repo = getRepository();
    const userId = req.user?.id;
    const updated = await repo.updateVocabulary(req.params.id, req.body, userId, req.user?.token);
    if (!updated) {
      return res.status(404).json({ error: 'Vocabulary entry not found' });
    }
    res.json(updated);
  } catch (err: any) {
    console.error('[API] PATCH /vocabulary/:id error:', err.message);
    res.status(500).json({ error: 'Failed to update vocabulary entry', details: err.message });
  }
});

router.delete('/vocabulary/:id', requireAuth, async (req, res) => {
  try {
    const repo = getRepository();
    const userId = req.user?.id;
    const deleted = await repo.deleteVocabulary(req.params.id, userId, req.user?.token);
    if (!deleted) {
      return res.status(404).json({ error: 'Vocabulary entry not found' });
    }
    res.json({ success: true, message: 'Word removed from vocabulary' });
  } catch (err: any) {
    console.error('[API] DELETE /vocabulary/:id error:', err.message);
    res.status(500).json({ error: 'Failed to delete vocabulary entry', details: err.message });
  }
});

// Vocabulary Reviews
router.post('/vocabulary/:id/reviews', requireAuth, async (req, res) => {
  try {
    const repo = getRepository();
    const userId = req.user?.id || req.body.userId || 'guest-session-default';
    const { recallQuality, reviewMode } = req.body;
    if (recallQuality === undefined) {
      return res.status(400).json({ error: 'recallQuality is required (0-5)' });
    }
    const review = await repo.addVocabularyReview({
      vocabularyId: req.params.id,
      userId,
      recalledSuccessfully: Number(recallQuality) >= 3,
      recallQuality: Number(recallQuality),
      reviewMode: reviewMode || 'flashcard',
      reviewedAt: new Date().toISOString(),
    }, req.user?.token);
    res.status(201).json(review);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to record vocabulary review', details: err.message });
  }
});

router.get('/vocabulary/:id/reviews', async (req, res) => {
  try {
    const repo = getRepository();
    const reviews = await repo.getVocabularyReviews(req.params.id, req.user?.token);
    res.json({ reviews, count: reviews.length });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve reviews', details: err.message });
  }
});

// ==========================================
// 10. SAVED STORIES
// ==========================================
router.get('/saved-stories', requireAuth, async (req, res) => {
  try {
    const repo = getRepository();
    const userId = req.user?.id || (req.query.userId as string) || 'guest-session-default';
    const records = await repo.getSavedStories(userId, req.user?.token);
    res.json({ savedStories: records, count: records.length });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve saved stories', details: err.message });
  }
});

router.post('/saved-stories', requireAuth, async (req, res) => {
  try {
    const repo = getRepository();
    const userId = req.user?.id || req.body.userId || 'guest-session-default';
    const { storyId, personalNotes } = req.body;
    if (!storyId) {
      return res.status(400).json({ error: 'storyId is required' });
    }
    const record = await repo.saveStory(userId, storyId, personalNotes, req.user?.token);
    res.status(201).json(record);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to save story', details: err.message });
  }
});

router.delete('/saved-stories/:storyId', requireAuth, async (req, res) => {
  try {
    const repo = getRepository();
    const userId = req.user?.id || (req.query.userId as string) || 'guest-session-default';
    const ok = await repo.removeSavedStory(userId, req.params.storyId, req.user?.token);
    res.json({ success: ok });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to remove saved story', details: err.message });
  }
});

// ==========================================
// 11. READING HISTORY
// ==========================================
router.post('/history/read', requireAuth, async (req, res) => {
  try {
    const repo = getRepository();
    const userId = req.user?.id || req.body.userId || 'guest-session-default';
    const { storyId, timeSpentSeconds = 0 } = req.body;
    if (!storyId) {
      return res.status(400).json({ error: 'storyId is required' });
    }
    const record = await repo.recordReading(userId, storyId, timeSpentSeconds, req.user?.token);
    res.status(201).json(record);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to record reading history', details: err.message });
  }
});

router.get('/history', requireAuth, async (req, res) => {
  try {
    const repo = getRepository();
    const userId = req.user?.id || (req.query.userId as string) || 'guest-session-default';
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const history = await repo.getReadingHistory(userId, limit, req.user?.token);
    res.json({ history, count: history.length });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve reading history', details: err.message });
  }
});

// ==========================================
// 12. USER PROFILES
// ==========================================
router.get('/users/profile', requireAuth, async (req, res) => {
  try {
    const repo = getRepository();
    const userId = req.user?.id || (req.query.userId as string) || 'guest-session-default';
    const profile = await repo.getUserProfile(userId, req.user?.token);
    if (!profile) {
      return res.status(404).json({ error: 'User profile not found' });
    }
    res.json(profile);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve user profile', details: err.message });
  }
});

router.patch('/users/profile', requireAuth, async (req, res) => {
  try {
    const repo = getRepository();
    const userId = req.user?.id || (req.body?.userId as string) || 'guest-session-default';
    // Strip security-sensitive fields
    const { isAdmin, is_admin, role, id, ...allowedUpdates } = req.body;
    const updated = await repo.updateUserProfile(userId, allowedUpdates, req.user?.token);
    if (!updated) {
      return res.status(404).json({ error: 'User profile not found or update failed' });
    }
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update user profile', details: err.message });
  }
});

// ==========================================
// 13. QUIET NOTIFICATIONS & WEB PUSH
// ==========================================
router.get('/notifications', async (req, res) => {
  try {
    const repo = getRepository();
    const userId = req.user?.id || (req.query.userId as string) || 'guest-user-default';
    const list = await repo.getNotifications(userId, req.user?.token);
    const unreadCount = list.filter(n => !n.readAt).length;
    res.json({ notifications: list, unreadCount });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve notifications', details: err.message });
  }
});

router.post('/notifications/:id/read', async (req, res) => {
  try {
    const repo = getRepository();
    const userId = req.user?.id;
    const ok = await repo.markNotificationRead(req.params.id, userId, req.user?.token);
    res.json({ success: ok });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to mark notification read', details: err.message });
  }
});

router.post('/notifications/read-all', async (req, res) => {
  try {
    const repo = getRepository();
    const userId = req.user?.id || req.body?.userId || 'guest-user-default';
    await repo.markAllNotificationsRead(userId, req.user?.token);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to mark all notifications read', details: err.message });
  }
});

// Web Push VAPID Public Key
router.get('/notifications/push/public-key', (req, res) => {
  res.json({
    publicKey: pushNotificationService.getPublicKey(),
    isConfigured: pushNotificationService.isConfigured(),
  });
});

// Subscribe to Web Push
const PushSubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

router.post('/notifications/push/subscribe', async (req, res) => {
  const parseResult = PushSubscribeSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid push subscription payload', details: parseResult.error });
  }

  const userId = req.user?.id || req.body.userId || 'guest-user-default';
  const record = await pushNotificationService.subscribe(userId, parseResult.data, req.user?.token);
  res.status(201).json({ success: true, subscription: record });
});

// Unsubscribe from Web Push
router.post('/notifications/push/unsubscribe', async (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) {
    return res.status(400).json({ error: 'Endpoint is required to unsubscribe' });
  }

  const ok = await pushNotificationService.unsubscribe(endpoint, req.user?.token);
  res.json({ success: ok });
});

// Send a test push notification to verify browser receipt
router.post('/notifications/push/test', async (req, res) => {
  const userId = req.user?.id || req.body.userId || 'guest-user-default';
  const result = await pushNotificationService.sendToUser(userId, {
    title: 'Pulse — Test Notification',
    body: 'Browser push notifications are active with quiet interval protection.',
    priority: 'normal',
    tag: 'pulse-test',
  });

  res.json({
    success: true,
    deliveredDevices: result.delivered,
    failedDevices: result.failed,
  });
});

// ==========================================
// 14. PREFERENCES & SETTINGS
// ==========================================
router.get('/preferences', async (req, res) => {
  try {
    const repo = getRepository();
    const targetUserId = (req.query.userId as string) || req.user?.id || 'guest-session-default';
    const prefs = await repo.getPreferences(targetUserId, req.user?.token);
    res.json(prefs);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve preferences', details: err.message });
  }
});

router.post('/preferences', requireAuth, async (req, res) => {
  try {
    const repo = getRepository();
    const targetUserId = req.body.userId || req.user?.id || 'guest-session-default';
    const { userId, ...updates } = req.body;
    const saved = await repo.savePreferences(targetUserId, updates, req.user?.token);
    res.json(saved);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to save preferences', details: err.message });
  }
});

// Settings & Runtime API Configuration
router.get('/settings/ai-config', (req, res) => {
  res.json({
    config: aiOrchestrator.getConfig(),
    status: aiOrchestrator.getActiveStatus(),
  });
});

router.post('/settings/ai-config', requireAdmin, (req, res) => {
  const { primaryProvider, openaiApiKey, anthropicApiKey, xaiApiKey } = req.body;
  aiOrchestrator.updateConfig({
    ...(primaryProvider && { primaryProvider }),
    ...(openaiApiKey && { openaiApiKey }),
    ...(anthropicApiKey && { anthropicApiKey }),
    ...(xaiApiKey && { xaiApiKey }),
  });
  res.json({
    success: true,
    config: aiOrchestrator.getConfig(),
    status: aiOrchestrator.getActiveStatus(),
  });
});

router.get('/settings/ai-metrics', (req, res) => {
  res.json(aiOrchestrator.getMetrics());
});

router.get('/settings/ai-logs', requireAdmin, (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
  res.json({ logs: aiOrchestrator.getRecentLogs(limit) });
});

// ==========================================
// 15. ADMIN DASHBOARD & SOURCES
// ==========================================
router.get('/sources', async (req, res) => {
  try {
    const repo = getRepository();
    const sources = await repo.getSources();
    res.json(sources);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve sources', details: err.message });
  }
});

router.get('/sources/health', async (req, res) => {
  try {
    const repo = getRepository();
    const sources = await repo.getSources();
    const healthReport = sources.map(s => ({
      id: s.id,
      name: s.name,
      healthStatus: s.healthStatus || 'healthy',
      lastFetchedAt: s.lastFetchedAt,
      consecutiveErrors: s.consecutiveErrors || 0,
      lastErrorMessage: s.lastError,
    }));

    res.json({
      sources: healthReport,
      summary: {
        total: sources.length,
        active: sources.filter(s => s.isEnabled).length,
        stale: healthReport.filter(s => s.healthStatus === 'stale').length,
        failing: healthReport.filter(s => s.healthStatus === 'failing').length,
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve source health', details: err.message });
  }
});

router.patch('/sources/:id', requireAdmin, async (req, res) => {
  try {
    const repo = getRepository();
    const updated = await repo.updateSource(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Source not found' });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update source', details: err.message });
  }
});

router.get('/admin/diagnostics', requireAdmin, async (req, res) => {
  try {
    const repo = getRepository();
    const diag = await repo.getDiagnostics();
    const sources = await repo.getSources();
    const logs = await repo.getIngestionLogs(20);
    const aiLogs = await repo.getAILogs(20);

    res.json({
      storageMode: getStorageMode(),
      diagnostics: diag,
      sourceHealth: sources.map(s => ({
        id: s.id,
        name: s.name,
        healthStatus: s.healthStatus || 'healthy',
        lastFetchedAt: s.lastFetchedAt,
        consecutiveErrors: s.consecutiveErrors || 0,
      })),
      ingestionLogs: logs,
      aiLogs: aiLogs,
      scheduler: taskScheduler.getStatus(),
      aiStatus: aiOrchestrator.getActiveStatus(),
      supabaseConfigured: isSupabaseConfigured(),
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to load admin diagnostics', details: err.message });
  }
});

router.post('/admin/trigger-ingestion', requireAdmin, async (req, res) => {
  const result = await taskScheduler.runIngestion();
  res.json({ success: true, result });
});

router.post('/admin/trigger-briefing', requireAdmin, (req, res) => {
  const { scope = 'global' } = req.body;
  const result = taskScheduler.runBriefing(scope);
  res.json({ success: true, result });
});

router.post('/admin/trigger-notifications', requireAdmin, (req, res) => {
  const notif = notificationService.evaluatePendingDevelopments();
  res.json({ success: true, dispatchedNotification: notif });
});

export default router;
