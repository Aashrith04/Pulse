import crypto from 'crypto';
import { SupportedAIProvider, AITaskType } from '../types.js';

export interface CacheEntry<T> {
  data: T;
  createdAt: number;
  expiresAt: number;
  modelUsed: string;
}

export interface AIUsageLog {
  id: string;
  taskType: AITaskType;
  provider: SupportedAIProvider;
  modelUsed: string;
  latencyMs: number;
  success: boolean;
  tokenEstimate?: number;
  errorMessage?: string;
  timestamp: string;
}

export class AICacheAndRateLimiter {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private maxCacheSize: number = 1000;
  private defaultTtlMs: number = 3600 * 1000; // 1 hour

  // Rate Limiting per provider (sliding window timestamp array)
  private providerTimestamps: Map<SupportedAIProvider, number[]> = new Map();

  // Usage logs buffer (in-memory ring buffer)
  private usageLogs: AIUsageLog[] = [];
  private maxLogs: number = 200;

  constructor(ttlSeconds: number = 3600) {
    this.defaultTtlMs = ttlSeconds * 1000;
  }

  // --- Caching ---
  generateKey(task: AITaskType, payload: any, language?: string): string {
    const raw = JSON.stringify({ task, payload, language: language || 'en' });
    return `${task}:${crypto.createHash('sha256').update(raw).digest('hex').slice(0, 24)}`;
  }

  get<T>(key: string): CacheEntry<T> | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry;
  }

  set<T>(key: string, data: T, modelUsed: string, customTtlMs?: number): void {
    if (this.cache.size >= this.maxCacheSize) {
      // Evict oldest entries
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    const ttl = customTtlMs || this.defaultTtlMs;
    this.cache.set(key, {
      data,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttl,
      modelUsed,
    });
  }

  clear(): void {
    this.cache.clear();
  }

  // --- Rate Limiting ---
  checkAndRecordRateLimit(provider: SupportedAIProvider, limitPerMinute: number): { allowed: boolean; retryAfterSeconds?: number } {
    if (provider === 'fallback') return { allowed: true };

    const now = Date.now();
    const windowStart = now - 60000;

    let timestamps = this.providerTimestamps.get(provider) || [];
    // Filter timestamps within current 1-minute window
    timestamps = timestamps.filter(t => t > windowStart);

    if (timestamps.length >= limitPerMinute) {
      const oldestInWindow = timestamps[0];
      const waitTimeMs = Math.max(0, oldestInWindow + 60000 - now);
      const retryAfterSeconds = Math.ceil(waitTimeMs / 1000);
      return { allowed: false, retryAfterSeconds };
    }

    timestamps.push(now);
    this.providerTimestamps.set(provider, timestamps);
    return { allowed: true };
  }

  // --- Usage Logging ---
  logUsage(entry: Omit<AIUsageLog, 'id' | 'timestamp'>): void {
    const log: AIUsageLog = {
      ...entry,
      id: `ai-log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
    };

    this.usageLogs.unshift(log);
    if (this.usageLogs.length > this.maxLogs) {
      this.usageLogs.pop();
    }
  }

  getRecentLogs(limit: number = 50): AIUsageLog[] {
    return this.usageLogs.slice(0, limit);
  }

  getMetrics() {
    const totalRequests = this.usageLogs.length;
    const successfulRequests = this.usageLogs.filter(l => l.success).length;
    const failedRequests = totalRequests - successfulRequests;
    const averageLatencyMs = totalRequests > 0
      ? Math.round(this.usageLogs.reduce((acc, l) => acc + l.latencyMs, 0) / totalRequests)
      : 0;
    const providerBreakdown = this.usageLogs.reduce((acc, l) => {
      acc[l.provider] = (acc[l.provider] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      cachedEntriesCount: this.cache.size,
      totalRequests,
      successfulRequests,
      failedRequests,
      averageLatencyMs,
      providerBreakdown,
    };
  }
}
