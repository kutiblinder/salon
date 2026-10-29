import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatTimeOffRange } from './format';
import { breakRange, fullDayRange, parseNote } from './time-off';
import { isTimeOffKind } from './time-off-types';

const TZ = 'Europe/Belgrade';

describe('fullDayRange / breakRange', () => {
  it('ukljucuje oba datuma: kraj je ponoc narednog dana', () => {
    const r = fullDayRange('2026-11-05', '2026-11-07', TZ);
    assert.ok(r);
    assert.equal(new Date(r.startMs).toISOString(), '2026-11-04T23:00:00.000Z'); // CET
    assert.equal(new Date(r.endMs).toISOString(), '2026-11-07T23:00:00.000Z');
  });
  it('odbija obrnuti raspon i neispravan datum', () => {
    assert.equal(fullDayRange('2026-11-07', '2026-11-05', TZ), null);
    assert.equal(fullDayRange('2026-11-31', '2026-12-01', TZ), null);
  });
  it('pauza iste noci, ne preko ponoci', () => {
    const r = breakRange('2026-11-05', '12:00', '13:00', TZ);
    assert.ok(r);
    assert.equal(r.endMs - r.startMs, 60 * 60_000);
    assert.equal(breakRange('2026-11-05', '22:00', '06:00', TZ), null);
    assert.equal(breakRange('2026-11-05', '12:00', '12:00', TZ), null);
  });
});

describe('parseNote / isTimeOffKind', () => {
  it('prazna napomena je null, predugacka je neispravna', () => {
    assert.equal(parseNote(''), null);
    assert.equal(parseNote('  alergija  '), 'alergija');
    assert.equal(parseNote('x'.repeat(501)), undefined);
  });
  it('prihvata samo vrste iz seme', () => {
    assert.equal(isTimeOffKind('break'), true);
    assert.equal(isTimeOffKind('vacation'), true);
    assert.equal(isTimeOffKind('pending'), false);
  });
});

describe('formatTimeOffRange', () => {
  it('celi dani bez sati, pauza sa satima', () => {
    const vac = fullDayRange('2026-11-05', '2026-11-07', TZ);
    assert.ok(vac);
    assert.match(formatTimeOffRange(new Date(vac.startMs), new Date(vac.endMs), TZ), /5\. novembar.*7\. novembar/);
    const one = fullDayRange('2026-11-05', '2026-11-05', TZ);
    assert.ok(one);
    const oneLabel = formatTimeOffRange(new Date(one.startMs), new Date(one.endMs), TZ);
    assert.match(oneLabel, /5\. novembar 2026/);
    assert.equal(oneLabel.includes('–'), false);
    const br = breakRange('2026-11-05', '12:00', '13:00', TZ);
    assert.ok(br);
    assert.match(formatTimeOffRange(new Date(br.startMs), new Date(br.endMs), TZ), /12:00–13:00/);
  });
});
