import type { DirEntry, HostFS } from './types';

const memoryStore = new Map<string, string>();
let projectRoot: string | null = null;
let dirHandle: FileSystemDirectoryHandle | null = null;
const handleMap = new Map<string, FileSystemHandle>();

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '') || '/';
}

function joinPath(base: string, name: string): string {
  const b = normalizePath(base);
  return b === '/' ? `/${name}` : `${b}/${name}`;
}

async function getHandleForPath(path: string): Promise<FileSystemHandle | null> {
  const normalized = normalizePath(path);
  if (handleMap.has(normalized)) return handleMap.get(normalized)!;
  if (!dirHandle) return null;

  const parts = normalized.split('/').filter(Boolean);
  let current: FileSystemHandle = dirHandle;
  let currentPath = '';

  for (const part of parts) {
    currentPath = joinPath(currentPath || '/', part);
    if (handleMap.has(currentPath)) {
      current = handleMap.get(currentPath)!;
      continue;
    }
    if (!('getDirectoryHandle' in current)) return null;
    const dir = current as FileSystemDirectoryHandle;
    try {
      const next = await dir.getDirectoryHandle(part);
      handleMap.set(currentPath, next);
      current = next;
    } catch {
      try {
        const file = await dir.getFileHandle(part);
        handleMap.set(currentPath, file);
        current = file;
      } catch {
        return null;
      }
    }
  }
  return current;
}

async function listDirBrowser(path: string): Promise<DirEntry[]> {
  const handle = await getHandleForPath(path);
  if (!handle || handle.kind !== 'directory') return [];

  const entries: DirEntry[] = [];
  const dir = handle as FileSystemDirectoryHandle;
  // File System Access API — entries() is available on directory handles
  const iterable = (dir as unknown as { entries: () => AsyncIterable<[string, FileSystemHandle]> }).entries();
  for await (const [name, entry] of iterable) {
    const entryPath = joinPath(path, name);
    entries.push({
      name,
      path: entryPath,
      isDirectory: entry.kind === 'directory',
    });
    handleMap.set(normalizePath(entryPath), entry);
  }
  entries.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return entries;
}

async function readFileBrowser(path: string): Promise<string> {
  const handle = await getHandleForPath(path);
  if (handle && 'getFile' in handle) {
    const file = await (handle as FileSystemFileHandle).getFile();
    return file.text();
  }
  if (memoryStore.has(path)) return memoryStore.get(path)!;
  throw new Error(`File not found: ${path}`);
}

async function writeFileBrowser(path: string, content: string): Promise<void> {
  const normalized = normalizePath(path);
  const parts = normalized.split('/').filter(Boolean);
  const fileName = parts.pop();
  if (!fileName) throw new Error('Invalid path');

  const dirPath = parts.length ? `/${parts.join('/')}` : '/';
  const dirHandleForWrite = await getHandleForPath(dirPath);

  if (dirHandleForWrite && 'getFileHandle' in dirHandleForWrite) {
    const parent = dirHandleForWrite as FileSystemDirectoryHandle;
    const fileHandle = await parent.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
    handleMap.set(normalized, fileHandle);
    return;
  }

  memoryStore.set(path, content);
}

export const browserFS: HostFS = {
  async readFile(path) {
    return readFileBrowser(path);
  },

  async writeFile(path, content) {
    return writeFileBrowser(path, content);
  },

  async listDir(path) {
    if (dirHandle) return listDirBrowser(path || projectRoot || '/');
    const base = normalizePath(path || projectRoot || '/');
    const entries = new Map<string, DirEntry>();
    for (const p of memoryStore.keys()) {
      const normalized = normalizePath(p);
      if (!normalized.startsWith(base === '/' ? '/' : base + '/')) continue;
      const rest = base === '/' ? normalized.slice(1) : normalized.slice(base.length + 1);
      const name = rest.split('/')[0];
      if (!name) continue;
      const entryPath = joinPath(base, name);
      const isDirectory = [...memoryStore.keys(), ...handleMap.keys()].some(
        (k) => k !== entryPath && normalizePath(k).startsWith(entryPath + '/'),
      );
      if (!entries.has(name)) {
        entries.set(name, { name, path: entryPath, isDirectory });
      }
    }
    return [...entries.values()].sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  },

  async exists(path) {
    try {
      await readFileBrowser(path);
      return true;
    } catch {
      return memoryStore.has(path);
    }
  },

  getProjectRoot() {
    return projectRoot;
  },

  async openFolder() {
    if (!('showDirectoryPicker' in window)) {
      projectRoot = '/workspace';
      memoryStore.set('/workspace/README.md', '# OpenForge\n\nOpen a folder with a supported browser or use Tauri.\n');
      return projectRoot;
    }

    try {
      const picker = (window as unknown as {
        showDirectoryPicker: (opts: { mode: string }) => Promise<FileSystemDirectoryHandle>;
      }).showDirectoryPicker;
      dirHandle = await picker({ mode: 'readwrite' });
      projectRoot = `/${dirHandle.name}`;
      handleMap.set(projectRoot, dirHandle);
      return projectRoot;
    } catch {
      return null;
    }
  },

  watchProject(_path, _onChange) {
    return () => {};
  },
};

export function seedMemoryWorkspace(): void {
  if (projectRoot) return;
  projectRoot = '/workspace';
  const files: Record<string, string> = {
    '/workspace/README.md': '# OpenForge\n\nWelcome to OpenForge IDE.\n',
    '/workspace/src/index.ts': 'export function greet(name: string) {\n  return `Hello, ${name}!`;\n}\n',
    '/workspace/package.json': '{\n  "name": "demo",\n  "version": "1.0.0"\n}\n',
  };
  for (const [path, content] of Object.entries(files)) {
    memoryStore.set(path, content);
  }
}
