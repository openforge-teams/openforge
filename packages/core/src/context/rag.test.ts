import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { IndexChunk } from '../types.js';
import {
  cosineSimilarity,
  keywordScore,
  pathAffinity,
  searchChunks,
  termFrequency,
  tokenize,
} from './rag.js';

describe('rag', () => {
  const sampleChunks: IndexChunk[] = [
    {
      id: '1',
      path: 'src/auth/login.ts',
      startLine: 1,
      endLine: 20,
      symbol: 'authenticateUser',
      content: 'export async function authenticateUser(email: string, password: string) {\n  const token = await verifyCredentials(email, password);\n  return token;\n}',
      mtime: 1,
    },
    {
      id: '2',
      path: 'src/utils/format.ts',
      startLine: 1,
      endLine: 10,
      symbol: 'formatDate',
      content: 'export function formatDate(date: Date): string {\n  return date.toISOString();\n}',
      mtime: 1,
    },
    {
      id: '3',
      path: 'src/auth/token.ts',
      startLine: 5,
      endLine: 30,
      symbol: 'refreshToken',
      content: 'export function refreshToken(oldToken: string) {\n  return signJwt({ sub: decode(oldToken) });\n}',
      mtime: 1,
    },
  ];

  it('tokenizes and computes term frequency', () => {
    const tokens = tokenize('Authenticate user TOKEN authenticate');
    assert.ok(tokens.includes('authenticate'));
    assert.ok(tokens.includes('user'));
    assert.ok(tokens.includes('token'));

    const tf = termFrequency(tokens);
    assert.equal(tf.get('authenticate'), 2);
  });

  it('ranks auth-related chunks higher for auth queries', () => {
    const hits = searchChunks('authenticate user token', sampleChunks, {
      topK: 3,
      pathHint: 'src/auth',
    });

    assert.ok(hits.length >= 2);
    assert.equal(hits[0]?.chunk.path.includes('auth'), true);
    assert.ok(hits[0]!.score >= hits[1]!.score);
  });

  it('scores keyword, path affinity, and cosine similarity', () => {
    const tokens = tokenize('refresh token jwt');
    const score = keywordScore(tokens, sampleChunks[2]!);
    assert.ok(score > 0);

    const affinity = pathAffinity('src/auth', 'src/auth/token.ts');
    assert.ok(affinity > 0);

    const a = termFrequency(tokenize('hello world'));
    const b = termFrequency(tokenize('hello there'));
    const sim = cosineSimilarity(a, b);
    assert.ok(sim > 0 && sim < 1);
  });
});
