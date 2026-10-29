import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isDate, isWeekday, parseShiftWindow, parseTemplateName, parseTimeHm } from './schedule';

describe('parseTimeHm', () => {
  it('prihvata HH:MM i HH:MM:SS', () => {
    assert.equal(parseTimeHm('08:00'), '08:00');
    assert.equal(parseTimeHm('15:30:00'), '15:30');
    assert.equal(parseTimeHm(' 22:05 '), '22:05');
  });
  it('odbija neispravno vreme', () => {
    assert.equal(parseTimeHm('24:00'), null);
    assert.equal(parseTimeHm('8:00'), null);
    assert.equal(parseTimeHm('ab:cd'), null);
    assert.equal(parseTimeHm(12), null);
  });
});

describe('parseShiftWindow', () => {
  it('zahteva pocetak pre kraja (smene preko ponoci nisu u MVP-u)', () => {
    assert.deepEqual(parseShiftWindow('08:00', '15:00'), { start: '08:00', end: '15:00' });
    assert.equal(parseShiftWindow('15:00', '15:00'), null);
    assert.equal(parseShiftWindow('22:00', '06:00'), null);
  });
});

describe('parseTemplateName / isWeekday / isDate', () => {
  it('skracuje razmake i ogranicava duzinu', () => {
    assert.equal(parseTemplateName('  Prva   smena '), 'Prva smena');
    assert.equal(parseTemplateName(''), null);
    assert.equal(parseTemplateName('x'.repeat(81)), null);
  });
  it('weekday 0-6', () => {
    assert.equal(isWeekday(0), true);
    assert.equal(isWeekday(6), true);
    assert.equal(isWeekday(7), false);
    assert.equal(isWeekday('1'), false);
  });
  it('kalendarski datum, ne 31. novembar', () => {
    assert.equal(isDate('2026-11-02'), true);
    assert.equal(isDate('2026-11-31'), false);
    assert.equal(isDate('2026-13-01'), false);
  });
});
