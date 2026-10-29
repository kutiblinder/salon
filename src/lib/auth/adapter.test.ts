import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scopeData, scopeWhere } from './adapter';

test('upiti nad nalozima, sesijama i lozinkama dobijaju filter po salonu', () => {
  for (const model of ['user', 'session', 'account']) {
    assert.deepEqual(scopeWhere(model, [{ field: 'email', value: 'a@b.rs' }], 'org-1'), [
      { field: 'email', value: 'a@b.rs' },
      { field: 'organizationId', operator: 'eq', value: 'org-1', connector: 'AND' },
    ]);
  }
});

test('nalog platforme se trazi sa organizationId IS NULL', () => {
  assert.deepEqual(scopeWhere('user', [], null), [
    { field: 'organizationId', operator: 'eq', value: null, connector: 'AND' },
  ]);
});

test('ulaz ne moze da podmetne drugi salon', () => {
  const where = scopeWhere('user', [{ field: 'organizationId', value: 'org-2', connector: 'OR' }], 'org-1');
  assert.deepEqual(where, [{ field: 'organizationId', operator: 'eq', value: 'org-1', connector: 'AND' }]);
  assert.deepEqual(scopeData('user', { email: 'a@b.rs', organizationId: 'org-2' }, 'org-1'), {
    email: 'a@b.rs',
    organizationId: 'org-1',
  });
});

test('ostali modeli (verification) se ne menjaju', () => {
  const where = [{ field: 'identifier', value: 'x' }];
  assert.equal(scopeWhere('verification', where, 'org-1'), where);
  assert.deepEqual(scopeData('verification', { identifier: 'x' }, 'org-1'), { identifier: 'x' });
});
