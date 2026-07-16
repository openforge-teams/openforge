import type { IndexChunk, RagHit } from '../types.js';

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'shall', 'can', 'to', 'of', 'in',
  'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through',
  'and', 'or', 'but', 'if', 'then', 'else', 'when', 'this', 'that',
  'it', 'its', 'i', 'we', 'you', 'they', 'he', 'she', 'function', 'class',
  'const', 'let', 'var', 'return', 'import', 'export', 'async', 'await',
]);

export interface RagOptions {
  topK?: number;
  pathHint?: string;
  keywordWeight?: number;
  semanticWeight?: number;
  pathWeight?: number;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

export function termFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const token of tokens) {
    tf.set(token, (tf.get(token) ?? 0) + 1);
  }
  return tf;
}

export function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (const [key, val] of a) {
    normA += val * val;
    dot += val * (b.get(key) ?? 0);
  }

  for (const val of b.values()) {
    normB += val * val;
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function keywordScore(queryTokens: string[], chunk: IndexChunk): number {
  const contentLower = chunk.content.toLowerCase();
  const pathLower = chunk.path.toLowerCase();
  let score = 0;

  for (const token of queryTokens) {
    if (pathLower.includes(token)) score += 2;
    if (chunk.symbol?.toLowerCase().includes(token)) score += 3;

    const occurrences = contentLower.split(token).length - 1;
    score += occurrences;
  }

  return score;
}

export function pathAffinity(pathHint: string | undefined, chunkPath: string): number {
  if (!pathHint) return 0;
  const hintParts = pathHint.toLowerCase().split(/[/\\]/).filter(Boolean);
  const chunkParts = chunkPath.toLowerCase().split(/[/\\]/).filter(Boolean);

  let shared = 0;
  for (const part of hintParts) {
    if (chunkParts.some((cp) => cp.includes(part) || part.includes(cp))) {
      shared++;
    }
  }

  return hintParts.length > 0 ? shared / hintParts.length : 0;
}

export function searchChunks(
  query: string,
  chunks: IndexChunk[],
  options: RagOptions = {},
): RagHit[] {
  const {
    topK = 10,
    pathHint,
    keywordWeight = 0.5,
    semanticWeight = 0.35,
    pathWeight = 0.15,
  } = options;

  const queryTokens = tokenize(query);
  const queryTf = termFrequency(queryTokens);

  const hits: RagHit[] = chunks.map((chunk) => {
    const chunkTokens = tokenize(`${chunk.path} ${chunk.symbol ?? ''} ${chunk.content}`);
    const chunkTf = termFrequency(chunkTokens);

    const kw = keywordScore(queryTokens, chunk);
    const maxKw = Math.max(1, queryTokens.length * 3);
    const normalizedKw = kw / maxKw;

    const semantic = cosineSimilarity(queryTf, chunkTf);
    const pathAff = pathAffinity(pathHint, chunk.path);

    const score =
      normalizedKw * keywordWeight +
      semantic * semanticWeight +
      pathAff * pathWeight;

    return { chunk, score, pathAffinity: pathAff };
  });

  return hits
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

export function formatRagHits(hits: RagHit[]): string {
  if (hits.length === 0) return '';

  return hits
    .map((hit, i) => {
      const { chunk, score } = hit;
      const loc = chunk.symbol
        ? `${chunk.path}:${chunk.startLine} (${chunk.symbol})`
        : `${chunk.path}:${chunk.startLine}-${chunk.endLine}`;
      return `[${i + 1}] ${loc} (score: ${score.toFixed(3)})\n${chunk.content.slice(0, 500)}`;
    })
    .join('\n\n');
}
