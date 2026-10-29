import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { actionLabel, actorLabel, formatAuditAt, formatAuditValue, objectTypeLabel, redactAuditValue } from './audit';

describe('audit labels', () => {
  it('prevodi poznate akcije, ostale ostavlja kako jesu', () => {
    assert.equal(actionLabel('content.update'), 'Izmena sadržaja');
    assert.equal(actionLabel('organization.create'), 'Novi salon');
    assert.equal(actionLabel('locations.create'), 'Novi objekat');
    assert.equal(objectTypeLabel('location'), 'objekat');
    assert.equal(objectTypeLabel('user'), 'nalog');
    assert.equal(actionLabel('nepoznato.x'), 'nepoznato.x');
    assert.equal(objectTypeLabel('service'), 'usluga');
    assert.equal(objectTypeLabel('xyz'), 'xyz');
  });
  it('prikazuje ime i email, ili Sistem kad nema naloga', () => {
    assert.equal(actorLabel('Admin', 'admin@admin.rs'), 'Admin · admin@admin.rs');
    assert.equal(actorLabel(null, 'a@b.rs'), 'a@b.rs');
    assert.equal(actorLabel(null, null), 'Sistem');
  });
});

describe('formatAuditValue', () => {
  it('sakriva lozinku i token, ostalo ostavlja', () => {
    assert.deepEqual(redactAuditValue({ email: 'a@b.rs', password: 'tajna', nested: { token: 'abc' } }), {
      email: 'a@b.rs',
      password: '[sakriveno]',
      nested: { token: '[sakriveno]' },
    });
    assert.equal(formatAuditValue(null), null);
    assert.equal(formatAuditValue({ n: 1 }), '{\n  "n": 1\n}');
  });
});

describe('formatAuditAt', () => {
  it('prikazuje datum i vreme u Belgrade zoni', () => {
    const text = formatAuditAt(new Date('2026-10-29T16:35:00.000Z'), 'Europe/Belgrade');
    assert.match(text, /29/);
    assert.match(text, /2026/);
    assert.match(text, /17:35/);
  });
});
