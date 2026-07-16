import type { ProviderConfig, ProviderId } from '../types.js';

export const DEFAULT_BASE_URLS: Record<ProviderId, string> = {
  openai: 'https://api.openai.com/v1',
  ollama: 'http://127.0.0.1:11434/v1',
  volcengine: 'https://ark.cn-beijing.volces.com/api/v3',
  custom: '',
};

export interface ResolvedProvider {
  id: ProviderId;
  apiKey: string;
  baseURL: string;
  models: {
    chat: string;
    completion: string;
    agent: string;
    small?: string;
  };
}

export function resolveProvider(
  id: ProviderId,
  config?: ProviderConfig,
  env: NodeJS.ProcessEnv = typeof process !== 'undefined' ? process.env : {},
): ResolvedProvider {
  const envKeyMap: Record<ProviderId, string | undefined> = {
    openai: env.OPENAI_API_KEY,
    ollama: env.OLLAMA_API_KEY ?? 'ollama',
    volcengine: env.VOLCENGINE_API_KEY ?? env.ARK_API_KEY,
    custom: env.CUSTOM_API_KEY,
  };

  const ollamaModel = env.OLLAMA_MODEL ?? 'qwen2.5-coder:7b';
  const volcModel = env.VOLCENGINE_MODEL ?? env.ARK_MODEL ?? 'ep-xxxxxxxx';
  const openaiModel = env.OPENAI_MODEL ?? 'gpt-4o-mini';

  const defaultModels: Record<ProviderId, ResolvedProvider['models']> = {
    openai: {
      chat: openaiModel,
      completion: openaiModel,
      agent: env.OPENAI_AGENT_MODEL ?? 'gpt-4o',
      small: openaiModel,
    },
    ollama: {
      chat: ollamaModel,
      completion: ollamaModel,
      agent: ollamaModel,
      small: ollamaModel,
    },
    // 火山引擎方舟：model 填推理接入点 Endpoint ID（ep-xxx）
    volcengine: {
      chat: volcModel,
      completion: volcModel,
      agent: volcModel,
      small: volcModel,
    },
    custom: {
      chat: env.CUSTOM_MODEL ?? 'default',
      completion: env.CUSTOM_MODEL ?? 'default',
      agent: env.CUSTOM_MODEL ?? 'default',
      small: env.CUSTOM_MODEL ?? 'default',
    },
  };

  const envBaseMap: Record<ProviderId, string | undefined> = {
    openai: env.OPENAI_BASE_URL,
    ollama: env.OLLAMA_BASE_URL
      ? env.OLLAMA_BASE_URL.replace(/\/$/, '').endsWith('/v1')
        ? env.OLLAMA_BASE_URL
        : `${env.OLLAMA_BASE_URL.replace(/\/$/, '')}/v1`
      : undefined,
    volcengine: env.VOLCENGINE_BASE_URL ?? env.ARK_BASE_URL,
    custom: env.CUSTOM_BASE_URL,
  };

  const baseURL = config?.baseURL ?? envBaseMap[id] ?? DEFAULT_BASE_URLS[id];
  const apiKey = config?.apiKey ?? envKeyMap[id] ?? '';

  // Allow empty keys at resolve time so UI can configure later; API calls fail clearly.

  return {
    id,
    apiKey,
    baseURL,
    models: {
      ...defaultModels[id],
      ...config?.models,
    },
  };
}

export function providerHeaders(provider: ResolvedProvider): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (provider.id === 'ollama' && !provider.apiKey) {
    return headers;
  }

  if (provider.apiKey) {
    headers.Authorization = `Bearer ${provider.apiKey}`;
  }

  return headers;
}
