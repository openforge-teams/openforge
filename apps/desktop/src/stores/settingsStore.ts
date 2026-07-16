import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ProviderId, AgentMode } from '@openforge/core/browser';
import type { Locale } from '@/i18n';

export interface ProviderSettings {
  apiKey: string;
  baseURL: string;
  models: {
    chat: string;
    completion: string;
    agent: string;
  };
}

interface SettingsState {
  defaultProvider: ProviderId;
  providers: Record<ProviderId, ProviderSettings>;
  theme: 'light' | 'dark';
  locale: Locale;
  setProvider: (id: ProviderId, patch: Partial<ProviderSettings>) => void;
  setDefaultProvider: (id: ProviderId) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setLocale: (locale: Locale) => void;
}

const defaultProviderSettings = (): ProviderSettings => ({
  apiKey: '',
  baseURL: '',
  models: {
    chat: 'gpt-4o-mini',
    completion: 'gpt-4o-mini',
    agent: 'gpt-4o',
  },
});

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      defaultProvider: 'openai',
      providers: {
        openai: { ...defaultProviderSettings(), baseURL: 'https://api.openai.com/v1' },
        ollama: {
          ...defaultProviderSettings(),
          baseURL: 'http://127.0.0.1:11434/v1',
          models: {
            chat: 'qwen2.5-coder:7b',
            completion: 'qwen2.5-coder:7b',
            agent: 'qwen2.5-coder:7b',
          },
        },
        volcengine: {
          ...defaultProviderSettings(),
          baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
          models: { chat: 'ep-xxxxxxxx', completion: 'ep-xxxxxxxx', agent: 'ep-xxxxxxxx' },
        },
        custom: defaultProviderSettings(),
      },
      theme: 'dark',
      locale: 'zh',
      setProvider: (id, patch) =>
        set((s) => ({
          providers: {
            ...s.providers,
            [id]: { ...s.providers[id], ...patch, models: { ...s.providers[id].models, ...patch.models } },
          },
        })),
      setDefaultProvider: (id) => set({ defaultProvider: id }),
      setTheme: (theme) => set({ theme }),
      setLocale: (locale) => set({ locale }),
    }),
    { name: 'openforge-settings' },
  ),
);

export function buildProviderConfig(state: SettingsState) {
  const result: Record<string, { apiKey?: string; baseURL?: string; models?: ProviderSettings['models'] }> = {};
  for (const [id, cfg] of Object.entries(state.providers)) {
    if (cfg.apiKey || id === 'ollama') {
      result[id] = {
        apiKey: cfg.apiKey || (id === 'ollama' ? 'ollama' : undefined),
        baseURL: cfg.baseURL || undefined,
        models: cfg.models,
      };
    }
  }
  return result;
}

export type { AgentMode };
