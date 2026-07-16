import type { InlineCompletionRequest, InlineCompletionResult } from '../types.js';
import type { ModelRouter } from '../models/router.js';

interface CacheEntry {
  key: string;
  result: string;
  timestamp: number;
}

const CACHE_TTL_MS = 60_000;
const MAX_CACHE_SIZE = 50;

export class InlineCompletionEngine {
  private cache: CacheEntry[] = [];

  constructor(private readonly router: ModelRouter) {}

  async complete(
    request: InlineCompletionRequest,
    signal?: AbortSignal,
  ): Promise<InlineCompletionResult> {
    const cacheKey = buildCacheKey(request);
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return { text: cached, cached: true };
    }

    const prompt = buildInlinePrompt(request);
    const text = await this.router.fimComplete(
      prompt.prefix,
      prompt.suffix,
      undefined,
      signal,
    );

    const ghostText = parseGhostText(text);
    this.putCache(cacheKey, ghostText);
    return { text: ghostText, cached: false };
  }

  clearCache(): void {
    this.cache = [];
  }

  private getFromCache(key: string): string | undefined {
    const now = Date.now();
    this.cache = this.cache.filter((e) => now - e.timestamp < CACHE_TTL_MS);
    return this.cache.find((e) => e.key === key)?.result;
  }

  private putCache(key: string, result: string): void {
    this.cache.push({ key, result, timestamp: Date.now() });
    if (this.cache.length > MAX_CACHE_SIZE) {
      this.cache.shift();
    }
  }
}

export function buildInlinePrompt(request: InlineCompletionRequest): { prefix: string; suffix: string } {
  const header = request.language ? `// language: ${request.language}\n` : '';
  const prefix = `${header}${request.prefix}`;
  const suffix = request.suffix;
  return { prefix, suffix };
}

export function buildCacheKey(request: InlineCompletionRequest): string {
  return `${request.filePath}:${request.cursorLine}:${request.cursorColumn}:${hash(request.prefix.slice(-200))}:${hash(request.suffix.slice(0, 200))}`;
}

export function parseGhostText(raw: string): string {
  let text = raw.trim();

  const fenceMatch = text.match(/```[\w]*\n([\s\S]*?)```/);
  if (fenceMatch?.[1]) {
    text = fenceMatch[1].trimEnd();
  }

  if (text.startsWith('"') && text.endsWith('"')) {
    text = text.slice(1, -1);
  }

  return text;
}

function hash(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) | 0;
  }
  return String(h);
}

export function buildNearbyContext(
  nearbyFiles: Array<{ path: string; content: string }>,
  maxChars = 4000,
): string {
  const parts: string[] = [];
  let total = 0;

  for (const file of nearbyFiles) {
    const snippet = `// ${file.path}\n${file.content.slice(0, 800)}`;
    if (total + snippet.length > maxChars) break;
    parts.push(snippet);
    total += snippet.length;
  }

  return parts.join('\n\n');
}
