import { resolve } from 'node:path';
import {
  AgentEngine,
  CodeIndexer,
  ConfigStore,
  ModelRouter,
  connectMcpServers,
  type AgentMode,
  type OpenForgeConfig,
  type ProviderConfig,
  type ProviderId,
} from '@openforge/core';
import { CliApprovalQueue } from './approval.js';

export interface CliOptions {
  cwd: string;
  provider?: ProviderId;
  model?: string;
}

export async function loadConfig(cwd: string): Promise<OpenForgeConfig> {
  const store = new ConfigStore();
  return store.loadMerged(cwd);
}

export function buildRouter(
  config: OpenForgeConfig,
  options: CliOptions,
): ModelRouter {
  const defaultProvider =
    options.provider
    ?? (process.env.OPENFORGE_DEFAULT_PROVIDER as ProviderId | undefined)
    ?? 'openai';

  const providers: Partial<Record<ProviderId, ProviderConfig>> = {
    ...config.providers,
  };

  if (options.model && defaultProvider) {
    const existing = providers[defaultProvider] ?? { id: defaultProvider };
    providers[defaultProvider] = {
      ...existing,
      id: defaultProvider,
      models: {
        ...existing.models,
        chat: options.model,
        agent: options.model,
        completion: options.model,
        small: options.model,
      },
    };
  }

  return new ModelRouter({
    defaultProvider,
    providers,
  });
}

export async function createEngine(
  options: CliOptions,
  config: OpenForgeConfig,
  mode: AgentMode,
): Promise<AgentEngine> {
  const projectRoot = resolve(options.cwd);
  const router = buildRouter(config, options);

  try {
    await connectMcpServers(projectRoot);
  } catch {
    // MCP is optional
  }

  return new AgentEngine({
    projectRoot,
    router,
    mode,
    approvalQueue: new CliApprovalQueue({
      autoApproveSafe: config.permissions?.autoApproveSafe ?? true,
      autoApproveLow: config.permissions?.autoApproveLow ?? false,
    }),
  });
}

export async function runIndex(cwd: string): Promise<number> {
  const projectRoot = resolve(cwd);
  const indexer = new CodeIndexer({ projectRoot });
  await indexer.initialize();
  return indexer.indexAll();
}

export function listConfiguredProviders(config: OpenForgeConfig): ProviderId[] {
  const ids: ProviderId[] = ['openai', 'ollama', 'volcengine', 'custom'];
  return ids.filter((id) => {
    if (id === 'ollama') return true;
    const cfg = config.providers[id];
    if (cfg?.apiKey) return true;
    const envKeys: Record<ProviderId, string | undefined> = {
      openai: process.env.OPENAI_API_KEY,
      ollama: process.env.OLLAMA_API_KEY,
      volcengine: process.env.VOLCENGINE_API_KEY ?? process.env.ARK_API_KEY,
      custom: process.env.CUSTOM_API_KEY,
    };
    return Boolean(envKeys[id]);
  });
}

export function getConfigValue(config: OpenForgeConfig, key: string): unknown {
  const parts = key.split('.');
  let current: unknown = config;
  for (const part of parts) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function setConfigValue(
  config: OpenForgeConfig,
  key: string,
  value: string,
): OpenForgeConfig {
  const parts = key.split('.');
  const clone = structuredClone(config) as unknown as Record<string, unknown>;
  let current: Record<string, unknown> = clone;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    if (!(part in current) || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }

  const last = parts[parts.length - 1]!;
  let parsed: unknown = value;
  if (value === 'true') parsed = true;
  else if (value === 'false') parsed = false;
  else if (/^\d+$/.test(value)) parsed = Number(value);
  else if ((value.startsWith('{') && value.endsWith('}')) || (value.startsWith('[') && value.endsWith(']'))) {
    try {
      parsed = JSON.parse(value);
    } catch {
      parsed = value;
    }
  }

  current[last] = parsed;
  return clone as unknown as OpenForgeConfig;
}
