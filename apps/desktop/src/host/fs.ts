import type { HostFS } from './types';
import { browserFS, seedMemoryWorkspace } from './browser';
import { isTauri, tauriFS } from './tauri';

let fsInstance: HostFS | null = null;

export async function getFS(): Promise<HostFS> {
  if (fsInstance) return fsInstance;

  if (await isTauri()) {
    fsInstance = tauriFS;
  } else {
    seedMemoryWorkspace();
    fsInstance = browserFS;
  }
  return fsInstance;
}

export { TAURI_COMMANDS } from './types';
export type { DirEntry, HostFS } from './types';
