/**
 * Panel zaposlenih nad pravom bazom: profil, lokacije/usluge, nalog, own_only nema staff.manage.
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { testId } from '../test-id';
import type { PoolClient } from 'pg';
import { getPool, withTenant } from '../db';
import { loadPanelContext, PanelError, type PanelContext, type SalonSession } from './core';
import { createStaff, createStaffLogin, getStaff, updateStaff } from './staff';

const ORG = testId();
const LOC_A = testId();
const LOC_B = testId();
const SERVICE = testId();
const OWNER_USER = testId();
const ANA_USER = testId();
const ANA = testId();

before(async () => {
  await getPool().query(`
    INSERT INTO organizations (id, name, slug) VALUES ('${ORG}', 'Staff test', 'stf-${ORG.slice(0, 8)}');
    INSERT INTO locations (id, organization_id, name) VALUES
      ('${LOC_A}', '${ORG}', 'A'), ('${LOC_B}', '${ORG}', 'B');
    INSERT INTO services (id, organization_id, name) VALUES ('${SERVICE}', '${ORG}', 'Šišanje');
    INSERT INTO users (id, organization_id, email, full_name) VALUES
      ('${OWNER_USER}', '${ORG}', 'vlasnik@test.rs', 'Vlasnik'), ('${ANA_USER}', '${ORG}', 'ana@test.rs', 'Ana');
    INSERT INTO memberships (user_id, role, scope, organization_id) VALUES
      ('${OWNER_USER}', 'owner', 'organization', '${ORG}'), ('${ANA_USER}', 'staff', 'organization', '${ORG}');
    INSERT INTO staff (id, organization_id, display_name, user_id) VALUES ('${ANA}', '${ORG}', 'Ana', '${ANA_USER}');
    INSERT INTO staff_locations (staff_id, location_id) VALUES ('${ANA}', '${LOC_A}');`);
});

after(async () => {
  await getPool().query('DELETE FROM organizations WHERE id = $1', [ORG]);
  await getPool().end();
});

function session(userId: string): SalonSession {
  return {
    realm: {
      kind: 'salon',
      organizationId: ORG,
      tenant: { id: ORG, name: 'Staff test', slug: 'stf', status: 'published', theme: {} },
    },
    user: { id: userId, name: 'u', email: 'u@test.rs', phone: null, organizationId: ORG },
    sessionId: testId(),
    activeOrganizationId: null,
  };
}

function asUser<T>(userId: string, fn: (client: PoolClient, ctx: PanelContext) => Promise<T>) {
  return withTenant(ORG, async (client) => fn(client, await loadPanelContext(client, session(userId))));
}

test('zaposleni nema staff.manage: ne moze da pravi profil', async () => {
  await assert.rejects(
    asUser(ANA_USER, (client, ctx) =>
      createStaff(client, ctx, {
        name: 'Bojan',
        title: null,
        bio: null,
        sortOrder: 0,
        locationIds: [LOC_A],
        services: [],
      }),
    ),
    PanelError,
  );
});

test('vlasnik pravi zaposlenog sa lokacijom i uslugom; audit', async () => {
  const created = await asUser(OWNER_USER, (client, ctx) =>
    createStaff(client, ctx, {
      name: 'Bojan',
      title: 'Barber',
      bio: null,
      sortOrder: 2,
      locationIds: [LOC_A, LOC_B],
      services: [{ serviceId: SERVICE, durationOverrideMin: 45 }],
    }),
  );
  const detail = await asUser(OWNER_USER, (client, ctx) => getStaff(client, ctx, created.id));
  assert.ok(detail);
  assert.equal(detail.name, 'Bojan');
  assert.equal(detail.title, 'Barber');
  assert.deepEqual(detail.locationIds.sort(), [LOC_A, LOC_B].sort());
  assert.equal(detail.services[0].durationOverrideMin, 45);
  const audit = await getPool().query(`SELECT action FROM audit_log WHERE object_id = $1`, [created.id]);
  assert.ok(audit.rows.some((r) => r.action === 'staff.create'));
});

test('skidanje lokacije brise smenu na toj lokaciji', async () => {
  const created = await asUser(OWNER_USER, (client, ctx) =>
    createStaff(client, ctx, {
      name: 'Cica',
      title: null,
      bio: null,
      sortOrder: 0,
      locationIds: [LOC_A, LOC_B],
      services: [],
    }),
  );
  const tpl = testId();
  await getPool().query(
    `INSERT INTO shift_templates (id, location_id, name, starts_at, ends_at) VALUES ($1, $2, 'Dan', '09:00', '17:00')`,
    [tpl, LOC_B],
  );
  await getPool().query(
    `INSERT INTO weekly_schedule (staff_id, location_id, weekday, shift_template_id) VALUES ($1, $2, 0, $3)`,
    [created.id, LOC_B, tpl],
  );
  await asUser(OWNER_USER, (client, ctx) =>
    updateStaff(client, ctx, {
      staffId: created.id,
      name: 'Cica',
      title: null,
      bio: null,
      isActive: true,
      sortOrder: 0,
      locationIds: [LOC_A],
      services: [],
    }),
  );
  const leftover = await getPool().query(
    `SELECT 1 FROM weekly_schedule WHERE staff_id = $1 AND location_id = $2`,
    [created.id, LOC_B],
  );
  assert.equal(leftover.rowCount, 0);
});

test('nalog: novi email dobija lozinku; isti email u salonu se veze', async () => {
  const created = await asUser(OWNER_USER, (client, ctx) =>
    createStaff(client, ctx, {
      name: 'Darko',
      title: null,
      bio: null,
      sortOrder: 0,
      locationIds: [LOC_A],
      services: [],
    }),
  );
  const login = await asUser(OWNER_USER, (client, ctx) =>
    createStaffLogin(client, ctx, { staffId: created.id, email: 'darko@test.rs', password: 'lozinka-8-znakova' }),
  );
  assert.equal(login.kind, 'created');
  assert.equal(login.password, 'lozinka-8-znakova');
  const user = await getPool().query(`SELECT email FROM users WHERE id = (SELECT user_id FROM staff WHERE id = $1)`, [
    created.id,
  ]);
  assert.equal(user.rows[0].email, 'darko@test.rs');
  const loginAudit = await getPool().query<{ new_value: { password?: string; linkedExisting: boolean } }>(
    `SELECT new_value FROM audit_log WHERE action = 'staff.login.create' AND object_id = $1`,
    [created.id],
  );
  assert.equal(loginAudit.rows[0].new_value.password, undefined);
  assert.equal(loginAudit.rows[0].new_value.linkedExisting, false);

  const other = await asUser(OWNER_USER, (client, ctx) =>
    createStaff(client, ctx, {
      name: 'Ema',
      title: null,
      bio: null,
      sortOrder: 0,
      locationIds: [LOC_A],
      services: [],
    }),
  );
  await assert.rejects(
    asUser(OWNER_USER, (client, ctx) =>
      createStaffLogin(client, ctx, { staffId: other.id, email: 'darko@test.rs', password: null }),
    ),
    /vezan/,
  );

  const clientUser = testId();
  await getPool().query(
    `INSERT INTO users (id, organization_id, email, full_name) VALUES ($1, $2, 'klijent@test.rs', 'Klijent')`,
    [clientUser, ORG],
  );
  const linked = await asUser(OWNER_USER, (client, ctx) =>
    createStaffLogin(client, ctx, { staffId: other.id, email: 'klijent@test.rs', password: null }),
  );
  assert.equal(linked.kind, 'linked');
  const membership = await getPool().query(
    `SELECT role FROM memberships WHERE user_id = $1 AND role = 'staff'`,
    [clientUser],
  );
  assert.equal(membership.rowCount, 1);
});
