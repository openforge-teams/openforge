import type { ProviderConfig, ProviderId } from '../types.js';
import { ModelClient } from './client.js';
import { resolveProvider, type ResolvedProvider } from './providers.js';

export type ModelTask = 'chat' | 'completion' | 'agent' | 'small';

export interface ModelRouterOptions {
  defaultProvider?: ProviderId;
  providers?: Partial<Record<ProviderId, ProviderConfig>>;
  simpleTaskKeywords?: string[];
}

export class ModelRouter {
  private readonly clients = new Map<ProviderId, ModelClient>();
  private readonly resolved = new Map<ProviderId, ResolvedProvider>();
  private readonly defaultProvider: ProviderId;
  private readonly simpleTaskKeywords: string[];

  constructor(options: ModelRouterOptions = {}) {
    this.defaultProvider = options.defaultProvider ?? 'openai';
    this.simpleTaskKeywords = options.simpleTaskKeywords ?? [
      'summarize',
      'explain',
      'what is',
      'translate',
      'format',
      'lint',
      'rename',
    ];

    const providerIds: ProviderId[] = ['openai', 'ollama', 'volcengine', 'custom'];
    for (const id of providerIds) {
      const config = options.providers?.[id];
      if (!config && id !== this.defaultProvider && id !== 'ollama') continue;
      try {
        const resolved = resolveProvider(id, config);
        this.resolved.set(id, resolved);
        this.clients.set(id, new ModelClient(resolved));
      } catch {
        // provider not configured
      }
    }

    if (!this.clients.has(this.defaultProvider)) {
      const resolved = resolveProvider(this.defaultProvider, options.providers?.[this.defaultProvider]);
      this.resolved.set(this.defaultProvider, resolved);
      this.clients.set(this.defaultProvider, new ModelClient(resolved));
    }
  }

  getClient(providerId?: ProviderId): ModelClient {
    const id = providerId ?? this.defaultProvider;
    const client = this.clients.get(id);
    if (!client) {
      throw new Error(`Provider "${id}" is not configured`);
    }
    return client;
  }

  getModel(task: ModelTask, prompt?: string, providerId?: ProviderId): string {
    const id = providerId ?? this.defaultProvider;
    const provider = this.resolved.get(id);
    if (!provider) {
      throw new Error(`Provider "${id}" is not configured`);
    }

    if (task === 'small' || (prompt && this.isSimpleTask(prompt))) {
      return provider.models.small ?? provider.models.chat;
    }

    switch (task) {
      case 'completion':
        return provider.models.completion;
      case 'agent':
        return provider.models.agent;
      case 'chat':
      default:
        return provider.models.chat;
    }
  }

  isSimpleTask(prompt: string): boolean {
    const lower = prompt.toLowerCase();
    return this.simpleTaskKeywords.some((kw) => lower.includes(kw));
  }

  getAggregateTokenUsage(): { promptTokens: number; completionTokens: number; totalTokens: number } {
    let promptTokens = 0;
    let completionTokens = 0;
    let totalTokens = 0;

    for (const client of this.clients.values()) {
      const usage = client.getTokenUsage();
      promptTokens += usage.promptTokens;
      completionTokens += usage.completionTokens;
      totalTokens += usage.totalTokens;
    }

    return { promptTokens, completionTokens, totalTokens };
  }

  async fimComplete(
    prefix: string,
    suffix: string,
    providerId?: ProviderId,
    signal?: AbortSignal,
  ): Promise<string> {
    const id = providerId ?? this.defaultProvider;
    const client = this.getClient(id);
    const model = this.getModel('completion', undefined, id);
    return client.fimCompletion(prefix, suffix, model, signal);
  }
}
