import { invoke } from '@tauri-apps/api/core';
import type { DirEntry, HostFS } from './types';
import { TAURI_COMMANDS } from './types';

let projectRoot: string | null = null;

export const tauriFS: HostFS = {
  async readFile(path) {
    return invoke<string>(TAURI_COMMANDS.readFile, { path });
  },

  async writeFile(path, content) {
    await invoke(TAURI_COMMANDS.writeFile, { path, content });
  },

  async listDir(path) {
    const entries = await invoke<Array<{ name: string; path: string; is_directory: boolean }>>(
      TAURI_COMMANDS.listDir,
      { path },
    );
    return entries.map((e) => ({
      name: e.name,
      path: e.path,
      isDirectory: e.is_directory,
    }));
  },

  async exists(path) {
    try {
      await invoke(TAURI_COMMANDS.readFile, { path });
      return true;
    } catch {
      return false;
    }
  },

  getProjectRoot() {
    return projectRoot;
  },

  async openFolder() {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected === 'string') {
      projectRoot = selected;
      return selected;
    }
    return null;
  },

  watchProject(path, onChange) {
    let active = true;
    invoke(TAURI_COMMANDS.watchProject, { path }).catch(() => {});
    const interval = setInterval(async () => {
      if (!active) return;
      onChange(path);
    }, 3000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  },
};

export async function runCommand(cwd: string, cmd: string): Promise<string> {
  return invoke<string>(TAURI_COMMANDS.runCommand, { cwd, cmd });
}

export async function getHomeConfig(): Promise<string> {
  return invoke<string>(TAURI_COMMANDS.getHomeConfig, {});
}

export async function isTauri(): Promise<boolean> {
  if (window.__TAURI__) return true;
  try {
    const { isTauri: check } = await import('@tauri-apps/api/core');
    return check();
  } catch {
    return false;
  }
}
