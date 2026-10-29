/**
 * Datumi sa slobodnim slotom: prošlost, vikend bez smene i popunjen dan nisu u listi.
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { testId } from '../test-id';
import { getPool, withTenant } from '../db';
import { addDays, localDateOf, weekdayMonday0, zonedTimeToUtcMs } from './time';
import { getOpenDates } from './load';

const TZ = 'Europe/Belgrade';
const ORG = testId();
const LOC = testId();
const SERVICE = testId();
const STAFF = testId();
const SHIFT = testId();
const today = localDateOf(Date.now(), TZ);
const monday = addDays(today, (7 - weekdayMonday0(today)) % 7 || 7);
const sunday = addDays(monday, 6);

before(async () => {
  await getPool().query(`
    INSERT INTO organizations (id, name, slug) VALUES ('${ORG}', 'Dates', 'dates-${ORG.slice(0, 8)}');
    INSERT INTO locations (id, organization_id, name, slot_step_min) VALUES ('${LOC}', '${ORG}', 'Lok', 15);
    INSERT INTO services (id, organization_id, name) VALUES ('${SERVICE}', '${ORG}', 'Šišanje');
    INSERT INTO location_services (location_id, service_id, price, duration_min, buffer_min)
      VALUES ('${LOC}', '${SERVICE}', 1500, 45, 0);
    INSERT INTO staff (id, organization_id, display_name) VALUES ('${STAFF}', '${ORG}', 'Ana');
    INSERT INTO staff_locations (staff_id, location_id) VALUES ('${STAFF}', '${LOC}');
    INSERT INTO staff_services (staff_id, service_id) VALUES ('${STAFF}', '${SERVICE}');
    INSERT INTO shift_templates (id, location_id, name, starts_at, ends_at)
      VALUES ('${SHIFT}', '${LOC}', 'Dan', '09:00', '17:00');
    INSERT INTO weekly_schedule (staff_id, location_id, weekday, shift_template_id)
      SELECT '${STAFF}', '${LOC}', d, '${SHIFT}' FROM generate_series(0, 4) d;
  `);
});

after(async () => {
  await getPool().query('DELETE FROM organizations WHERE id = $1', [ORG]);
  await getPool().end();
});

const query = (from: string, to: string) =>
  withTenant(ORG, (c) =>
    getOpenDates(c, {
      organizationId: ORG,
      locationId: LOC,
      serviceId: SERVICE,
      staffId: STAFF,
      from,
      to,
      nowMs: Date.now(),
    }),
  );

test('getOpenDates: radni dan je otvoren, nedelja i juce nisu', async () => {
  const result = await query(addDays(today, -2), sunday);
  assert.ok(result);
  assert.ok(result.dates.includes(monday));
  assert.equal(result.dates.includes(sunday), false);
  assert.equal(result.dates.includes(addDays(today, -1)), false);
});

test('getOpenDates: popunjen dan nestaje iz liste', async () => {
  const day = addDays(monday, 1);
  const start = zonedTimeToUtcMs(day, '09:00', TZ);
  const end = zonedTimeToUtcMs(day, '17:00', TZ);
  await getPool().query(
    `INSERT INTO appointments (
       organization_id, location_id, staff_id, service_id, guest_name, guest_phone,
       starts_at, ends_at, service_name_snapshot, price_snapshot, duration_snapshot_min, status, confirmed_at
     ) VALUES ($1, $2, $3, $4, 'Gost', '+381641000000', $5, $6, 'Šišanje', 1500, 45, 'confirmed', now())`,
    [ORG, LOC, STAFF, SERVICE, new Date(start).toISOString(), new Date(end).toISOString()],
  );
  const result = await query(day, day);
  assert.ok(result);
  assert.equal(result.dates.includes(day), false);
});
