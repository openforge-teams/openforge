import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { redactSecrets, containsSecret, maskValue } from './secrets.js';

describe('secrets', () => {
  it('redacts OpenAI-style API keys', () => {
    const input = 'Error with key sk-abcdefghijklmnopqrstuvwxyz1234567890';
    const result = redactSecrets(input);
    assert.ok(!result.includes('sk-abcdefghijklmnopqrstuvwxyz1234567890'));
    assert.ok(result.includes('[REDACTED]'));
  });

  it('redacts bearer tokens and password assignments', () => {
    const input = 'curl -H "Authorization: Bearer mysecrettoken12345" -d password=supersecret';
    const result = redactSecrets(input);
    assert.ok(!result.includes('mysecrettoken12345'));
    assert.ok(!result.includes('supersecret'));
    assert.equal(containsSecret('token=abc123456789'), true);
    assert.equal(containsSecret('hello world'), false);
  });

  it('masks values showing only edge characters', () => {
    const masked = maskValue('abcdefghijklmnop', 3);
    assert.equal(masked, 'abc…nop');
  });
});
