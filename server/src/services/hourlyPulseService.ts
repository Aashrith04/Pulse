import { HourlyPulseBriefing, GeographicScope, CanonicalStory, EvidenceStatus } from '../types/index.js';
import { db } from '../db/database.js';
import { aiOrchestrator } from '../ai/orchestrator.js';

export class HourlyPulseService {
  /**
   * Generates an hourly briefing for a specified scope and window
   */
  generateBriefing(options?: {
    scope?: GeographicScope;
    state?: string;
    windowHours?: number;
    force?: boolean;
  }): { briefing: HourlyPulseBriefing; isNew: boolean } {
    const scope = options?.scope || 'global';
    const state = options?.state;
    const windowHours = options?.windowHours || 1;
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowHours * 3600 * 1000);

    // Prevent duplicate briefing generation within same 15 minutes unless forced
    const latestBriefing = db.getLatestBriefing(scope);
    if (!options?.force && latestBriefing) {
      const diffMinutes = (now.getTime() - new Date(latestBriefing.generatedAt).getTime()) / (60 * 1000);
      if (diffMinutes < 15) {
        return { briefing: latestBriefing, isNew: false };
      }
    }

    // Filter stories active or updated within the time window
    const storiesFilter = db.getStories({ scope: scope === 'global' ? undefined : scope, state, limit: 50 }).stories;
    const activeStories = storiesFilter.filter(s => {
      const updatedTime = new Date(s.lastUpdatedAt).getTime();
      return updatedTime >= windowStart.getTime() - (24 * 3600 * 1000); // Lookback for current top stories
    });

    const topStories = activeStories.slice(0, 5);

    let summaryOverview = '';
    let importantDevelopments: HourlyPulseBriefing['importantDevelopments'] = [];

    if (topStories.length === 0) {
      summaryOverview = 'No significant new developments were verified during this hourly interval. Pulse monitors reliable feeds continuously and avoids repeating older headlines to simulate activity.';
    } else {
      summaryOverview = `This hourly briefing encapsulates ${topStories.length} significant developments across ${scope} coverage, focusing on ${topStories.map(s => s.category).filter((v, i, a) => a.indexOf(v) === i).join(', ')}.`;

      importantDevelopments = topStories.map(s => {
        const latestTimeline = s.timeline[s.timeline.length - 1];
        return {
          storyId: s.id,
          headline: s.title,
          whatHappened: s.summary,
          whyItMatters: s.whyItMatters,
          whatChanged: latestTimeline?.whatChanged || 'New verified reporting incorporated into news index.',
          sources: s.articles.map(a => ({ name: a.sourceName, url: a.url })),
          evidenceStatus: s.evidenceStatus,
        };
      });
    }

    // Determine what changed since previous
    const previousBriefing = latestBriefing;
    const previousStoryIds = new Set(previousBriefing?.importantDevelopments.map(d => d.storyId) || []);
    const newStories = topStories.filter(s => !previousStoryIds.has(s.id));
    const updatedStories = topStories.filter(s => previousStoryIds.has(s.id));

    const briefing: HourlyPulseBriefing = {
      id: `briefing-${Date.now()}-${scope}`,
      timeWindowStart: windowStart.toISOString(),
      timeWindowEnd: now.toISOString(),
      generatedAt: now.toISOString(),
      scope,
      state,
      dataFreshnessMinutes: 1,
      summaryOverview,
      importantDevelopments,
      whatChangedSincePrevious: {
        newStoriesCount: newStories.length,
        substantiveUpdatesCount: updatedStories.length,
        highlights: newStories.map(s => `New entry: ${s.title.slice(0, 80)}...`),
      },
      sourceCount: topStories.reduce((acc, s) => acc + s.articles.length, 0),
    };

    db.addBriefing(briefing);
    return { briefing, isNew: true };
  }

  /**
   * Generates an hourly briefing using AI orchestration with automatic fallback
   */
  async generateBriefingAsync(options?: {
    scope?: GeographicScope;
    state?: string;
    windowHours?: number;
    force?: boolean;
  }): Promise<{ briefing: HourlyPulseBriefing; isNew: boolean }> {
    const scope = options?.scope || 'global';
    const state = options?.state;
    const windowHours = options?.windowHours || 1;
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowHours * 3600 * 1000);

    const latestBriefing = db.getLatestBriefing(scope);
    if (!options?.force && latestBriefing) {
      const diffMinutes = (now.getTime() - new Date(latestBriefing.generatedAt).getTime()) / (60 * 1000);
      if (diffMinutes < 15) {
        return { briefing: latestBriefing, isNew: false };
      }
    }

    const storiesFilter = db.getStories({ scope: scope === 'global' ? undefined : scope, state, limit: 50 }).stories;
    const activeStories = storiesFilter.filter(s => {
      const updatedTime = new Date(s.lastUpdatedAt).getTime();
      return updatedTime >= windowStart.getTime() - (24 * 3600 * 1000);
    });

    const topStories = activeStories.slice(0, 5);

    try {
      const aiSynthesis = await aiOrchestrator.generateHourlyBriefing(
        scope,
        topStories,
        windowStart.toISOString(),
        now.toISOString()
      );

      const previousBriefing = latestBriefing;
      const previousStoryIds = new Set(previousBriefing?.importantDevelopments.map(d => d.storyId) || []);
      const newStories = topStories.filter(s => !previousStoryIds.has(s.id));
      const updatedStories = topStories.filter(s => previousStoryIds.has(s.id));

      const briefing: HourlyPulseBriefing = {
        id: `briefing-${Date.now()}-${scope}`,
        timeWindowStart: windowStart.toISOString(),
        timeWindowEnd: now.toISOString(),
        generatedAt: now.toISOString(),
        scope,
        state,
        dataFreshnessMinutes: 1,
        summaryOverview: aiSynthesis.summaryOverview,
        importantDevelopments: aiSynthesis.developments.map(d => ({
          storyId: d.storyId,
          headline: d.headline,
          whatHappened: d.whatHappened,
          whyItMatters: d.whyItMatters,
          whatChanged: d.whatChanged,
          sources: d.sources,
          evidenceStatus: d.evidenceStatus as EvidenceStatus,
        })),
        whatChangedSincePrevious: {
          newStoriesCount: newStories.length,
          substantiveUpdatesCount: updatedStories.length,
          highlights: aiSynthesis.whatChangedSincePrevious?.highlights || newStories.map(s => `New entry: ${s.title.slice(0, 80)}...`),
        },
        sourceCount: topStories.reduce((acc, s) => acc + s.articles.length, 0),
      };

      db.addBriefing(briefing);
      return { briefing, isNew: true };
    } catch (e: any) {
      console.warn('[HourlyPulseService] AI synthesis failed, falling back to deterministic generation:', e.message);
      return this.generateBriefing(options);
    }
  }
}

export const hourlyPulseService = new HourlyPulseService();
