import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { messagesToApi } from './client.js';
import { ApprovalQueue } from '../security/approvals.js';

describe('messagesToApi', () => {
  it('serializes assistant tool_calls for multi-turn loops', () => {
    const api = messagesToApi([
      {
        id: 'a1',
        role: 'assistant',
        content: '',
        toolCalls: [
          { id: 'tc1', name: 'read_file', arguments: { path: 'src/index.ts' } },
        ],
        createdAt: 1,
      },
      {
        id: 't1',
        role: 'tool',
        content: 'file contents',
        toolCallId: 'tc1',
        name: 'read_file',
        createdAt: 2,
      },
    ]);

    assert.equal(api[0]?.tool_calls?.[0]?.function.name, 'read_file');
    assert.equal(api[0]?.tool_calls?.[0]?.function.arguments, '{"path":"src/index.ts"}');
    assert.equal(api[1]?.tool_call_id, 'tc1');
    assert.equal(api[1]?.name, 'read_file');
  });
});

describe('ApprovalQueue', () => {
  it('denies high-risk tools when no prompt is configured', async () => {
    const q = new ApprovalQueue({ autoApproveSafe: true, autoApproveLow: false });
    const ok = await q.request('write_file', { path: 'x' }, 'high', 'test');
    assert.equal(ok, false);
  });

  it('removes resolved requests from pending queue', async () => {
    const q = new ApprovalQueue({
      prompt: async () => 'once',
    });
    await q.request('run_terminal', { cmd: 'ls' }, 'high');
    assert.equal(q.pending().length, 0);
  });
});
