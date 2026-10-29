import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isSalonUnavailable } from './access';

describe('isSalonUnavailable', () => {
  it('samo inactive gasi sajt', () => {
    assert.equal(isSalonUnavailable('inactive'), true);
    assert.equal(isSalonUnavailable('draft'), false);
    assert.equal(isSalonUnavailable('published'), false);
  });
});
