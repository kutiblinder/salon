/**
 * Admin objekti: novi, izmena, ne sme da se ugasi poslednji aktivan, kopija cena.
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { testId } from '../test-id';
import type { PoolClient } from 'pg';
import { getPool, withTenant } from '../db';
import { loadAdminContext, AdminError, type AdminContext, type PlatformSession } from './core';
import { createLocation, deleteLocation, getLocation, updateLocation } from './locations';

const ORG = testId();
const OTHER = testId();
const LOC = testId();
const SERVICE = testId();
const ADMIN_USER = testId();

before(async () => {
  await getPool().query(`
    INSERT INTO organizations (id, name, slug) VALUES
      ('${ORG}', 'Loc salon', 'lc-${ORG.slice(0, 8)}'),
      ('${OTHER}', 'Other', 'lo-${OTHER.slice(0, 8)}');
    INSERT INTO locations (id, organization_id, name) VALUES ('${LOC}', '${ORG}', 'Prvi');
    INSERT INTO services (id, organization_id, name) VALUES ('${SERVICE}', '${ORG}', 'Šišanje');
    INSERT INTO location_services (location_id, service_id, price, duration_min) VALUES ('${LOC}', '${SERVICE}', 1000, 30);
    INSERT INTO users (id, organization_id, email, full_name) VALUES
      ('${ADMIN_USER}', NULL, 'admin-locs@test.rs', 'Admin');
    INSERT INTO memberships (user_id, role, scope, organization_id) VALUES
      ('${ADMIN_USER}', 'admin', 'platform', NULL);
  `);
});

after(async () => {
  await getPool().query('DELETE FROM organizations WHERE id IN ($1, $2)', [ORG, OTHER]);
  await getPool().query('DELETE FROM users WHERE id = $1', [ADMIN_USER]);
  await getPool().end();
});

function session(): PlatformSession {
  return {
    realm: { kind: 'platform' },
    user: { id: ADMIN_USER, name: 'Admin', email: 'admin-locs@test.rs', phone: null, organizationId: null },
    sessionId: testId(),
    activeOrganizationId: ORG,
  };
}

function asAdmin<T>(fn: (client: PoolClient, ctx: AdminContext) => Promise<T>) {
  return withTenant(ORG, async (client) => {
    const ctx = await loadAdminContext(client, session());
    if (!ctx) throw new AdminError('nema salona');
    return fn(client, ctx);
  });
}

test('pravi drugi objekat, kopira cene, upisuje sate i audit', async () => {
  const created = await asAdmin((client, ctx) =>
    createLocation(client, ctx, {
      name: 'Drugi',
      address: 'Ulica 2',
      city: 'Beograd',
      phone: '+381 11 111',
      email: 'dva@test.rs',
      slotStepMin: 15,
      sortOrder: 1,
      hours: [{ weekday: 0, opens: '09:00', closes: '17:00' }],
    }),
  );
  assert.equal(created.copiedOffers, 1);
  const detail = await asAdmin((client, ctx) => getLocation(client, ctx, created.id));
  assert.equal(detail?.name, 'Drugi');
  assert.equal(detail?.city, 'Beograd');
  assert.equal(detail?.hours.length, 1);
  const offers = await getPool().query(
    `SELECT price::text AS price FROM location_services WHERE location_id = $1 AND service_id = $2`,
    [created.id, SERVICE],
  );
  assert.equal(Number(offers.rows[0].price), 1000);
  const audit = await getPool().query(
    `SELECT action FROM audit_log WHERE organization_id = $1 AND object_type = 'location' AND object_id = $2`,
    [ORG, created.id],
  );
  assert.ok(audit.rows.some((r) => r.action === 'locations.create'));
});

test('ne sme da se deaktivira poslednji aktivan objekat', async () => {
  const extras = await getPool().query<{ id: string }>(
    `SELECT id FROM locations WHERE organization_id = $1 AND id <> $2`,
    [ORG, LOC],
  );
  for (const row of extras.rows) {
    await asAdmin((client, ctx) =>
      updateLocation(client, ctx, {
        locationId: row.id,
        name: 'Drugi',
        address: null,
        city: null,
        phone: null,
        email: null,
        slotStepMin: 15,
        sortOrder: 1,
        isActive: false,
        hours: [],
      }),
    );
  }
  await assert.rejects(
    asAdmin((client, ctx) =>
      updateLocation(client, ctx, {
        locationId: LOC,
        name: 'Prvi',
        address: null,
        city: null,
        phone: null,
        email: null,
        slotStepMin: 15,
        sortOrder: 0,
        isActive: false,
        hours: [],
      }),
    ),
    AdminError,
  );
});

test('briše drugi objekat; poslednji se ne briše', async () => {
  const extras = await getPool().query<{ id: string }>(
    `SELECT id FROM locations WHERE organization_id = $1 AND id <> $2`,
    [ORG, LOC],
  );
  assert.ok(extras.rows[0]);
  const extraId = extras.rows[0].id;
  await asAdmin((client, ctx) => deleteLocation(client, ctx, extraId));
  const gone = await getPool().query(`SELECT 1 FROM locations WHERE id = $1`, [extraId]);
  assert.equal(gone.rowCount, 0);
  const leftover = await getPool().query<{ id: string }>(
    `SELECT id FROM locations WHERE organization_id = $1 AND id <> $2`,
    [ORG, LOC],
  );
  for (const row of leftover.rows) {
    await asAdmin((client, ctx) => deleteLocation(client, ctx, row.id));
  }
  await assert.rejects(asAdmin((client, ctx) => deleteLocation(client, ctx, LOC)), AdminError);
  const audit = await getPool().query(
    `SELECT action FROM audit_log WHERE organization_id = $1 AND object_id = $2 AND action = 'locations.delete'`,
    [ORG, extraId],
  );
  assert.equal(audit.rowCount, 1);
});

test('ne sme da se obriše objekat sa budućim terminom', async () => {
  const staff = testId();
  const extra = await asAdmin((client, ctx) =>
    createLocation(client, ctx, {
      name: 'Sa terminom',
      address: null,
      city: null,
      phone: null,
      email: null,
      slotStepMin: 15,
      sortOrder: 3,
      hours: [],
    }),
  );
  await getPool().query(`
    INSERT INTO staff (id, organization_id, display_name) VALUES ('${staff}', '${ORG}', 'Radnik');
    INSERT INTO appointments (
      organization_id, location_id, staff_id, service_id, guest_name, guest_phone,
      starts_at, ends_at, service_name_snapshot, price_snapshot, duration_snapshot_min, status
    ) VALUES (
      '${ORG}', '${extra.id}', '${staff}', '${SERVICE}', 'Gost', '060',
      now() + interval '2 days', now() + interval '2 days 30 min', 'Šišanje', 1000, 30, 'confirmed'
    );
  `);
  await assert.rejects(asAdmin((client, ctx) => deleteLocation(client, ctx, extra.id)), /zakazan/);
});
