import { z } from 'zod';
import { BaseAIAdapter } from './baseAdapter.js';
import { 
  AIProviderAdapter, 
  AITaskType, 
  ModelTier, 
  ProviderSpecificConfig, 
  SupportedAIProvider, 
  TASK_CONFIG 
} from '../types.js';

export class OpenAIAdapter extends BaseAIAdapter implements AIProviderAdapter {
  readonly providerName: SupportedAIProvider = 'openai';

  constructor(private config: ProviderSpecificConfig) {
    super();
  }

  isAvailable(): boolean {
    const key = this.config.apiKey?.trim();
    return Boolean(key && key.length > 10 && !key.includes('placeholder'));
  }

  async generateStructured<T>(options: {
    taskType: AITaskType;
    systemPrompt: string;
    userPrompt: string;
    schema: z.ZodSchema<T>;
    tier?: ModelTier;
    temperature?: number;
    timeoutMs?: number;
  }): Promise<{ data: T; modelUsed: string; latencyMs: number; tokenEstimate?: number }> {
    if (!this.isAvailable()) {
      throw new Error('OpenAI adapter is not configured or missing API key in environment.');
    }

    const taskDefaults = TASK_CONFIG[options.taskType];
    const selectedTier = options.tier || taskDefaults.tier;
    const model = selectedTier === 'strong' ? this.config.strongModel : this.config.economicalModel;
    const timeout = options.timeoutMs || taskDefaults.timeoutMs;
    const temperature = options.temperature ?? taskDefaults.temperature;
    const maxTokens = taskDefaults.maxTokens;

    const startTime = Date.now();
    const endpoint = (this.config.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '') + '/chat/completions';

    const response = await this.fetchWithRetry(
      endpoint,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey!.trim()}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: `${options.systemPrompt}\n\nSTRICT REQUIREMENT: Respond ONLY with valid, minified JSON adhering strictly to the requested schema. No markdown outside the JSON, no conversational introductory phrases.`,
            },
            {
              role: 'user',
              content: options.userPrompt,
            },
          ],
          response_format: { type: 'json_object' },
          temperature,
          max_tokens: maxTokens,
        }),
      },
      timeout,
      this.config.maxRetries
    );

    const jsonPayload: any = await response.json();
    const messageContent = jsonPayload.choices?.[0]?.message?.content;
    const usage = jsonPayload.usage;
    const tokenEstimate = usage?.total_tokens;

    const data = this.parseJsonResponse(messageContent, options.schema);
    const latencyMs = Date.now() - startTime;

    return {
      data,
      modelUsed: `OpenAI (${model})`,
      latencyMs,
      tokenEstimate,
    };
  }
}
