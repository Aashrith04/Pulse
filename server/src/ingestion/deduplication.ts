import { Article, CanonicalStory, StoryTimelineEvent, EvidenceStatus } from '../types/index.js';
import { db } from '../db/database.js';

// English stopwords to filter before similarity check
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
  'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
  'to', 'was', 'were', 'will', 'with', 'about', 'after', 'all', 'also'
]);

function tokenize(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOP_WORDS.has(w));
  return new Set(words);
}

function calculateJaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersectionSize = 0;
  setA.forEach(item => {
    if (setB.has(item)) intersectionSize++;
  });
  const unionSize = setA.size + setB.size - intersectionSize;
  return unionSize === 0 ? 0 : intersectionSize / unionSize;
}

export class StoryDeduplicator {
  private similarityThreshold = 0.45; // Calibrated for headline/summary token overlap

  /**
   * Processes a newly ingested article: either merges into existing CanonicalStory or creates a new one
   */
  processArticle(article: Article): { story: CanonicalStory; isNewStory: boolean } {
    // 1. Check for exact URL match across all articles in DB
    const allArticles = db.getArticles();
    const existingArticle = allArticles.find(a => a.url === article.url);
    if (existingArticle) {
      const parentStory = db.getStories({ limit: 100 }).stories.find(s => 
        s.articles.some(a => a.url === article.url)
      );
      if (parentStory) {
        return { story: parentStory, isNewStory: false };
      }
    }

    // Persist new article in DB
    db.addArticle(article);

    const articleTokens = tokenize(`${article.title} ${article.summary.slice(0, 150)}`);
    const articleTime = new Date(article.publishedAt).getTime();
    const existingStories = db.getStories({ limit: 50 }).stories;

    let bestMatch: CanonicalStory | null = null;
    let highestScore = 0;

    for (const story of existingStories) {
      // Temporal constraint: only cluster within 48-hour event window
      const storyTime = new Date(story.lastUpdatedAt).getTime();
      const hourDiff = Math.abs(articleTime - storyTime) / (3600 * 1000);
      if (hourDiff > 48) continue;

      // Geographic scope guard: never merge different states
      if (story.geographicScope === 'state' && article.geographicScope === 'state') {
        if (story.state && article.state && story.state !== article.state) {
          continue;
        }
      }

      const storyTokens = tokenize(`${story.title} ${story.summary.slice(0, 150)}`);
      const score = calculateJaccardSimilarity(articleTokens, storyTokens);

      if (score > highestScore && score >= this.similarityThreshold) {
        highestScore = score;
        bestMatch = story;
      }
    }

    if (bestMatch) {
      // Merge article into existing canonical story
      const isAlreadyIncluded = bestMatch.articles.some(a => a.url === article.url);
      if (!isAlreadyIncluded) {
        bestMatch.articles.push(article);
        
        // Check if there is an official update or source corroboration
        const hasOfficialSource = bestMatch.articles.some(a => a.evidenceLabel === 'official_documentation');
        if (hasOfficialSource) {
          bestMatch.evidenceStatus = 'official_documentation';
        } else if (bestMatch.articles.length >= 2) {
          bestMatch.evidenceStatus = 'corroborated_by_sources';
        }

        // Add timeline event if article contains a distinct update
        if (article.title !== bestMatch.title && Math.abs(articleTime - new Date(bestMatch.lastUpdatedAt).getTime()) > 30 * 60 * 1000) {
          const newEvent: StoryTimelineEvent = {
            id: `tl-${Date.now()}-${article.id.slice(-6)}`,
            storyId: bestMatch.id,
            eventTimestamp: article.publishedAt,
            title: `Corroborating Report from ${article.sourceName}`,
            description: article.summary.slice(0, 200),
            whatChanged: `Reporting broadened to include coverage by ${article.sourceName}.`,
            sourceName: article.sourceName,
            sourceUrl: article.url,
            evidenceStatus: article.evidenceLabel,
          };
          bestMatch.timeline.push(newEvent);
        }

        if (article.isLiveIngested) {
          bestMatch.isLiveIngested = true;
        }

        bestMatch.lastUpdatedAt = new Date().toISOString();
        db.upsertStory(bestMatch);
      }
      return { story: bestMatch, isNewStory: false };
    }

    // Otherwise, create a new CanonicalStory
    const slug = article.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
    const cleanSlug = slug.length >= 3 ? slug : Buffer.from(article.title).toString('base64url').slice(0, 10).toLowerCase();
    const newStoryId = `story-${Date.now()}-${cleanSlug}`;
    const newStory: CanonicalStory = {
      id: newStoryId,
      title: article.title,
      summary: article.summary,
      whyItMatters: `Reported by ${article.sourceName}. Subsequent developments will track administrative and public impact.`,
      generalTake: `Initial reporting logged from ${article.sourceName}. Further corroboration pending.`,
      geographicScope: article.geographicScope,
      country: article.country,
      state: article.state,
      category: article.category || 'general',
      leadImageUrl: article.leadImageUrl,
      evidenceStatus: article.evidenceLabel || 'reported_by_one_source',
      importanceLevel: article.isOpinion ? 'low' : 'normal',
      firstReportedAt: article.publishedAt,
      lastUpdatedAt: article.publishedAt,
      isPerspectiveAvailable: true,
      isLiveIngested: article.isLiveIngested ?? false,
      articles: [article],
      timeline: [
        {
          id: `tl-init-${Date.now()}`,
          storyId: newStoryId,
          eventTimestamp: article.publishedAt,
          title: 'Initial Report Logged',
          description: article.summary,
          whatChanged: 'Story entered verified news intelligence index.',
          sourceName: article.sourceName,
          sourceUrl: article.url,
          evidenceStatus: article.evidenceLabel,
        }
      ]
    };

    db.upsertStory(newStory);
    return { story: newStory, isNewStory: true };
  }

