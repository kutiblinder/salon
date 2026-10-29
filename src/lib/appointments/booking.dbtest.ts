/**
 * Integracioni testovi nad pravom bazom (npm run test:db; potrebni docker + migracije).
 * Svaki pokret pravi svoje salone sa nasumicnim slugom i brise ih na kraju.
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { testId } from '../test-id';
import { getPool, withTenant } from '../db';
import { addDays, localDateOf, zonedTimeToUtcMs } from '../availability/time';
import { getAvailability } from '../availability/load';
import { createClientAppointment, createGuestAppointment } from './create';
import { expirePendingAppointments } from './expire';
import { cancelByToken, confirmByToken, getAppointmentByToken } from './manage';
import type { GuestBookingInput } from './validate';

const TZ = 'Europe/Belgrade';
const ORG = testId();
const OTHER_ORG = testId();
const LOC = testId();
const SERVICE = testId();
const ANA = testId();
const BOJAN = testId();
const CLIENT = testId();
const SHIFT = testId();
const DATE = addDays(localDateOf(Date.now(), TZ), 7);
const at = (hm: string) => zonedTimeToUtcMs(DATE, hm, TZ);

before(async () => {
  const sql = `
    INSERT INTO organizations (id, name, slug) VALUES
      ('${ORG}', 'Test', 'test-${ORG.slice(0, 8)}'), ('${OTHER_ORG}', 'Drugi', 'test-${OTHER_ORG.slice(0, 8)}');
    INSERT INTO locations (id, organization_id, name, slot_step_min) VALUES ('${LOC}', '${ORG}', 'Lok', 15);
    INSERT INTO services (id, organization_id, name) VALUES ('${SERVICE}', '${ORG}', 'Šišanje');
    INSERT INTO location_services (location_id, service_id, price, duration_min, buffer_min)
      VALUES ('${LOC}', '${SERVICE}', 1500, 45, 10);
    INSERT INTO staff (id, organization_id, display_name, sort_order) VALUES
      ('${ANA}', '${ORG}', 'Ana', 1), ('${BOJAN}', '${ORG}', 'Bojan', 2);
    INSERT INTO staff_locations (staff_id, location_id) VALUES ('${ANA}', '${LOC}'), ('${BOJAN}', '${LOC}');
    INSERT INTO staff_services (staff_id, service_id, duration_override_min) VALUES
      ('${ANA}', '${SERVICE}', NULL), ('${BOJAN}', '${SERVICE}', 60);
    INSERT INTO shift_templates (id, location_id, name, starts_at, ends_at) VALUES ('${SHIFT}', '${LOC}', 'Dan', '09:00', '17:00');
    INSERT INTO weekly_schedule (staff_id, location_id, weekday, shift_template_id)
      SELECT s, '${LOC}', d, '${SHIFT}' FROM unnest(ARRAY['${ANA}', '${BOJAN}']::bigint[]) s, generate_series(0, 6) d;
    INSERT INTO users (id, organization_id, email, full_name) VALUES
      ('${CLIENT}', '${ORG}', 'klijent-${CLIENT.slice(0, 8)}@test.rs', 'Klijent');`;
  await getPool().query(sql);
});

after(async () => {
  await getPool().query('DELETE FROM organizations WHERE id = ANY($1::bigint[])', [[ORG, OTHER_ORG]]);
  await getPool().end();
});

function input(startMs: number, staffId: string | null): GuestBookingInput {
  return {
    locationId: LOC,
    serviceId: SERVICE,
    staffId,
    startMs,
    guest: { name: 'Gost', phone: '+381641234567', email: 'gost@example.com' },
    note: null,
  };
}

const book = (startMs: number, staffId: string | null) =>
  withTenant(ORG, (c) => createGuestAppointment(c, ORG, input(startMs, staffId), Date.now()));

/** A upise termin bez commit-a; B prolazi proveru slota i ceka na constraint dok A ne commit-uje. */
async function race(aStaff: string, bStaff: string | null, startMs: number) {
  const a = await getPool().connect();
  try {
    await a.query('BEGIN');
    const first = await createGuestAppointment(a, ORG, input(startMs, aStaff), Date.now());
    assert.ok(first.ok);
    const second = book(startMs, bStaff);
    await new Promise((resolve) => setTimeout(resolve, 300));
    await a.query('COMMIT');
    return { first, second: await second };
  } finally {
    a.release();
  }
}

test('upis termina: snapshot cene i naziva, kraj = trajanje radnika + buffer', async () => {
  const start = at('09:00');
  const r = await book(start, BOJAN);
  assert.ok(r.ok);
  assert.equal(r.appointment.status, 'pending');
  assert.equal(r.appointment.staff.id, BOJAN);
  assert.equal(r.appointment.service.durationMin, 60);
  assert.equal(r.appointment.endsAt, new Date(start + 70 * 60_000).toISOString());

  const row = (
    await getPool().query(
      `SELECT service_name_snapshot, price_snapshot::text AS price, duration_snapshot_min AS d,
              guest_phone, privacy_consent_at IS NOT NULL AS consent, manage_token_hash <> $2 AS hashed,
              pending_expires_at > now() AS expires_later
         FROM appointments WHERE id = $1`,
      [r.appointment.id, r.token],
    )
  ).rows[0];
  assert.deepEqual(row, {
    service_name_snapshot: 'Šišanje',
    price: '1500.00',
    d: 60,
    guest_phone: '+381641234567',
    consent: true,
    hashed: true,
    expires_later: true,
  });
});

