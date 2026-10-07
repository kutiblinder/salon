import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveShift, type ExceptionEntry, type WeeklyEntry } from './schedule';

const LOC = 'loc-1';
const OTHER = 'loc-2';
const first = { start: '08:00', end: '15:00' };
const second = { start: '15:00', end: '22:00' };

const weekly: WeeklyEntry[] = [
  { locationId: LOC, weekday: 0, shift: first }, // ponedeljak
  { locationId: OTHER, weekday: 1, shift: second }, // utorak, druga lokacija
];

test('nedeljni obrazac vazi na svojoj lokaciji', () => {
  assert.deepEqual(resolveShift({ date: '2026-10-12', locationId: LOC, weekly, exceptions: [] }), first);
});

test('nedeljni obrazac druge lokacije ne vazi ovde', () => {
  assert.equal(resolveShift({ date: '2026-10-13', locationId: LOC, weekly, exceptions: [] }), null);
  assert.deepEqual(resolveShift({ date: '2026-10-13', locationId: OTHER, weekly, exceptions: [] }), second);
});

test('dan bez obrasca = ne radi', () => {
  assert.equal(resolveShift({ date: '2026-10-14', locationId: LOC, weekly, exceptions: [] }), null);
});

test('izuzetak: slobodan dan ima prednost nad obrascem', () => {
  const exceptions: ExceptionEntry[] = [{ workDate: '2026-10-12', locationId: null, shift: null }];
  assert.equal(resolveShift({ date: '2026-10-12', locationId: LOC, weekly, exceptions }), null);
});

test('izuzetak: druga smena umesto obrasca', () => {
  const exceptions: ExceptionEntry[] = [{ workDate: '2026-10-12', locationId: LOC, shift: second }];
  assert.deepEqual(resolveShift({ date: '2026-10-12', locationId: LOC, weekly, exceptions }), second);
});

test('izuzetak na drugoj lokaciji: ovde ne radi', () => {
  const exceptions: ExceptionEntry[] = [{ workDate: '2026-10-12', locationId: OTHER, shift: second }];
  assert.equal(resolveShift({ date: '2026-10-12', locationId: LOC, weekly, exceptions }), null);
});

test('izuzetak sa smenom bez lokacije se ne koristi', () => {
  const exceptions: ExceptionEntry[] = [{ workDate: '2026-10-12', locationId: null, shift: second }];
  assert.equal(resolveShift({ date: '2026-10-12', locationId: LOC, weekly, exceptions }), null);
});
