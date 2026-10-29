/**
 * Admin cenovnik: katalog + cena po lokaciji, audit, izolacija salona.
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { testId } from '../test-id';
import type { PoolClient } from 'pg';
import { getPool, withTenant } from '../db';
import { loadAdminContext, AdminError, type AdminContext, type PlatformSession } from './core';
import { createService, getService, listServices, updateService } from './prices';

const ORG = testId();
const OTHER = testId();
const LOC_A = testId();
const LOC_B = testId();
const LOC_OTHER = testId();
const ADMIN_USER = testId();
const OWNER_USER = testId();

before(async () => {
  await getPool().query(`
    INSERT INTO organizations (id, name, slug) VALUES
      ('${ORG}', 'Prices test', 'pr-${ORG.slice(0, 8)}'),
      ('${OTHER}', 'Other', 'ot-${OTHER.slice(0, 8)}');
    INSERT INTO locations (id, organization_id, name) VALUES
      ('${LOC_A}', '${ORG}', 'A'), ('${LOC_B}', '${ORG}', 'B'), ('${LOC_OTHER}', '${OTHER}', 'X');
    INSERT INTO users (id, organization_id, email, full_name) VALUES
      ('${ADMIN_USER}', NULL, 'admin-prices@test.rs', 'Admin'),
      ('${OWNER_USER}', '${ORG}', 'owner-prices@test.rs', 'Vlasnik');
    INSERT INTO memberships (user_id, role, scope, organization_id) VALUES
      ('${ADMIN_USER}', 'admin', 'platform', NULL),
      ('${OWNER_USER}', 'owner', 'organization', '${ORG}');
  `);
});

after(async () => {
  await getPool().query('DELETE FROM organizations WHERE id IN ($1, $2)', [ORG, OTHER]);
  await getPool().query('DELETE FROM users WHERE id = $1', [ADMIN_USER]);
  await getPool().end();
});

function session(orgId: string | null): PlatformSession {
  return {
    realm: { kind: 'platform' },
    user: { id: ADMIN_USER, name: 'Admin', email: 'admin-prices@test.rs', phone: null, organizationId: null },
    sessionId: testId(),
    activeOrganizationId: orgId,
  };
}

function asAdmin<T>(orgId: string, fn: (client: PoolClient, ctx: AdminContext) => Promise<T>) {
  return withTenant(orgId, async (client) => {
    const ctx = await loadAdminContext(client, session(orgId));
    if (!ctx) throw new AdminError('nema salona');
    return fn(client, ctx);
  });
}

test('vlasnik salona nije admin platforme', async () => {
  await assert.rejects(
    withTenant(ORG, (client) =>
      loadAdminContext(client, {
        realm: { kind: 'platform' },
        user: { id: OWNER_USER, name: 'V', email: 'owner-prices@test.rs', phone: null, organizationId: ORG },
        sessionId: testId(),
        activeOrganizationId: ORG,
      }),
    ),
    AdminError,
  );
});

test('admin pravi uslugu sa cenom po lokaciji; audit', async () => {
  const created = await asAdmin(ORG, (client, ctx) =>
    createService(client, ctx, {
      name: 'Fade',
      description: 'Mašinica',
      sortOrder: 1,
      offers: [{ locationId: LOC_A, price: '1800.00', durationMin: 60, bufferMin: 0 }],
    }),
  );
  const detail = await asAdmin(ORG, (client, ctx) => getService(client, ctx, created.id));
  assert.ok(detail);
  assert.equal(detail.name, 'Fade');
  assert.equal(detail.offers.length, 1);
  assert.equal(Number(detail.offers[0].price), 1800);
  const audit = await getPool().query(`SELECT action FROM audit_log WHERE object_id = $1`, [created.id]);
  assert.ok(audit.rows.some((r) => r.action === 'services.create'));
});

test('skidanje lokacije brise ponudu; dodavanje na B upisuje cenu', async () => {
  const created = await asAdmin(ORG, (client, ctx) =>
    createService(client, ctx, {
      name: 'Klasik',
      description: null,
      sortOrder: 0,
      offers: [
        { locationId: LOC_A, price: '1200.00', durationMin: 30, bufferMin: 0 },
        { locationId: LOC_B, price: '1400.00', durationMin: 30, bufferMin: 5 },
      ],
    }),
  );
  await asAdmin(ORG, (client, ctx) =>
    updateService(client, ctx, {
      serviceId: created.id,
      name: 'Klasik',
      description: null,
      isActive: true,
      sortOrder: 0,
      offers: [{ locationId: LOC_B, price: '1500.00', durationMin: 35, bufferMin: 5 }],
    }),
  );
  const leftover = await getPool().query(
    `SELECT location_id, price::text AS price, duration_min FROM location_services WHERE service_id = $1`,
    [created.id],
  );
  assert.equal(leftover.rowCount, 1);
  assert.equal(leftover.rows[0].location_id, LOC_B);
  assert.equal(Number(leftover.rows[0].price), 1500);
  assert.equal(leftover.rows[0].duration_min, 35);
  const audit = await getPool().query(`SELECT action FROM audit_log WHERE object_id = $1 AND action = 'prices.update'`, [
    created.id,
  ]);
  assert.equal(audit.rowCount, 1);
});

test('lokacija drugog salona se odbija; lista vidi samo svoj katalog', async () => {
  await assert.rejects(
    asAdmin(ORG, (client, ctx) =>
      createService(client, ctx, {
        name: 'Tudja',
        description: null,
        sortOrder: 0,
        offers: [{ locationId: LOC_OTHER, price: '100.00', durationMin: 10, bufferMin: 0 }],
      }),
    ),
    AdminError,
  );
  const list = await asAdmin(OTHER, (client, ctx) => listServices(client, ctx));
  assert.equal(list.length, 0);
});
