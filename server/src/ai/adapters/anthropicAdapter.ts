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

export class AnthropicAdapter extends BaseAIAdapter implements AIProviderAdapter {
  readonly providerName: SupportedAIProvider = 'anthropic';

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
      throw new Error('Anthropic Claude adapter is not configured or missing API key in environment.');
    }

    const taskDefaults = TASK_CONFIG[options.taskType];
    const selectedTier = options.tier || taskDefaults.tier;
    const model = selectedTier === 'strong' ? this.config.strongModel : this.config.economicalModel;
    const timeout = options.timeoutMs || taskDefaults.timeoutMs;
    const temperature = options.temperature ?? taskDefaults.temperature;
    const maxTokens = taskDefaults.maxTokens;

    const startTime = Date.now();
    const endpoint = (this.config.baseUrl || 'https://api.anthropic.com').replace(/\/$/, '') + '/v1/messages';

    const response = await this.fetchWithRetry(
      endpoint,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey!.trim(),
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          temperature,
          system: `${options.systemPrompt}\n\nSTRICT REQUIREMENT: Respond ONLY with valid, minified JSON adhering strictly to the requested schema. No markdown outside the JSON, no conversational introductory phrases.`,
          messages: [
            {
              role: 'user',
              content: options.userPrompt,
            },
          ],
        }),
      },
      timeout,
      this.config.maxRetries
    );

    const jsonPayload: any = await response.json();
    const textBlock = jsonPayload.content?.[0]?.text;
    const usage = jsonPayload.usage;
    const tokenEstimate = usage ? (usage.input_tokens || 0) + (usage.output_tokens || 0) : undefined;

    const data = this.parseJsonResponse(textBlock, options.schema);
    const latencyMs = Date.now() - startTime;

    return {
      data,
      modelUsed: `Anthropic Claude (${model})`,
      latencyMs,
      tokenEstimate,
    };
  }
}
