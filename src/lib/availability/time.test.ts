import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, localDateOf, weekdayMonday0, zonedTimeToUtcMs } from './time';

const TZ = 'Europe/Belgrade';
const iso = (ms: number) => new Date(ms).toISOString();

test('zonedTimeToUtcMs: letnje vreme (CEST, UTC+2)', () => {
  assert.equal(iso(zonedTimeToUtcMs('2026-10-20', '10:00', TZ)), '2026-10-20T08:00:00.000Z');
  assert.equal(iso(zonedTimeToUtcMs('2026-07-01', '00:00', TZ)), '2026-06-30T22:00:00.000Z');
});

test('zonedTimeToUtcMs: zimsko vreme (CET, UTC+1)', () => {
  assert.equal(iso(zonedTimeToUtcMs('2026-12-15', '10:00', TZ)), '2026-12-15T09:00:00.000Z');
});

test('zonedTimeToUtcMs: prelaz na zimsko vreme 25.10.2026', () => {
  // dan pre promene: jos CEST (+2), dan promene u 08:00: vec CET (+1)
  assert.equal(iso(zonedTimeToUtcMs('2026-10-24', '08:00', TZ)), '2026-10-24T06:00:00.000Z');
  assert.equal(iso(zonedTimeToUtcMs('2026-10-25', '08:00', TZ)), '2026-10-25T07:00:00.000Z');
});

test('zonedTimeToUtcMs: prelaz na letnje vreme 29.03.2026', () => {
  assert.equal(iso(zonedTimeToUtcMs('2026-03-28', '08:00', TZ)), '2026-03-28T07:00:00.000Z');
  assert.equal(iso(zonedTimeToUtcMs('2026-03-29', '08:00', TZ)), '2026-03-29T06:00:00.000Z');
});

test('weekdayMonday0: ponedeljak = 0, nedelja = 6', () => {
  assert.equal(weekdayMonday0('2026-10-12'), 0); // ponedeljak
  assert.equal(weekdayMonday0('2026-10-07'), 2); // sreda
  assert.equal(weekdayMonday0('2026-10-18'), 6); // nedelja
});

test('addDays prelazi granice meseca i godine', () => {
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
});

test('localDateOf: lokalni datum u zoni', () => {
  // 22:30 UTC je vec sledeci dan u Beogradu (UTC+2 leti)
  assert.equal(localDateOf(Date.parse('2026-10-20T22:30:00Z'), TZ), '2026-10-21');
  assert.equal(localDateOf(Date.parse('2026-10-20T21:30:00Z'), TZ), '2026-10-20');
});
