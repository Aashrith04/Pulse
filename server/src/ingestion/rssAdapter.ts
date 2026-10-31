import Parser from 'rss-parser';
import { Article, NewsSource } from '../types/index.js';
import { db } from '../db/database.js';
import { generateArticleId } from '../db/uuidUtils.js';

const parser = new Parser({
  timeout: 12000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 (compatible; PulseNewsIntelligence/1.0; +https://pulse.news)',
    'Accept': 'application/rss+xml, application/xml, text/xml, text/html, */*',
  },
});

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

export class RSSFeedAdapter {
  /**
   * Fetches articles from a given NewsSource RSS URL
   */
  async fetchFromSource(source: NewsSource): Promise<{ articles: Article[]; error?: string }> {
    if (!source.rssUrl || !source.isEnabled) {
      return { articles: [] };
    }

    const startTime = Date.now();
    try {
      const response = await fetch(source.rssUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'application/rss+xml, application/xml, text/xml, text/html, */*',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(12000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const xmlText = await response.text();
      const feed = await parser.parseString(xmlText);
      const articles: Article[] = [];

      for (const item of (feed.items || []).slice(0, 20)) {
        if (!item.title || !item.link) continue;

        // Clean HTML tags and decode HTML entities from summary/content
        const rawSummary = (item.contentSnippet || item.summary || item.content || '');
        const cleanSummary = decodeHtmlEntities(rawSummary.replace(/<[^>]*>?/gm, ''))
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 450);

        const cleanTitle = decodeHtmlEntities(item.title.replace(/<[^>]*>?/gm, '')).trim();

        const publishedDate = item.isoDate || item.pubDate 
          ? new Date(item.isoDate || item.pubDate!).toISOString() 
          : new Date().toISOString();

        const article: Article = {
          id: generateArticleId(source.slug, item.link),
          sourceId: source.id,
          sourceName: source.name,
          title: cleanTitle,
          summary: cleanSummary || cleanTitle,
          content: decodeHtmlEntities((item.content || cleanSummary).replace(/<[^>]*>?/gm, '')).trim(),
          url: item.link,
          author: item.creator || item.author,
          publishedAt: publishedDate,
          ingestedAt: new Date().toISOString(),
          geographicScope: source.geographicScope,
          country: source.country,
          state: source.state,
          category: source.category,
          language: /[\u0C00-\u0C7F]/.test(cleanTitle) ? 'te' : /[\u0900-\u097F]/.test(cleanTitle) ? 'hi' : 'en',
          evidenceLabel: source.isOfficial ? 'official_documentation' : 'corroborated_by_sources',
          isOpinion: cleanTitle.toLowerCase().includes('opinion:') || cleanTitle.toLowerCase().includes('editorial:'),
          isLiveIngested: true,
        };

        articles.push(article);
      }

      // Update source health and timestamp
      db.updateSourceHealth(source.id, true);

      db.addIngestionLog({
        id: `ingest-${Date.now()}-${source.id}`,
        sourceName: source.name,
        status: 'success',
        articlesFetched: articles.length,
        newStoriesCreated: 0,
        durationMs: Date.now() - startTime,
        createdAt: new Date().toISOString(),
      });

      return { articles };
    } catch (err: any) {
      const errorMsg = err.message || 'Unknown network error';
      console.warn(`[RSS Ingestion] Failed to fetch feed for ${source.name}:`, errorMsg);

      // Track consecutive errors and mark degraded/failing
      db.updateSourceHealth(source.id, false, errorMsg);

      db.addIngestionLog({
        id: `ingest-${Date.now()}-${source.id}`,
        sourceName: source.name,
        status: 'failed',
        articlesFetched: 0,
        newStoriesCreated: 0,
        durationMs: Date.now() - startTime,
        errorMessage: errorMsg,
        createdAt: new Date().toISOString(),
      });

      return { articles: [], error: errorMsg };
    }
  }

  /**
   * Ingests all enabled sources
   */
  async ingestAllSources(): Promise<Article[]> {
    const sources = db.getSources().filter(s => s.isEnabled && s.rssUrl);
    const allArticles: Article[] = [];

    for (const source of sources) {
      const res = await this.fetchFromSource(source);
      allArticles.push(...res.articles);
    }

    return allArticles;
  }
}

export const rssAdapter = new RSSFeedAdapter();
