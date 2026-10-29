import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseOptionalPassword, parseSalonRole, ROLE_LABELS } from './accounts-types';

describe('parseSalonRole', () => {
  it('samo owner, manager, staff', () => {
    assert.equal(parseSalonRole('owner'), 'owner');
    assert.equal(parseSalonRole('manager'), 'manager');
    assert.equal(parseSalonRole('staff'), 'staff');
    assert.equal(parseSalonRole('admin'), null);
    assert.equal(parseSalonRole(''), null);
  });
  it('ima srpske oznake', () => {
    assert.equal(ROLE_LABELS.owner, 'Vlasnik');
    assert.equal(ROLE_LABELS.manager, 'Menadžer');
    assert.equal(ROLE_LABELS.staff, 'Zaposleni');
  });
});

describe('parseOptionalPassword', () => {
  it('prazno je null, kratko undefined', () => {
    assert.equal(parseOptionalPassword(''), null);
    assert.equal(parseOptionalPassword(null), null);
    assert.equal(parseOptionalPassword('short'), undefined);
    assert.equal(parseOptionalPassword('dovoljno8'), 'dovoljno8');
  });
});
