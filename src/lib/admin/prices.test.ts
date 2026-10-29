import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseBufferMin, parseDescription, parseDurationMin, parseOffers, parsePrice, parseServiceName } from './prices';

describe('parseServiceName / parseDescription / parsePrice', () => {
  it('ime i opis', () => {
    assert.equal(parseServiceName('  Fade  šišanje '), 'Fade šišanje');
    assert.equal(parseServiceName(''), null);
    assert.equal(parseDescription(''), null);
    assert.equal(parseDescription('x'.repeat(501)), undefined);
  });
  it('cena sa zarezom ili tackom, dve decimale', () => {
    assert.equal(parsePrice('1800'), '1800.00');
    assert.equal(parsePrice('1800,5'), '1800.50');
    assert.equal(parsePrice('0'), '0.00');
    assert.equal(parsePrice('-1'), null);
    assert.equal(parsePrice('1.234'), null);
    assert.equal(parsePrice('abc'), null);
  });
  it('trajanje i buffer', () => {
    assert.equal(parseDurationMin('60'), 60);
    assert.equal(parseDurationMin('0'), null);
    assert.equal(parseBufferMin(''), 0);
    assert.equal(parseBufferMin('10'), 10);
    assert.equal(parseBufferMin('-1'), null);
  });
});

describe('parseOffers', () => {
  const loc = '22222222-2222-4222-8222-222222222222';
  it('sklapa ponudu po lokaciji', () => {
    const offers = parseOffers([loc], (id, field) => {
      if (id !== loc) return '';
      return { price: '1800', duration: '45', buffer: '5' }[field];
    });
    assert.ok(!('error' in offers));
    if ('error' in offers) return;
    assert.deepEqual(offers, [{ locationId: loc, price: '1800.00', durationMin: 45, bufferMin: 5 }]);
  });
  it('prazna lista je dozvoljena na parseru (akcija zahteva bar jednu)', () => {
    assert.deepEqual(parseOffers([], () => ''), []);
  });
});
