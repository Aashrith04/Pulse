import crypto from 'crypto';

// Fixed namespace UUID for Pulse domain (RFC 4122 compliant)
const PULSE_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

/**
 * Deterministically converts any string identifier (e.g. 'src-the-hindu' or 'story-123')
 * into an RFC 4122 compliant UUIDv5.
 * If the input is already a valid UUID, returns it unchanged.
 */
export function stringToUuid(name: string, namespace = PULSE_NAMESPACE): string {
  if (!name) {
    return '00000000-0000-0000-0000-000000000000';
  }

  // Already a valid UUID
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(name)) {
    return name.toLowerCase();
  }

  const cleanNs = namespace.replace(/-/g, '');
  const nsBuffer = Buffer.from(cleanNs, 'hex');
  const nameBuffer = Buffer.from(name, 'utf8');
  const hash = crypto.createHash('sha1').update(Buffer.concat([nsBuffer, nameBuffer])).digest();

  // Set version to 5 (0101)
  hash[6] = (hash[6] & 0x0f) | 0x50;
  // Set variant to RFC 4122 (10xx)
  hash[8] = (hash[8] & 0x3f) | 0x80;

  const hex = hash.toString('hex').slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Validates if a string is a well-formed UUID
 */
export function isValidUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
}

/**
 * Normalizes an article URL consistently without accidentally merging genuinely different articles.
 * - Trims whitespace
 * - Lowercases protocol and hostname
 * - Removes hash/anchor fragments
 * - Strips common tracking parameters (utm_*, traffic_source, etc.) while preserving content parameters
 * - Removes trailing slash from pathnames (length > 1)
 */
export function normalizeArticleUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  try {
    const trimmed = rawUrl.trim();
    const parsed = new URL(trimmed);
    parsed.protocol = parsed.protocol.toLowerCase();
    parsed.hostname = parsed.hostname.toLowerCase();
    parsed.hash = '';
    
    // Strip common analytics/tracking parameters
    const trackingParams = [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'traffic_source',
      'at_medium',
      'at_campaign',
    ];
    for (const param of trackingParams) {
      parsed.searchParams.delete(param);
    }

    if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    return parsed.toString();
  } catch {
    return rawUrl.trim();
  }
}

/**
 * Generates a deterministic, collision-resistant article ID based on SHA-256 over the complete canonical article URL.
 * Guarantees that the exact same URL always produces the exact same ID, and different URLs produce different IDs.
 * Accepts either (articleUrl) or (sourceSlug, articleUrl) for backwards compatibility.
 */
export function generateArticleId(sourceSlugOrUrl: string, maybeUrl?: string): string {
  const url = maybeUrl || sourceSlugOrUrl;
  const normalized = normalizeArticleUrl(url);
  const hash = crypto.createHash('sha256').update(normalized || url).digest('hex');
  return `art-${hash}`;
}

/**
 * Deterministically generates an RFC 4122 UUIDv5 for an article from its canonical URL.
 */
export function articleUrlToUuid(articleUrl: string): string {
  const normalized = normalizeArticleUrl(articleUrl);
  return stringToUuid(`article:${normalized || articleUrl}`);
}
