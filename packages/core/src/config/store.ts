import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import type { OpenForgeConfig, ProviderConfig, ProviderId } from '../types.js';

const providerConfigSchema = z.object({
  apiKey: z.string().optional(),
  baseURL: z.string().optional(),
  models: z
    .object({
      chat: z.string().optional(),
      completion: z.string().optional(),
      agent: z.string().optional(),
      small: z.string().optional(),
    })
    .optional(),
});

const configSchema = z.object({
  providers: z
    .record(providerConfigSchema)
    .default({}),
  shortcuts: z.record(z.string()).optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  locale: z.string().optional(),
  permissions: z
    .object({
      autoApproveSafe: z.boolean().optional(),
      autoApproveLow: z.boolean().optional(),
    })
    .optional(),
});

const DEFAULT_CONFIG: OpenForgeConfig = {
  providers: {},
  theme: 'system',
  locale: 'en',
  permissions: {
    autoApproveSafe: true,
    autoApproveLow: false,
  },
};

export class ConfigStore {
  constructor(
    private readonly globalPath = join(homedir(), '.openforge', 'config.json'),
    private readonly projectPath?: string,
  ) {}

  async loadGlobal(): Promise<OpenForgeConfig> {
    return this.loadFile(this.globalPath);
  }

  async loadProject(projectRoot: string): Promise<OpenForgeConfig> {
    const path = this.projectPath ?? join(projectRoot, '.ai', 'config.json');
    return this.loadFile(path);
  }

  async loadMerged(projectRoot: string): Promise<OpenForgeConfig> {
    const global = await this.loadGlobal();
    const project = await this.loadProject(projectRoot);
    return mergeConfigs(global, project);
  }

  async saveGlobal(config: OpenForgeConfig): Promise<void> {
    await this.saveFile(this.globalPath, config);
  }

  async saveProject(projectRoot: string, config: OpenForgeConfig): Promise<void> {
    const path = this.projectPath ?? join(projectRoot, '.ai', 'config.json');
    await this.saveFile(path, config);
  }

  private async loadFile(path: string): Promise<OpenForgeConfig> {
    try {
      const raw = await readFile(path, 'utf8');
      return configSchema.parse(JSON.parse(raw));
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  }

  private async saveFile(path: string, config: OpenForgeConfig): Promise<void> {
    const validated = configSchema.parse(config);
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, JSON.stringify(validated, null, 2), 'utf8');
  }
}

export function mergeConfigs(global: OpenForgeConfig, project: OpenForgeConfig): OpenForgeConfig {
  const providers: Partial<Record<ProviderId, ProviderConfig>> = { ...global.providers };

  for (const [key, value] of Object.entries(project.providers ?? {})) {
    const id = key as ProviderId;
    providers[id] = {
      ...providers[id],
      ...value,
      models: {
        ...providers[id]?.models,
        ...value.models,
      },
    };
  }

  return {
    providers,
    shortcuts: { ...global.shortcuts, ...project.shortcuts },
    theme: project.theme ?? global.theme,
    locale: project.locale ?? global.locale,
    permissions: { ...global.permissions, ...project.permissions },
  };
}

export const defaultConfigStore = new ConfigStore();
