import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseLocationName, parseSlug, slugFromName } from './organizations-parse';

describe('parseSlug', () => {
  it('prihvata mali slug sa crticom', () => {
    assert.equal(parseSlug('  Frizer-Ana '), 'frizer-ana');
    assert.equal(parseSlug('ab'), 'ab');
  });
  it('odbija rezervisane, kratke, preduge i lose znakove', () => {
    assert.equal(parseSlug('www'), null);
    assert.equal(parseSlug('admin'), null);
    assert.equal(parseSlug('a'), null);
    assert.equal(parseSlug('x'.repeat(51)), null);
    assert.equal(parseSlug('Ana Salon'), null);
    assert.equal(parseSlug('-ana'), null);
    assert.equal(parseSlug('ana-'), null);
  });
});

describe('slugFromName', () => {
  it('prebacuje srpsku latinicu', () => {
    assert.equal(slugFromName('Frizer Čačak'), 'frizer-cacak');
    assert.equal(slugFromName('Đorđe'), 'djordje');
  });
  it('prazan kad ne moze', () => {
    assert.equal(slugFromName('A'), '');
    assert.equal(slugFromName('!!!'), '');
  });
});

describe('parseLocationName', () => {
  it('prazno koristi fallback, kratko odbija', () => {
    assert.equal(parseLocationName('', 'Salon Ana'), 'Salon Ana');
    assert.equal(parseLocationName('  Objekat 1 ', 'x'), 'Objekat 1');
    assert.equal(parseLocationName('A', 'Salon'), null);
  });
});
