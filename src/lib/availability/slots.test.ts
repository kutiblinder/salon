import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeSlots, mergeStaffSlots, pickStaff, type Interval, type SlotParams } from './slots';
import { zonedTimeToUtcMs } from './time';

const TZ = 'Europe/Belgrade';
const DATE = '2026-10-20'; // CEST (UTC+2)
const at = (hm: string, date = DATE) => zonedTimeToUtcMs(date, hm, TZ);
const range = (from: string, to: string): Interval => ({ start: at(from), end: at(to) });
/** Pretvara pocetke u lokalne 'HH:MM' oznake radi lakseg poredjenja. */
const labels = (starts: number[]) =>
  starts.map((ms) =>
    new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(
      new Date(ms),
    ),
  );

const base: SlotParams = {
  date: DATE,
  timezone: TZ,
  stepMin: 30,
  durationMin: 60,
  bufferMin: 0,
  shift: { start: '08:00', end: '12:00' },
  timeOff: [],
  busy: [],
};

test('prazna smena daje sve pocetke u koraku, poslednja usluga staje do kraja smene', () => {
  assert.deepEqual(labels(computeSlots(base)), ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00']);
});

test('nema smene = nema termina', () => {
  assert.deepEqual(computeSlots({ ...base, shift: null }), []);
});

test('postojeci termin 09:00-10:00 blokira preklapajuce pocetke', () => {
  const slots = computeSlots({ ...base, busy: [range('09:00', '10:00')] });
  // 08:00 zavrsava u 09:00 (ok), 08:30/09:00/09:30 se preklapaju, 10:00 je slobodno
  assert.deepEqual(labels(slots), ['08:00', '10:00', '10:30', '11:00']);
});

test('pauza (time off) blokira samu uslugu', () => {
  const slots = computeSlots({ ...base, timeOff: [range('10:00', '10:30')] });
  // 09:30 i 10:00 se preklapaju sa pauzom 10:00-10:30; 09:00 zavrsava tacno u 10:00, 10:30 pocinje posle pauze
  assert.deepEqual(labels(slots), ['08:00', '08:30', '09:00', '10:30', '11:00']);
});

test('buffer blokira slot posle termina', () => {
  // termin 09:00-10:00 + buffer 15 min je vec upisan kao 09:00-10:15
  const slots = computeSlots({
    ...base,
    durationMin: 30,
    bufferMin: 15,
    busy: [range('09:00', '10:15')],
  });
  // 08:30 + 30 + 15 buffer = 09:15 -> preklapa se sa 09:00; 08:00 + 45 = 08:45 ok
  assert.deepEqual(labels(slots), ['08:00', '10:30', '11:00', '11:30']);
});

test('buffer ne mora da stane u smenu, sama usluga mora', () => {
  const slots = computeSlots({ ...base, durationMin: 30, bufferMin: 30, shift: { start: '08:00', end: '09:00' } });
  assert.deepEqual(labels(slots), ['08:00', '08:30']);
});

test('usluga duza od smene = nema termina', () => {
  assert.deepEqual(computeSlots({ ...base, durationMin: 300 }), []);
});

test('earliestStartMs uklanja pocetke u proslosti / prekratko unapred', () => {
  const slots = computeSlots({ ...base, earliestStartMs: at('09:10') });
  assert.deepEqual(labels(slots), ['09:30', '10:00', '10:30', '11:00']);
});

test('mreza je poravnata na sat: smena 08:10 sa korakom 15 pocinje u 08:15', () => {
  const slots = computeSlots({
    ...base,
    stepMin: 15,
    durationMin: 30,
    shift: { start: '08:10', end: '09:00' },
  });
  assert.deepEqual(labels(slots), ['08:15', '08:30']);
});

test('prelaz na zimsko vreme: smena 25.10. racuna se u pravom lokalnom vremenu', () => {
  const date = '2026-10-25';
  const slots = computeSlots({ ...base, date, shift: { start: '08:00', end: '09:00' } });
  assert.deepEqual(labels(slots), ['08:00']);
  assert.equal(new Date(slots[0]).toISOString(), '2026-10-25T07:00:00.000Z'); // UTC+1
});

test('neispravni parametri bacaju gresku', () => {
  assert.throws(() => computeSlots({ ...base, stepMin: 0 }));
  assert.throws(() => computeSlots({ ...base, durationMin: 0 }));
  assert.throws(() => computeSlots({ ...base, bufferMin: -1 }));
});

test('mergeStaffSlots: "bilo koji radnik" spaja i sortira', () => {
  const marko = computeSlots({ ...base, busy: [range('09:00', '10:00')] });
  const jovana = computeSlots({ ...base, shift: { start: '09:00', end: '12:00' } });
  const merged = mergeStaffSlots([
    { staffId: 'marko', starts: marko },
    { staffId: 'jovana', starts: jovana },
  ]);
  const view = merged.map((m) => `${labels([m.start])[0]}:${m.staffIds.join('+')}`);
  assert.deepEqual(view, [
    '08:00:marko',
    '09:00:jovana',
    '09:30:jovana',
    '10:00:marko+jovana',
    '10:30:marko+jovana',
    '11:00:marko+jovana',
  ]);
});

test('pickStaff: bira najmanje opterecenog, pri izjednacenju prvog', () => {
  const load = new Map([
    ['marko', 3],
    ['jovana', 1],
  ]);
  assert.equal(pickStaff(['marko', 'jovana'], load), 'jovana');
  assert.equal(pickStaff(['marko', 'jovana'], new Map()), 'marko');
  assert.throws(() => pickStaff([], load));
});
