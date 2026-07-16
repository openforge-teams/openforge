import fg from 'fast-glob';
import ignore from 'ignore';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import type { IndexChunk } from '../types.js';

const CODE_EXTENSIONS = [
  'ts', 'tsx', 'js', 'jsx', 'py', 'go', 'rs', 'java', 'rb', 'php', 'cs', 'cpp', 'c', 'h', 'swift', 'kt', 'scala', 'vue', 'svelte', 'md', 'json', 'yaml', 'yml', 'toml',
];

const SYMBOL_PATTERNS: RegExp[] = [
  /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
  /^(?:export\s+)?class\s+(\w+)/,
  /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(/,
  /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?function/,
  /^def\s+(\w+)\s*\(/,
  /^fn\s+(\w+)\s*\(/,
  /^func\s+(\w+)\s*\(/,
  /^pub\s+fn\s+(\w+)\s*\(/,
];

export interface IndexerOptions {
  projectRoot: string;
  persist?: boolean;
  maxFileSize?: number;
}

export class CodeIndexer {
  private chunks = new Map<string, IndexChunk>();
  private fileMtimes = new Map<string, number>();
  private ig = ignore();

  readonly projectRoot: string;

  constructor(private readonly options: IndexerOptions) {
    this.projectRoot = options.projectRoot;
  }

  async initialize(): Promise<void> {
    await this.loadIgnoreRules();
    if (this.options.persist !== false) {
      await this.loadPersisted();
    }
  }

  private async loadIgnoreRules(): Promise<void> {
    const candidates = ['.gitignore', '.aiignore'];
    for (const name of candidates) {
      try {
        const content = await readFile(join(this.options.projectRoot, name), 'utf8');
        this.ig.add(content);
      } catch {
        // file may not exist
      }
    }

    this.ig.add(['node_modules', 'dist', 'build', '.git', '.ai']);
  }

  async indexAll(): Promise<number> {
    const pattern = `**/*.{${CODE_EXTENSIONS.join(',')}}`;
    const files = await fg(pattern, {
      cwd: this.options.projectRoot,
      absolute: false,
      dot: false,
      ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
    });

    let indexed = 0;
    for (const file of files) {
      if (this.ig.ignores(file)) continue;
      const count = await this.indexFile(file, false);
      indexed += count;
    }

    if (this.options.persist !== false) {
      await this.persist();
    }

    return indexed;
  }

  async reindexChanged(): Promise<number> {
    const pattern = `**/*.{${CODE_EXTENSIONS.join(',')}}`;
    const files = await fg(pattern, {
      cwd: this.options.projectRoot,
      absolute: false,
      dot: false,
      ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
    });

    let indexed = 0;
    for (const file of files) {
      if (this.ig.ignores(file)) continue;
      const fullPath = join(this.options.projectRoot, file);
      try {
        const fileStat = await stat(fullPath);
        const prev = this.fileMtimes.get(file);
        if (prev === undefined || fileStat.mtimeMs > prev) {
          indexed += await this.indexFile(file, true);
        }
      } catch {
        // skip unreadable
      }
    }

    if (indexed > 0 && this.options.persist !== false) {
      await this.persist();
    }

    return indexed;
  }

  private async indexFile(relPath: string, replace: boolean): Promise<number> {
    const fullPath = join(this.options.projectRoot, relPath);
    const maxSize = this.options.maxFileSize ?? 512_000;

    let content: string;
    let mtime: number;

    try {
      const fileStat = await stat(fullPath);
      if (fileStat.size > maxSize) return 0;
      mtime = fileStat.mtimeMs;
      content = await readFile(fullPath, 'utf8');
    } catch {
      return 0;
    }

    if (replace) {
      for (const [id, chunk] of this.chunks) {
        if (chunk.path === relPath) this.chunks.delete(id);
      }
    }

    const lines = content.split('\n');
    const newChunks = chunkBySymbols(relPath, lines, mtime);
    for (const chunk of newChunks) {
      this.chunks.set(chunk.id, chunk);
    }

    this.fileMtimes.set(relPath, mtime);
    return newChunks.length;
  }

  getChunks(): IndexChunk[] {
    return [...this.chunks.values()];
  }

  searchByPath(pathFragment: string): IndexChunk[] {
    const lower = pathFragment.toLowerCase();
    return this.getChunks().filter((c) => c.path.toLowerCase().includes(lower));
  }

  private async persist(): Promise<void> {
    const indexDir = join(this.options.projectRoot, '.ai');
    await mkdir(indexDir, { recursive: true });
    const data = {
      version: 1,
      updatedAt: Date.now(),
      chunks: this.getChunks(),
      mtimes: Object.fromEntries(this.fileMtimes),
    };
    await writeFile(join(indexDir, 'index.json'), JSON.stringify(data), 'utf8');
  }

  private async loadPersisted(): Promise<void> {
    try {
      const raw = await readFile(join(this.options.projectRoot, '.ai', 'index.json'), 'utf8');
      const data = JSON.parse(raw) as {
        chunks: IndexChunk[];
        mtimes?: Record<string, number>;
      };
      for (const chunk of data.chunks) {
        this.chunks.set(chunk.id, chunk);
      }
      if (data.mtimes) {
        for (const [path, mtime] of Object.entries(data.mtimes)) {
          this.fileMtimes.set(path, mtime);
        }
      }
    } catch {
      // no persisted index
    }
  }
}

function chunkBySymbols(path: string, lines: string[], mtime: number): IndexChunk[] {
  const chunks: IndexChunk[] = [];
  let currentStart = 0;
  let currentSymbol: string | undefined;
  const maxChunkLines = 80;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    let matchedSymbol: string | undefined;

    for (const pattern of SYMBOL_PATTERNS) {
      const match = line.match(pattern);
      if (match?.[1]) {
        matchedSymbol = match[1];
        break;
      }
    }

    if (matchedSymbol && i > currentStart) {
      pushChunk(chunks, path, lines, currentStart, i - 1, currentSymbol, mtime);
      currentStart = i;
      currentSymbol = matchedSymbol;
    } else if (matchedSymbol) {
      currentSymbol = matchedSymbol;
      currentStart = i;
    }

    if (i - currentStart + 1 >= maxChunkLines) {
      pushChunk(chunks, path, lines, currentStart, i, currentSymbol, mtime);
      currentStart = i + 1;
      currentSymbol = undefined;
    }
  }

  if (currentStart < lines.length) {
    pushChunk(chunks, path, lines, currentStart, lines.length - 1, currentSymbol, mtime);
  }

  if (chunks.length === 0 && lines.length > 0) {
    pushChunk(chunks, path, lines, 0, Math.min(lines.length - 1, maxChunkLines - 1), undefined, mtime);
  }

  return chunks;
}

function pushChunk(
  chunks: IndexChunk[],
  path: string,
  lines: string[],
  start: number,
  end: number,
  symbol: string | undefined,
  mtime: number,
): void {
  const content = lines.slice(start, end + 1).join('\n');
  if (!content.trim()) return;

  chunks.push({
    id: uuidv4(),
    path,
    startLine: start + 1,
    endLine: end + 1,
    symbol,
    content,
    mtime,
  });
}

export function relativePath(projectRoot: string, absPath: string): string {
  return relative(projectRoot, absPath);
}
