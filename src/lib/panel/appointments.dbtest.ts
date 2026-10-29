/**
 * Panel termina nad pravom bazom (npm run test:db): dozvole "samo svoje", prelazi statusa, audit.
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { testId } from '../test-id';
import type { PoolClient } from 'pg';
import { getPool, withTenant } from '../db';
import { addDays, localDateOf, zonedTimeToUtcMs } from '../availability/time';
import { createGuestAppointment } from '../appointments/create';
import type { StaffBookingInput } from '../appointments/validate';
import { createAppointmentByStaff, loadDayAppointments, setAppointmentStatus } from './appointments';
import { PanelError, loadPanelContext, type PanelContext, type SalonSession } from './core';

const TZ = 'Europe/Belgrade';
const ORG = testId();
const LOC = testId();
const SERVICE = testId();
const ANA = testId();
const BOJAN = testId();
const SHIFT = testId();
const OWNER_USER = testId();
const ANA_USER = testId();
const DATE = addDays(localDateOf(Date.now(), TZ), 7);
const at = (hm: string) => zonedTimeToUtcMs(DATE, hm, TZ);

before(async () => {
  await getPool().query(`
    INSERT INTO organizations (id, name, slug) VALUES ('${ORG}', 'Panel test', 'panel-${ORG.slice(0, 8)}');
    INSERT INTO locations (id, organization_id, name, slot_step_min) VALUES ('${LOC}', '${ORG}', 'Lok', 15);
    INSERT INTO services (id, organization_id, name) VALUES ('${SERVICE}', '${ORG}', 'Šišanje');
    INSERT INTO location_services (location_id, service_id, price, duration_min) VALUES ('${LOC}', '${SERVICE}', 1500, 30);
    INSERT INTO users (id, organization_id, email, full_name) VALUES
      ('${OWNER_USER}', '${ORG}', 'vlasnik@test.rs', 'Vlasnik'), ('${ANA_USER}', '${ORG}', 'ana@test.rs', 'Ana');
    INSERT INTO memberships (user_id, role, scope, organization_id) VALUES
      ('${OWNER_USER}', 'owner', 'organization', '${ORG}'), ('${ANA_USER}', 'staff', 'organization', '${ORG}');
    INSERT INTO staff (id, organization_id, display_name, user_id) VALUES
      ('${ANA}', '${ORG}', 'Ana', '${ANA_USER}'), ('${BOJAN}', '${ORG}', 'Bojan', NULL);
    INSERT INTO staff_locations (staff_id, location_id) VALUES ('${ANA}', '${LOC}'), ('${BOJAN}', '${LOC}');
    INSERT INTO staff_services (staff_id, service_id) VALUES ('${ANA}', '${SERVICE}'), ('${BOJAN}', '${SERVICE}');
    INSERT INTO shift_templates (id, location_id, name, starts_at, ends_at) VALUES ('${SHIFT}', '${LOC}', 'Dan', '09:00', '17:00');
    INSERT INTO weekly_schedule (staff_id, location_id, weekday, shift_template_id)
      SELECT s, '${LOC}', d, '${SHIFT}' FROM unnest(ARRAY['${ANA}', '${BOJAN}']::bigint[]) s, generate_series(0, 6) d;`);
});

after(async () => {
  await getPool().query('DELETE FROM organizations WHERE id = $1', [ORG]);
  await getPool().end();
});

function session(userId: string, name: string): SalonSession {
  return {
    realm: {
      kind: 'salon',
      organizationId: ORG,
      tenant: { id: ORG, name: 'Panel test', slug: 'panel', status: 'published', theme: {} },
    },
    user: { id: userId, name, email: `${name}@test.rs`, phone: null, organizationId: ORG },
    sessionId: testId(),
    activeOrganizationId: null,
  };
}

function asUser<T>(userId: string, fn: (client: PoolClient, ctx: PanelContext) => Promise<T>) {
  return withTenant(ORG, async (client) => fn(client, await loadPanelContext(client, session(userId, 'u'))));
}

function booking(hm: string, staffId: string | null): StaffBookingInput {
  return {
    locationId: LOC,
    serviceId: SERVICE,
    staffId,
    startMs: at(hm),
    guest: { name: 'Klijent', phone: '+381641234567', email: null },
    note: null,
  };
}

test('zaposleni zakazuje sebi: termin je odmah potvrdjen, uz audit', async () => {
  const created = await asUser(ANA_USER, (client, ctx) => createAppointmentByStaff(client, ctx, booking('09:00', ANA), Date.now()));
  const row = await getPool().query(
    `SELECT status, created_by_user_id, pending_expires_at, confirmed_at, privacy_consent_at, guest_email
       FROM appointments WHERE id = $1`,
    [created.id],
  );
  assert.equal(row.rows[0].status, 'confirmed');
  assert.equal(row.rows[0].created_by_user_id, ANA_USER);
  assert.equal(row.rows[0].pending_expires_at, null);
  assert.notEqual(row.rows[0].confirmed_at, null);
  assert.equal(row.rows[0].guest_email, null);
  const audit = await getPool().query(`SELECT action FROM audit_log WHERE object_id = $1`, [created.id]);
  assert.deepEqual(audit.rows.map((r) => r.action), ['appointment.create']);
});

test('zaposleni ne moze da zakaze drugom radniku ni "bilo kome"', async () => {
  await assert.rejects(
    asUser(ANA_USER, (client, ctx) => createAppointmentByStaff(client, ctx, booking('10:00', BOJAN), Date.now())),
    PanelError,
  );
  await assert.rejects(
    asUser(ANA_USER, (client, ctx) => createAppointmentByStaff(client, ctx, booking('10:00', null), Date.now())),
    PanelError,
  );
  const count = await getPool().query(
    `SELECT count(*)::int AS n FROM appointments WHERE organization_id = $1 AND starts_at = $2`,
    [ORG, new Date(at('10:00')).toISOString()],
  );
  assert.equal(count.rows[0].n, 0);
});

test('vlasnik zakazuje "bilo kome"; zaposleni vidi samo svoje termine', async () => {
  const created = await asUser(OWNER_USER, (client, ctx) => createAppointmentByStaff(client, ctx, booking('11:00', null), Date.now()));
  assert.ok(([ANA, BOJAN] as string[]).includes(created.staffId));
  await asUser(OWNER_USER, (client, ctx) => createAppointmentByStaff(client, ctx, booking('12:00', BOJAN), Date.now()));

  const location = { id: LOC, name: 'Lok', timezone: TZ };
  const ownerView = await asUser(OWNER_USER, (client, ctx) => loadDayAppointments(client, ctx, location, DATE));
  const anaView = await asUser(ANA_USER, (client, ctx) => loadDayAppointments(client, ctx, location, DATE));
  assert.ok(ownerView.length >= 3);
  assert.ok(anaView.length >= 1);
  assert.ok(anaView.every((a) => a.staffId === ANA));
  assert.equal(anaView[0].clientPhone, '+381641234567');
});

test('promena statusa: dozvola nad terminom, dozvoljeni prelazi, audit', async () => {
  const bojans = await asUser(OWNER_USER, (client, ctx) => createAppointmentByStaff(client, ctx, booking('14:00', BOJAN), Date.now()));
  await assert.rejects(
    asUser(ANA_USER, (client, ctx) => setAppointmentStatus(client, ctx, bojans.id, 'cancelled_by_salon', Date.now())),
    /dozvolu/,
  );
  // Buduci termin ne moze biti "zavrsen"
  await assert.rejects(
    asUser(OWNER_USER, (client, ctx) => setAppointmentStatus(client, ctx, bojans.id, 'completed', Date.now())),
    PanelError,
  );
  await asUser(OWNER_USER, (client, ctx) => setAppointmentStatus(client, ctx, bojans.id, 'cancelled_by_salon', Date.now()));
  const row = await getPool().query(`SELECT status, cancelled_at FROM appointments WHERE id = $1`, [bojans.id]);
  assert.equal(row.rows[0].status, 'cancelled_by_salon');
  assert.notEqual(row.rows[0].cancelled_at, null);
  // Otkazan termin se vise ne menja
  await assert.rejects(
    asUser(OWNER_USER, (client, ctx) => setAppointmentStatus(client, ctx, bojans.id, 'confirmed', Date.now())),
    PanelError,
  );
  const audit = await getPool().query(
    `SELECT action, old_value->>'status' AS old, new_value->>'status' AS new
       FROM audit_log WHERE object_id = $1 ORDER BY id`,
    [bojans.id],
  );
  assert.deepEqual(
    audit.rows.map((r) => [r.action, r.old, r.new]),
    [['appointment.create', null, 'confirmed'], ['appointment.status', 'confirmed', 'cancelled_by_salon']],
  );
});

test('salon potvrdjuje gost-termin koji ceka potvrdu', async () => {
  const guest = await withTenant(ORG, (client) =>
    createGuestAppointment(
      client,
      ORG,
      { ...booking('15:00', ANA), guest: { name: 'Gost', phone: '+381641234567', email: 'gost@test.rs' } },
      Date.now(),
    ),
  );
  assert.ok(guest.ok);
  await asUser(ANA_USER, (client, ctx) => setAppointmentStatus(client, ctx, guest.appointment.id, 'confirmed', Date.now()));
  const row = await getPool().query(`SELECT status, pending_expires_at FROM appointments WHERE id = $1`, [guest.appointment.id]);
  assert.equal(row.rows[0].status, 'confirmed');
  assert.equal(row.rows[0].pending_expires_at, null);
});
