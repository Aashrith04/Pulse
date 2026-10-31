import { CanonicalStory, Article, AskCitation, EvidenceStatus } from '../../types/index.js';

export interface GroundingContext {
  stories: CanonicalStory[];
  articles?: Article[];
}

export class GroundingCitationValidator {
  /**
   * Validates and reconciles citations against actual database story/article records.
   * Strips any hallucinated citations or fabricated URLs.
   */
  static validateCitations(
    candidateCitations: Array<{
      id?: string;
      title?: string;
      sourceName?: string;
      url?: string;
      evidenceStatus?: string;
      relevanceSnippet?: string;
    }>,
    context: GroundingContext
  ): AskCitation[] {
    const validated: AskCitation[] = [];
    const validStoryMap = new Map<string, CanonicalStory>();
    const validUrlMap = new Map<string, { story: CanonicalStory; article?: Article }>();

    // Build lookup indexes from actual database records
    for (const story of context.stories) {
      validStoryMap.set(story.id, story);
      for (const art of story.articles || []) {
        if (art.url) {
          validUrlMap.set(this.normalizeUrl(art.url), { story, article: art });
        }
      }
    }

    if (context.articles) {
      for (const art of context.articles) {
        if (art.url) {
          const existing = validUrlMap.get(this.normalizeUrl(art.url));
          if (!existing) {
            const matchedStory = context.stories.find(s => s.id === art.id || (s.articles && s.articles.some(a => a.id === art.id)));
            if (matchedStory) {
              validUrlMap.set(this.normalizeUrl(art.url), { story: matchedStory, article: art });
            }
          }
        }
      }
    }

    for (const cand of candidateCitations) {
      let matchedStory: CanonicalStory | undefined;
      let matchedArticle: Article | undefined;

      // 1. Direct match by story ID
      if (cand.id && validStoryMap.has(cand.id)) {
        matchedStory = validStoryMap.get(cand.id);
        matchedArticle = matchedStory?.articles?.[0];
      }

      // 2. Match by normalized URL
      if (!matchedStory && cand.url) {
        const urlMatch = validUrlMap.get(this.normalizeUrl(cand.url));
        if (urlMatch) {
          matchedStory = urlMatch.story;
          matchedArticle = urlMatch.article;
        }
      }

      // 3. Match by headline similarity if ID/URL not strictly provided
      if (!matchedStory && cand.title) {
        const candTitleClean = cand.title.toLowerCase().trim();
        matchedStory = context.stories.find(s => 
          s.title.toLowerCase().includes(candTitleClean) || 
          candTitleClean.includes(s.title.toLowerCase())
        );
        matchedArticle = matchedStory?.articles?.[0];
      }

      // If matched against ground truth, assemble verified citation
      if (matchedStory) {
        const articleToUse = matchedArticle || matchedStory.articles?.[0];
        validated.push({
          id: matchedStory.id,
          title: matchedStory.title,
          sourceName: articleToUse?.sourceName || matchedStory.articles?.[0]?.sourceName || 'Verified Editorial Source',
          url: articleToUse?.url || matchedStory.articles?.[0]?.url || 'https://pulse.news',
          publishedAt: matchedStory.lastUpdatedAt,
          evidenceStatus: matchedStory.evidenceStatus as EvidenceStatus,
          relevanceSnippet: cand.relevanceSnippet || matchedStory.summary,
        });
      }
    }

    // Deduplicate by story ID
    const seen = new Set<string>();
    return validated.filter(c => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });
  }

  /**
   * Formats grounded context for AI prompts, explicitly attributing verified sources
   */
  static formatEditorialContext(stories: CanonicalStory[]): string {
    return stories.map((s, idx) => {
      const sourcesList = (s.articles || [])
        .map(a => `[Source: ${a.sourceName} | URL: ${a.url}]`)
        .join(', ');
      
      return `[RECORD ${idx + 1}]
ID: ${s.id}
Title: ${s.title}
Scope: ${s.geographicScope}${s.state ? ` (${s.state})` : ''}
Category: ${s.category}
Status: ${s.evidenceStatus}
Published: ${s.lastUpdatedAt}
Verified Sources: ${sourcesList || 'Primary Administrative Bureau'}
Summary: ${s.summary}
Why It Matters: ${s.whyItMatters}`;
    }).join('\n\n');
  }

  private static normalizeUrl(url: string): string {
    try {
      const u = new URL(url);
      return `${u.hostname}${u.pathname}`.toLowerCase().replace(/\/$/, '');
    } catch {
      return url.toLowerCase().trim().replace(/\/$/, '');
    }
  }
}
