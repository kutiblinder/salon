import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rateLimit } from './rate-limit';

test('rateLimit propušta do limita, zatim odbija u istom prozoru', () => {
  const key = `t-${Date.now()}-${Math.random()}`;
  assert.equal(rateLimit(key, 2, 60_000), true);
  assert.equal(rateLimit(key, 2, 60_000), true);
  assert.equal(rateLimit(key, 2, 60_000), false);
});
