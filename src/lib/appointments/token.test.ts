import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashManageToken, isWellFormedToken, newManageToken } from './token';

test('token je nasumican, ispravnog oblika, a hash je deterministican', () => {
  const a = newManageToken();
  const b = newManageToken();
  assert.notEqual(a.token, b.token);
  assert.ok(isWellFormedToken(a.token));
  assert.equal(a.hash, hashManageToken(a.token));
  assert.match(a.hash, /^[0-9a-f]{64}$/);
  assert.notEqual(a.hash, a.token);
});

test('isWellFormedToken odbija sve sto nije 43 base64url znaka', () => {
  assert.equal(isWellFormedToken(''), false);
  assert.equal(isWellFormedToken('a'.repeat(42)), false);
  assert.equal(isWellFormedToken('a'.repeat(44)), false);
  assert.equal(isWellFormedToken(`${'a'.repeat(42)}/`), false);
  assert.equal(isWellFormedToken('a'.repeat(43)), true);
});
