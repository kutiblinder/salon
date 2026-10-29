/**
 * Admin pravi naloge u salonu: vlasnik / menadzer / zaposleni, audit bez lozinke.
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { testId } from '../test-id';
import type { PoolClient } from 'pg';
import { getPool, withTenant } from '../db';
import { loadAdminContext, AdminError, type AdminContext, type PlatformSession } from './core';
import { createSalonAccount, listSalonAccounts } from './accounts';

const ORG = testId();
const LOC = testId();
const OTHER = testId();
const ADMIN_USER = testId();
const CLIENT_USER = testId();

before(async () => {
  await getPool().query(`
    INSERT INTO organizations (id, name, slug, status) VALUES
      ('${ORG}', 'Accounts salon', 'as-${ORG.slice(0, 8)}', 'draft'),
      ('${OTHER}', 'Other salon', 'ao-${OTHER.slice(0, 8)}', 'published');
    INSERT INTO locations (id, organization_id, name) VALUES ('${LOC}', '${ORG}', 'A');
    INSERT INTO users (id, organization_id, email, full_name) VALUES
      ('${ADMIN_USER}', NULL, 'admin-accounts@test.rs', 'Admin'),
      ('${CLIENT_USER}', '${ORG}', 'klijent-acc@test.rs', 'Klijent');
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
    user: { id: ADMIN_USER, name: 'Admin', email: 'admin-accounts@test.rs', phone: null, organizationId: null },
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

test('pravi vlasnika i zaposlenog sa profilom; lozinka nije u auditu', async () => {
  const owner = await asAdmin((client, ctx) =>
    createSalonAccount(client, ctx, {
      name: 'Vlasnik Test',
      email: 'vlasnik-acc@test.rs',
      role: 'owner',
      password: 'lozinka12',
    }),
  );
  assert.equal(owner.kind, 'created');
  if (owner.kind !== 'created') return;
  assert.equal(owner.password, 'lozinka12');

  const staff = await asAdmin((client, ctx) =>
    createSalonAccount(client, ctx, {
      name: 'Radnik Test',
      email: 'radnik-acc@test.rs',
      role: 'staff',
      password: null,
    }),
  );
  assert.equal(staff.kind, 'created');
  if (staff.kind !== 'created') return;
  assert.ok(staff.password.length >= 8);

  const staffRow = await getPool().query<{ display_name: string; location_id: string }>(
    `SELECT s.display_name, sl.location_id
       FROM staff s JOIN staff_locations sl ON sl.staff_id = s.id
      WHERE s.organization_id = $1 AND s.user_id = (
        SELECT id FROM users WHERE email = 'radnik-acc@test.rs' AND organization_id = $1
      )`,
    [ORG],
  );
  assert.equal(staffRow.rows[0].display_name, 'Radnik Test');
  assert.equal(staffRow.rows[0].location_id, LOC);

  const listed = await asAdmin((client, ctx) => listSalonAccounts(client, ctx));
  assert.deepEqual(
    listed.map((a) => ({ email: a.email, roles: a.roles })),
    [
      { email: 'radnik-acc@test.rs', roles: ['staff'] },
      { email: 'vlasnik-acc@test.rs', roles: ['owner'] },
    ],
  );

  const audit = await getPool().query<{ new_value: { password?: unknown; email: string } }>(
    `SELECT new_value FROM audit_log WHERE organization_id = $1 AND action = 'user.create'`,
    [ORG],
  );
  assert.ok(audit.rows.length >= 2);
  for (const row of audit.rows) {
    assert.equal(row.new_value.password, undefined);
    assert.ok(row.new_value.email);
  }
});

test('postojeci klijent dobija ulogu; ista uloga se odbija', async () => {
  const linked = await asAdmin((client, ctx) =>
    createSalonAccount(client, ctx, {
      name: 'Klijent',
      email: 'klijent-acc@test.rs',
      role: 'manager',
      password: 'nece-se-koristiti',
    }),
  );
  assert.equal(linked.kind, 'linked');

  await assert.rejects(
    asAdmin((client, ctx) =>
      createSalonAccount(client, ctx, {
        name: 'Klijent',
        email: 'klijent-acc@test.rs',
        role: 'manager',
        password: null,
      }),
    ),
    AdminError,
  );
});
