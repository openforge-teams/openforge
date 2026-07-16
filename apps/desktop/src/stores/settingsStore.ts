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

const env = import.meta.env;

const VOLC_KEY = String(env.VITE_VOLCENGINE_API_KEY || env.VITE_ARK_API_KEY || '');
const VOLC_BASE = String(
  env.VITE_VOLCENGINE_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3',
);
const VOLC_MODEL = String(
  env.VITE_VOLCENGINE_MODEL || env.VITE_ARK_MODEL || 'doubao-seed-2-0-lite-260428',
);
const DEFAULT_PROVIDER = (String(env.VITE_OPENFORGE_DEFAULT_PROVIDER || 'volcengine') ||
  'volcengine') as ProviderId;

const defaultProviderSettings = (): ProviderSettings => ({
  apiKey: '',
  baseURL: '',
  models: {
    chat: 'gpt-4o-mini',
    completion: 'gpt-4o-mini',
    agent: 'gpt-4o',
  },
});

function initialSettings(): Omit<
  SettingsState,
  'setProvider' | 'setDefaultProvider' | 'setTheme' | 'setLocale'
> {
  return {
    defaultProvider: DEFAULT_PROVIDER,
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
        apiKey: VOLC_KEY,
        baseURL: VOLC_BASE,
        models: {
          chat: VOLC_MODEL,
          completion: VOLC_MODEL,
          agent: VOLC_MODEL,
        },
      },
      custom: defaultProviderSettings(),
    },
    theme: 'dark',
    locale: 'zh',
  };
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...initialSettings(),
      setProvider: (id, patch) =>
        set((s) => ({
          providers: {
            ...s.providers,
            [id]: {
              ...s.providers[id],
              ...patch,
              models: { ...s.providers[id].models, ...patch.models },
            },
          },
        })),
      setDefaultProvider: (id) => set({ defaultProvider: id }),
      setTheme: (theme) => set({ theme }),
      setLocale: (locale) => set({ locale }),
    }),
    {
      // bump key so new Volcengine defaults replace stale empty localStorage
      name: 'openforge-settings-v3',
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<SettingsState>;
        const merged = { ...current, ...p } as SettingsState;
        // Always prefer env-provided Volcengine key/model when present
        if (VOLC_KEY) {
          merged.defaultProvider = 'volcengine';
          merged.providers = {
            ...merged.providers,
            volcengine: {
              ...merged.providers.volcengine,
              apiKey: VOLC_KEY,
              baseURL: VOLC_BASE,
              models: {
                chat: VOLC_MODEL,
                completion: VOLC_MODEL,
                agent: VOLC_MODEL,
              },
            },
          };
        }
        return merged;
      },
    },
  ),
);

export function buildProviderConfig(state: SettingsState) {
  const result: Record<
    string,
    { apiKey?: string; baseURL?: string; models?: ProviderSettings['models'] }
  > = {};
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
