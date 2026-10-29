import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseDurationOverride, parseEmail, parseIdList, parseOptionalText, parseSortOrder, parseStaffName } from './staff';

describe('parseStaffName / parseOptionalText', () => {
  it('skracuje razmake i ogranicava duzinu', () => {
    assert.equal(parseStaffName('  Ana  Marković '), 'Ana Marković');
    assert.equal(parseStaffName(''), null);
    assert.equal(parseStaffName('x'.repeat(81)), null);
    assert.equal(parseOptionalText('  bio  ', 20), 'bio');
    assert.equal(parseOptionalText('', 20), null);
    assert.equal(parseOptionalText('x'.repeat(21), 20), undefined);
  });
});

describe('parseEmail / parseDurationOverride / parseIdList', () => {
  it('email lowercase', () => {
    assert.equal(parseEmail('Ana@Primer.rs'), 'ana@primer.rs');
    assert.equal(parseEmail('nije-email'), null);
  });
  it('trajanje: prazno = null, mora biti ceo broj minuta', () => {
    assert.equal(parseDurationOverride(''), null);
    assert.equal(parseDurationOverride('75'), 75);
    assert.equal(parseDurationOverride('0'), undefined);
    assert.equal(parseDurationOverride('1.5'), undefined);
  });
  it('lista UUID, bez duplikata', () => {
    const a = '22222222-2222-4222-8222-222222222222';
    assert.deepEqual(parseIdList([a, a.toUpperCase(), '']), [a]);
    assert.equal(parseIdList(['nije']), null);
  });
  it('sort_order je nula ili pozitivan ceo broj', () => {
    assert.equal(parseSortOrder(''), 0);
    assert.equal(parseSortOrder('3'), 3);
    assert.equal(parseSortOrder('-1'), null);
  });
});