  /**
   * Processes a batch of ingested articles
   */
  processArticles(articles: Article[]): { newStoriesCount: number; mergedCount: number } {
    let newStoriesCount = 0;
    let mergedCount = 0;

    for (const article of articles) {
      const result = this.processArticle(article);
      if (result.isNewStory) {
        newStoriesCount++;
      } else {
        mergedCount++;
      }
    }

    return { newStoriesCount, mergedCount };
  }

  /**
   * Processes a newly ingested article using INewsRepository (supporting both local and Supabase cloud persistence)
   */
  async processArticleAsync(article: Article, customRepo?: any): Promise<{ story: CanonicalStory; isNewStory: boolean }> {
    // Dynamically resolve repository if not injected
    const repo = customRepo || (await import('../db/repositoryFactory.js')).getRepository();

    // 1. Check for exact URL match across all articles in DB
    const allArticles = await repo.getArticles(100);
    const existingArticle = allArticles.find((a: Article) => a.url === article.url);
    if (existingArticle) {
      const parentStories = await repo.getStories({ limit: 100 });
      const parentStory = parentStories.stories.find((s: CanonicalStory) => 
        s.articles.some((a: Article) => a.url === article.url)
      );
      if (parentStory) {
        return { story: parentStory, isNewStory: false };
      }
    }

    // Persist new article in DB
    await repo.addArticle(article);

    const articleTokens = tokenize(`${article.title} ${article.summary.slice(0, 150)}`);
    const articleTime = new Date(article.publishedAt).getTime();
    const existingStoriesResult = await repo.getStories({ limit: 50 });
    const existingStories = existingStoriesResult.stories;

    let bestMatch: CanonicalStory | null = null;
    let highestScore = 0;

    for (const story of existingStories) {
      // Temporal constraint: only cluster within 48-hour event window
      const storyTime = new Date(story.lastUpdatedAt).getTime();
      const hourDiff = Math.abs(articleTime - storyTime) / (3600 * 1000);
      if (hourDiff > 48) continue;

      // Geographic scope guard: never merge different states
      if (story.geographicScope === 'state' && article.geographicScope === 'state') {
        if (story.state && article.state && story.state !== article.state) {
          continue;
        }
      }

      const storyTokens = tokenize(`${story.title} ${story.summary.slice(0, 150)}`);
      const score = calculateJaccardSimilarity(articleTokens, storyTokens);

      if (score > highestScore && score >= this.similarityThreshold) {
        highestScore = score;
        bestMatch = story;
      }
    }

    if (bestMatch) {
      const isAlreadyIncluded = bestMatch.articles.some((a: Article) => a.url === article.url);
      if (!isAlreadyIncluded) {
        bestMatch.articles.push(article);
        
        const hasOfficialSource = bestMatch.articles.some((a: Article) => a.evidenceLabel === 'official_documentation');
        if (hasOfficialSource) {
          bestMatch.evidenceStatus = 'official_documentation';
        } else if (bestMatch.articles.length >= 2) {
          bestMatch.evidenceStatus = 'corroborated_by_sources';
        }

        if (article.title !== bestMatch.title && Math.abs(articleTime - new Date(bestMatch.lastUpdatedAt).getTime()) > 30 * 60 * 1000) {
          const newEvent: StoryTimelineEvent = {
            id: `tl-${Date.now()}-${article.id.slice(-6)}`,
            storyId: bestMatch.id,
            eventTimestamp: article.publishedAt,
            title: `Corroborating Report from ${article.sourceName}`,
            description: article.summary.slice(0, 200),
            whatChanged: `Reporting broadened to include coverage by ${article.sourceName}.`,
            sourceName: article.sourceName,
            sourceUrl: article.url,
            evidenceStatus: article.evidenceLabel,
          };
          bestMatch.timeline.push(newEvent);
        }

        if (article.isLiveIngested) {
          bestMatch.isLiveIngested = true;
        }

        bestMatch.lastUpdatedAt = new Date().toISOString();
        await repo.upsertStory(bestMatch);
      }
      return { story: bestMatch, isNewStory: false };
    }

    // Otherwise, create a new CanonicalStory
    const slug = article.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
    const cleanSlug = slug.length >= 3 ? slug : Buffer.from(article.title).toString('base64url').slice(0, 10).toLowerCase();
    const newStoryId = `story-${Date.now()}-${cleanSlug}`;
    const newStory: CanonicalStory = {
      id: newStoryId,
      title: article.title,
      summary: article.summary,
      whyItMatters: `Reported by ${article.sourceName}. Subsequent developments will track administrative and public impact.`,
      generalTake: `Initial reporting logged from ${article.sourceName}. Further corroboration pending.`,
      geographicScope: article.geographicScope,
      country: article.country,
      state: article.state,
      category: article.category || 'general',
      leadImageUrl: article.leadImageUrl,
      evidenceStatus: article.evidenceLabel || 'reported_by_one_source',
      importanceLevel: article.isOpinion ? 'low' : 'normal',
      firstReportedAt: article.publishedAt,
      lastUpdatedAt: article.publishedAt,
      isPerspectiveAvailable: true,
      isLiveIngested: article.isLiveIngested ?? false,
      articles: [article],
      timeline: [
        {
          id: `tl-init-${Date.now()}`,
          storyId: newStoryId,
          eventTimestamp: article.publishedAt,
          title: 'Initial Report Logged',
          description: article.summary,
          whatChanged: 'Story entered verified news intelligence index.',
          sourceName: article.sourceName,
          sourceUrl: article.url,
          evidenceStatus: article.evidenceLabel,
        }
      ]
    };

    await repo.upsertStory(newStory);
    return { story: newStory, isNewStory: true };
  }

  /**
   * Processes a batch of ingested articles using repository async methods
   */
  async processArticlesAsync(articles: Article[], customRepo?: any): Promise<{ newStoriesCount: number; mergedCount: number }> {
    let newStoriesCount = 0;
    let mergedCount = 0;

    for (const article of articles) {
      const result = await this.processArticleAsync(article, customRepo);
      if (result.isNewStory) {
        newStoriesCount++;
      } else {
        mergedCount++;
      }
    }

    return { newStoriesCount, mergedCount };
  }
}

export const storyDeduplicator = new StoryDeduplicator();

