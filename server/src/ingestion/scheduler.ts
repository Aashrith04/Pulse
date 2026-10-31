import cron from 'node-cron';
import { rssAdapter } from './rssAdapter.js';
import { storyDeduplicator } from './deduplication.js';
import { hourlyPulseService } from '../services/hourlyPulseService.js';
import { notificationService } from '../services/notificationService.js';
import { db } from '../db/database.js';
import { getRepository } from '../db/repositoryFactory.js';

export class BackgroundTaskScheduler {
  private isRunning = false;
  private isIngesting = false;
  private ingestionJob: cron.ScheduledTask | null = null;
  private briefingJob: cron.ScheduledTask | null = null;
  private notificationJob: cron.ScheduledTask | null = null;

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('[Scheduler] Initializing server-side managed background workers...');

    // 1. Ingestion: Every 30 minutes
    this.ingestionJob = cron.schedule('*/30 * * * *', async () => {
      console.log('[Scheduler] Executing scheduled news ingestion...');
      await this.runIngestion();
    });

    // 2. Hourly Pulse Briefing: Every hour at minute 0
    this.briefingJob = cron.schedule('0 * * * *', async () => {
      console.log('[Scheduler] Executing scheduled Hourly Pulse generation...');
      this.runBriefing();
    });

    // 3. Quiet Notification evaluator: Every 15 minutes
    this.notificationJob = cron.schedule('*/15 * * * *', async () => {
      console.log('[Scheduler] Evaluating quiet notification eligibility...');
      notificationService.evaluatePendingDevelopments();
    });

    console.log('[Scheduler] Background workers running successfully.');
  }

  stop() {
    if (this.ingestionJob) this.ingestionJob.stop();
    if (this.briefingJob) this.briefingJob.stop();
    if (this.notificationJob) this.notificationJob.stop();
    this.isRunning = false;
    console.log('[Scheduler] Background workers stopped.');
  }

  async runIngestion(): Promise<{ articlesCount: number; newStoriesCount: number; mergedCount: number; skipped?: boolean; reason?: string }> {
    if (this.isIngesting) {
      console.log('[Scheduler] Ingestion is already in progress. Skipping concurrent run to prevent race conditions.');
      return { articlesCount: 0, newStoriesCount: 0, mergedCount: 0, skipped: true, reason: 'Ingestion job currently active' };
    }

    this.isIngesting = true;
    try {
      const articles = await rssAdapter.ingestAllSources();
      if (articles.length > 0) {
        const { newStoriesCount, mergedCount } = await storyDeduplicator.processArticlesAsync(articles);
        console.log(`[Scheduler] Ingestion finished: ${articles.length} articles ingested (${newStoriesCount} new canonical stories, ${mergedCount} merged updates).`);
        return { articlesCount: articles.length, newStoriesCount, mergedCount, skipped: false };
      }
      return { articlesCount: 0, newStoriesCount: 0, mergedCount: 0, skipped: false };
    } finally {
      this.isIngesting = false;
    }
  }

  runBriefing(scope: any = 'global') {
    const res = hourlyPulseService.generateBriefing({ scope, force: true });
    try {
      const repo = getRepository();
      repo.addBriefing(res.briefing).catch(e => console.warn('[Scheduler] Cloud briefing sync warning:', e.message));
    } catch (e: any) {
      // Ignored if repo uninitialized during startup
    }
    console.log(`[Scheduler] Hourly Pulse generated: ID ${res.briefing.id} (${res.briefing.importantDevelopments.length} developments).`);
    return res;
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      ingestionSchedule: '*/30 * * * * (every 30 mins)',
      briefingSchedule: '0 * * * * (hourly on the hour)',
      notificationSchedule: '*/15 * * * * (every 15 mins)',
      lastHourlyPulseRun: db.getDiagnostics().lastHourlyPulseRun,
      lastNotificationEvaluation: db.getDiagnostics().lastNotificationEvaluation,
    };
  }
}

export const taskScheduler = new BackgroundTaskScheduler();