test('isti radnik, dva istovremena zahteva: drugi dobija slot_taken', async () => {
  const { second } = await race(ANA, ANA, at('11:00'));
  assert.deepEqual(second, { ok: false, error: 'slot_taken' });
});

test('"bilo koji radnik": kad je prvi izabrani upravo zauzet, dodeljuje se drugi', async () => {
  // Bez opterecenja tog dana pickStaff bira Anu (prva po redosledu); A je bas nju zauzeo
  const start = at('13:00');
  const load = await getPool().query(
    `SELECT count(*)::int AS n FROM appointments WHERE staff_id = $1 AND status IN ('pending','confirmed')`,
    [ANA],
  );
  const loadB = await getPool().query(
    `SELECT count(*)::int AS n FROM appointments WHERE staff_id = $1 AND status IN ('pending','confirmed')`,
    [BOJAN],
  );
  assert.ok(load.rows[0].n <= loadB.rows[0].n, 'Ana mora biti prvi izbor');
  const { second } = await race(ANA, null, start);
  assert.ok(second.ok);
  assert.equal(second.appointment.staff.id, BOJAN);
});

test('potvrda i otkazivanje tokenom; token ne vazi u drugom salonu', async () => {
  const r = await book(at('15:00'), ANA);
  assert.ok(r.ok);

  assert.deepEqual(await withTenant(OTHER_ORG, (c) => confirmByToken(c, OTHER_ORG, r.token)), {
    ok: false,
    error: 'not_found',
  });
  assert.equal(await withTenant(OTHER_ORG, (c) => getAppointmentByToken(c, OTHER_ORG, r.token)), null);

  assert.deepEqual(await withTenant(ORG, (c) => confirmByToken(c, ORG, r.token)), { ok: true });
  assert.deepEqual(await withTenant(ORG, (c) => confirmByToken(c, ORG, r.token)), { ok: false, error: 'not_allowed' });
  const shown = await withTenant(ORG, (c) => getAppointmentByToken(c, ORG, r.token));
  assert.equal(shown?.status, 'confirmed');
  assert.equal(shown?.canCancel, true);

  assert.deepEqual(await withTenant(ORG, (c) => cancelByToken(c, ORG, r.token)), { ok: true });
  assert.deepEqual(await withTenant(ORG, (c) => cancelByToken(c, ORG, r.token)), { ok: false, error: 'not_allowed' });
  // Otkazan termin vise ne zauzima slot
  const again = await book(at('15:00'), ANA);
  assert.ok(again.ok);
});

test('istekao pending termin se otkazuje i oslobadja slot', async () => {
  const start = at('16:00');
  const r = await book(start, ANA);
  assert.ok(r.ok);
  await getPool().query(`UPDATE appointments SET pending_expires_at = now() - interval '1 second' WHERE id = $1`, [
    r.appointment.id,
  ]);

  assert.equal(await withTenant(ORG, (c) => expirePendingAppointments(c, ORG)), 1);
  const status = (await getPool().query('SELECT status FROM appointments WHERE id = $1', [r.appointment.id])).rows[0]
    .status;
  assert.equal(status, 'cancelled_by_client');
  assert.deepEqual(await withTenant(ORG, (c) => confirmByToken(c, ORG, r.token)), { ok: false, error: 'not_allowed' });

  const avail = await withTenant(ORG, (c) =>
    getAvailability(c, { organizationId: ORG, locationId: LOC, serviceId: SERVICE, staffId: ANA, date: DATE, nowMs: Date.now() }),
  );
  assert.ok(avail?.slots.some((s) => Date.parse(s.start) === start));
});

test('termin van smene ili van mreze koraka se odbija', async () => {
  assert.deepEqual(await book(at('08:45'), ANA), { ok: false, error: 'slot_unavailable' });
  assert.deepEqual(await book(at('09:05'), ANA), { ok: false, error: 'slot_unavailable' });
  // Usluga (45 min) mora da stane u smenu do 17:00; buffer ne mora
  assert.ok((await book(at('16:15'), ANA)).ok);
  assert.deepEqual(await book(at('16:30'), BOJAN), { ok: false, error: 'slot_unavailable' });
});

test('ulogovani klijent: termin je odmah potvrdjen i vezan za nalog', async () => {
  const start = at('10:00');
  const r = await withTenant(ORG, (c) =>
    createClientAppointment(
      c,
      ORG,
      {
        locationId: LOC,
        serviceId: SERVICE,
        staffId: ANA,
        startMs: start,
        guest: { name: 'Klijent', phone: '+381641111111', email: 'klijent@test.rs' },
        note: null,
      },
      Date.now(),
      CLIENT,
    ),
  );
  assert.ok(r.ok);
  assert.equal(r.appointment.status, 'confirmed');
  const row = (
    await getPool().query(`SELECT client_user_id, status, pending_expires_at FROM appointments WHERE id = $1`, [
      r.appointment.id,
    ])
  ).rows[0];
  assert.equal(row.client_user_id, CLIENT);
  assert.equal(row.status, 'confirmed');
  assert.equal(row.pending_expires_at, null);
});
