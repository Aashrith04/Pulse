import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
  normalizeArticleUrl, 
  generateArticleId, 
  articleUrlToUuid, 
  stringToUuid, 
  isValidUuid 
} from '../db/uuidUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Phase A & C: RSS Article ID Generation & Collision Resistance', () => {
  it('normalizes article URLs consistently while preserving distinct paths and content queries', () => {
    const raw1 = 'https://www.thehindu.com/news/national/story-a.ece?utm_source=feed&traffic_source=rss';
    const raw2 = 'HTTPS://WWW.THEHINDU.COM/news/national/story-a.ece';
    const raw3 = 'https://www.thehindu.com/news/national/story-b.ece';
    const raw4 = 'https://pib.gov.in/PressReleasePage.aspx?PRID=2330674';

    const norm1 = normalizeArticleUrl(raw1);
    const norm2 = normalizeArticleUrl(raw2);
    const norm3 = normalizeArticleUrl(raw3);
    const norm4 = normalizeArticleUrl(raw4);

    expect(norm1).toBe('https://www.thehindu.com/news/national/story-a.ece');
    expect(norm2).toBe('https://www.thehindu.com/news/national/story-a.ece');
    expect(norm1).toBe(norm2);
    expect(norm1).not.toBe(norm3);
    expect(norm4).toContain('PRID=2330674');
  });

  it('generates deterministic collision-resistant SHA-256 article IDs', () => {
    const sourceSlug = 'the-hindu';
    const urlA = 'https://www.thehindu.com/news/national/kerala/story-1.ece';
    const urlB = 'https://www.thehindu.com/news/national/kerala/story-2.ece';
    const urlC = 'https://www.thehindu.com/news/national/tamil-nadu/story-3.ece';

    const idA1 = generateArticleId(sourceSlug, urlA);
    const idA2 = generateArticleId(sourceSlug, urlA);
    const idB = generateArticleId(sourceSlug, urlB);
    const idC = generateArticleId(sourceSlug, urlC);

    // Deterministic: repeated calls for the same URL produce the exact same ID
    expect(idA1).toBe(idA2);

    // Collision-free: different URLs from the SAME source produce DIFFERENT IDs
    expect(idA1).not.toBe(idB);
    expect(idA1).not.toBe(idC);
    expect(idB).not.toBe(idC);

    // Full 64-character SHA-256 hash formatting
    expect(idA1.startsWith('art-')).toBe(true);
    expect(idA1.length).toBe('art-'.length + 64);
  });

  it('generates deterministic RFC 4122 UUIDv5 for article URLs', () => {
    const urlA = 'https://indianexpress.com/article/cities/delhi/story-1';
    const urlB = 'https://indianexpress.com/article/cities/mumbai/story-2';

    const uuidA1 = articleUrlToUuid(urlA);
    const uuidA2 = articleUrlToUuid(urlA);
    const uuidB = articleUrlToUuid(urlB);

    expect(isValidUuid(uuidA1)).toBe(true);
    expect(isValidUuid(uuidB)).toBe(true);

    // Deterministic
    expect(uuidA1).toBe(uuidA2);

    // Distinct
    expect(uuidA1).not.toBe(uuidB);
  });

  it('verifies that all distinct article URLs in pulse.db.json produce 1-to-1 unique article IDs and UUIDs', () => {
    const DB_PATH = path.resolve(__dirname, '../../data/pulse.db.json');
    expect(fs.existsSync(DB_PATH)).toBe(true);

    const rawJson = fs.readFileSync(DB_PATH, 'utf-8');
    const db = JSON.parse(rawJson);

    const distinctUrls = new Set<string>();
    const generatedIds = new Set<string>();
    const generatedUuids = new Set<string>();
    const urlToIdMap = new Map<string, string>();
    const urlToUuidMap = new Map<string, string>();

    // Collect all articles across stories and top-level articles
    const allArticles: any[] = [];
    if (db.stories && Array.isArray(db.stories)) {
      for (const s of db.stories) {
        if (s.articles && Array.isArray(s.articles)) {
          allArticles.push(...s.articles);
        }
      }
    }
    if (db.articles && Array.isArray(db.articles)) {
      allArticles.push(...db.articles);
    }

    for (const art of allArticles) {
      if (!art.url) continue;
      const normUrl = normalizeArticleUrl(art.url);
      const artId = generateArticleId(art.sourceId || 'src', normUrl);
      const artUuid = articleUrlToUuid(normUrl);

      distinctUrls.add(normUrl);
      generatedIds.add(artId);
      generatedUuids.add(artUuid);

      if (!urlToIdMap.has(normUrl)) {
        urlToIdMap.set(normUrl, artId);
      } else {
        // Must be identical
        expect(urlToIdMap.get(normUrl)).toBe(artId);
      }

      if (!urlToUuidMap.has(normUrl)) {
        urlToUuidMap.set(normUrl, artUuid);
      } else {
        // Must be identical
        expect(urlToUuidMap.get(normUrl)).toBe(artUuid);
      }
    }

    console.log(`[Validation Results from pulse.db.json]`);
    console.log(`- Distinct Normalized URLs: ${distinctUrls.size}`);
    console.log(`- Distinct Generated Article IDs: ${generatedIds.size}`);
    console.log(`- Distinct Generated Article UUIDs: ${generatedUuids.size}`);

    // Every distinct URL produces a distinct UUID (no collisions)
    expect(generatedUuids.size).toBe(distinctUrls.size);
    expect(distinctUrls.size).toBeGreaterThanOrEqual(717);
  });
});
