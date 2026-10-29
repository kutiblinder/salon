import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhone, parseGuestBooking, parseStaffBooking } from './validate';

const LOC = '22222222-2222-4222-8222-222222222222';
const SRV = '33333333-3333-4333-8333-333333333331';
const STF = '44444444-4444-4444-8444-444444444441';

function body(overrides: Record<string, unknown> = {}) {
  return {
    locationId: LOC,
    serviceId: SRV,
    start: '2026-11-02T07:00:00.000Z',
    guest: { name: '  Petar   Petrović ', phone: '064 123 4567', email: 'Petar@Example.com' },
    privacyConsent: true,
    ...overrides,
  };
}

test('normalizePhone prevodi domace formate u +381', () => {
  assert.equal(normalizePhone('064 123 4567'), '+381641234567');
  assert.equal(normalizePhone('+381 64/123-45-67'), '+381641234567');
  assert.equal(normalizePhone('00381641234567'), '+381641234567');
  assert.equal(normalizePhone('381641234567'), '+381641234567');
  assert.equal(normalizePhone('011 222 333'), '+38111222333');
  assert.equal(normalizePhone('+49 151 23456789'), '+4915123456789');
});

test('normalizePhone odbija neispravne brojeve', () => {
  assert.equal(normalizePhone(''), null);
  assert.equal(normalizePhone('abc'), null);
  assert.equal(normalizePhone('641234567'), null);
  assert.equal(normalizePhone('+381 0641234567'), null);
  assert.equal(normalizePhone('06'), null);
});

test('ispravan zahtev se normalizuje', () => {
  const r = parseGuestBooking(body());
  assert.ok(r.ok);
  assert.equal(r.value.staffId, null);
  assert.equal(r.value.startMs, Date.parse('2026-11-02T07:00:00Z'));
  assert.deepEqual(r.value.guest, { name: 'Petar Petrović', phone: '+381641234567', email: 'petar@example.com' });
  assert.equal(r.value.note, null);
});

test('izabran radnik i napomena', () => {
  const r = parseGuestBooking(body({ staffId: STF.toUpperCase(), note: ' alergija na boju ' }));
  assert.ok(r.ok);
  assert.equal(r.value.staffId, STF);
  assert.equal(r.value.note, 'alergija na boju');
});

test('bez saglasnosti nema zakazivanja', () => {
  assert.deepEqual(parseGuestBooking(body({ privacyConsent: undefined })), { ok: false, error: 'consent_required' });
  assert.deepEqual(parseGuestBooking(body({ privacyConsent: 'true' })), { ok: false, error: 'consent_required' });
});

test('neispravna polja daju jasnu gresku', () => {
  const cases: [Record<string, unknown>, string][] = [
    [{ locationId: 'x' }, 'invalid_id'],
    [{ staffId: 123 }, 'invalid_id'],
    [{ start: '2026-11-02 08:00' }, 'invalid_start'],
    [{ start: '2026-11-02T08:00:00+01:00' }, 'invalid_start'],
    [{ start: '2026-13-45T07:00:00Z' }, 'invalid_start'],
    [{ guest: { name: ' ', phone: '0641234567', email: 'a@b.rs' } }, 'invalid_name'],
    [{ guest: { name: 'Ana', phone: '123', email: 'a@b.rs' } }, 'invalid_phone'],
    [{ guest: { name: 'Ana', phone: '0641234567', email: 'nije-email' } }, 'invalid_email'],
    [{ guest: { name: 'Ana', phone: '0641234567' } }, 'invalid_email'],
    [{ note: 'x'.repeat(501) }, 'invalid_note'],
  ];
  for (const [overrides, error] of cases) {
    assert.deepEqual(parseGuestBooking(body(overrides)), { ok: false, error }, JSON.stringify(overrides));
  }
  assert.deepEqual(parseGuestBooking(null), { ok: false, error: 'invalid_body' });
  assert.deepEqual(parseGuestBooking('x'), { ok: false, error: 'invalid_body' });
});

const staffFields = {
  locationId: '22222222-2222-4222-8222-222222222222',
  serviceId: '33333333-3333-4333-8333-333333333331',
  staffId: '',
  start: '2026-11-02T09:00:00.000Z',
  name: '  Petar  Petrović ',
  phone: '064 123 4567',
  email: '',
  note: '',
};

test('parseStaffBooking: email opcion, prazan radnik = bilo koji, bez saglasnosti', () => {
  const r = parseStaffBooking(staffFields);
  assert.ok(r.ok);
  assert.equal(r.value.staffId, null);
  assert.equal(r.value.guest.email, null);
  assert.equal(r.value.guest.name, 'Petar Petrović');
  assert.equal(r.value.guest.phone, '+381641234567');
  assert.equal(r.value.note, null);
});

test('parseStaffBooking: proverava email kad je unet, telefon je obavezan', () => {
  assert.deepEqual(parseStaffBooking({ ...staffFields, email: 'nije-email' }), { ok: false, error: 'invalid_email' });
  const withEmail = parseStaffBooking({ ...staffFields, email: 'Petar@Primer.rs' });
  assert.ok(withEmail.ok);
  assert.equal(withEmail.value.guest.email, 'petar@primer.rs');
  assert.deepEqual(parseStaffBooking({ ...staffFields, phone: '' }), { ok: false, error: 'invalid_phone' });
});