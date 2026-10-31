import { z } from 'zod';
import { AITaskType, ModelTier, SupportedAIProvider } from '../types.js';

export abstract class BaseAIAdapter {
  abstract readonly providerName: SupportedAIProvider;

  /**
   * Cleans model output by stripping markdown fences (```json ... ```) and parses JSON
   */
  protected parseJsonResponse<T>(rawContent: string, schema: z.ZodSchema<T>): T {
    if (!rawContent || typeof rawContent !== 'string') {
      throw new Error(`Empty response content received from ${this.providerName}`);
    }

    let cleaned = rawContent.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    cleaned = cleaned.trim();

    let parsedJson: any;
    try {
      parsedJson = JSON.parse(cleaned);
    } catch (parseErr: any) {
      throw new Error(`Invalid JSON syntax returned by ${this.providerName}: ${parseErr.message}`);
    }

    const validation = schema.safeParse(parsedJson);
    if (!validation.success) {
      const issueDetails = validation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
      throw new Error(`Structured schema validation failed for ${this.providerName}: ${issueDetails}`);
    }

    return validation.data;
  }

  /**
   * Executes fetch with configurable timeout, retry logic, and exponential backoff
   */
  protected async fetchWithRetry(
    url: string,
    options: RequestInit,
    timeoutMs: number,
    maxRetries: number = 1
  ): Promise<Response> {
    let lastError: any = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        // Exponential backoff: 500ms, 1000ms
        const delay = Math.min(2000, 500 * Math.pow(2, attempt - 1));
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });

        clearTimeout(timer);

        // Do not retry client authorization errors (401, 403)
        if (response.status === 401 || response.status === 403) {
          const errText = await response.text().catch(() => '');
          throw new Error(`HTTP ${response.status} Authentication failed: ${errText.slice(0, 150)}`);
        }

        // Retry on 429 (Rate Limit) or 5xx (Server Error) if attempts remain
        if (!response.ok) {
          const errText = await response.text().catch(() => '');
          const isRetryable = response.status === 429 || response.status >= 500;
          if (isRetryable && attempt < maxRetries) {
            lastError = new Error(`HTTP ${response.status}: ${errText.slice(0, 150)}`);
            continue;
          }
          throw new Error(`HTTP ${response.status}: ${errText.slice(0, 150)}`);
        }

        return response;
      } catch (err: any) {
        clearTimeout(timer);
        if (err.name === 'AbortError') {
          lastError = new Error(`Request timed out after ${timeoutMs}ms`);
        } else {
          lastError = err;
        }

        if (attempt >= maxRetries) {
          throw lastError;
        }
      }
    }

    throw lastError || new Error(`Request failed after ${maxRetries} retries`);
  }
}
