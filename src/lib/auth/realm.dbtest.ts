/**
 * Granice salona koje cuva sama baza (migracija 003), nezavisno od koda aplikacije.
 * npm run test:db
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { testId } from '../test-id';
import { getPool } from '../db';

const A = testId();
const B = testId();
const LOC_B = testId();
const STAFF_A = testId();
const USER_A = testId();
const USER_B = testId();
const PLATFORM_USER = testId();
const EMAIL = `test-${A.slice(0, 8)}@primer.rs`;

const q = (sql: string, params: unknown[] = []) => getPool().query(sql, params);

before(async () => {
  await q(`INSERT INTO organizations (id, name, slug) VALUES ($1, 'A', $3), ($2, 'B', $4)`, [
    A, B, `t-${A.slice(0, 8)}`, `t-${B.slice(0, 8)}`,
  ]);
  await q(`INSERT INTO locations (id, organization_id, name) VALUES ($1, $2, 'B lok')`, [LOC_B, B]);
  await q(`INSERT INTO staff (id, organization_id, display_name) VALUES ($1, $2, 'Radnik A')`, [STAFF_A, A]);
  await q(
    `INSERT INTO users (id, organization_id, email, full_name) VALUES ($1, $2, $5, 'A'), ($3, $4, $5, 'B')`,
    [USER_A, A, USER_B, B, EMAIL],
  );
  await q(`INSERT INTO users (id, organization_id, email, full_name) VALUES ($1, NULL, $2, 'P')`, [PLATFORM_USER, EMAIL]);
});

after(async () => {
  await q('DELETE FROM users WHERE id = $1', [PLATFORM_USER]);
  await q('DELETE FROM organizations WHERE id = ANY($1::bigint[])', [[A, B]]);
  await getPool().end();
});

async function rejects(sql: string, params: unknown[], pattern: RegExp) {
  await assert.rejects(q(sql, params), (e: Error) => pattern.test(e.message));
}

test('isti email: dozvoljen u razlicitim salonima i na platformi, ali ne dvaput u istom', async () => {
  await rejects(
    `INSERT INTO users (organization_id, email, full_name) VALUES ($1, $2, 'dup')`,
    [A, EMAIL.toUpperCase()],
    /users_org_email_idx/,
  );
  await rejects(
    `INSERT INTO users (organization_id, email, full_name) VALUES (NULL, $1, 'dup')`,
    [EMAIL],
    /users_org_email_idx/,
  );
});

test('uloga samo u sopstvenom salonu; admin samo na platformi', async () => {
  await rejects(
    `INSERT INTO memberships (user_id, role, scope, organization_id) VALUES ($1, 'owner', 'organization', $2)`,
    [USER_A, B],
    /does not belong to organization/,
  );
  await rejects(
    `INSERT INTO memberships (user_id, role, scope) VALUES ($1, 'admin', 'platform')`,
    [USER_A],
    /cannot have a platform membership/,
  );
  await rejects(
    `INSERT INTO memberships (user_id, role, scope, organization_id) VALUES ($1, 'admin', 'organization', $2)`,
    [USER_A, A],
    /memberships_admin_platform_check/,
  );
  await rejects(
    `INSERT INTO memberships (user_id, role, scope, organization_id, location_id) VALUES ($1, 'manager', 'location', $2, $3)`,
    [USER_A, A, LOC_B],
    /Location .* does not belong/,
  );
  await q(`INSERT INTO memberships (user_id, role, scope, organization_id) VALUES ($1, 'owner', 'organization', $2)`, [
    USER_A,
    A,
  ]);
});

test('profil zaposlenog i termin klijenta vezuju se samo za nalog istog salona', async () => {
  await rejects(`UPDATE staff SET user_id = $1 WHERE id = $2`, [USER_B, STAFF_A], /staff_user_org_fkey/);
  await q(`UPDATE staff SET user_id = $1 WHERE id = $2`, [USER_A, STAFF_A]);

  // Brisanje naloga ostavlja profil zaposlenog, samo bez naloga
  await q('DELETE FROM users WHERE id = $1', [USER_A]);
  const staff = await q('SELECT user_id, organization_id FROM staff WHERE id = $1', [STAFF_A]);
  assert.deepEqual(staff.rows[0], { user_id: null, organization_id: A });
});

test('sesija i lozinka moraju pripadati salonu svog naloga', async () => {
  await rejects(
    `INSERT INTO sessions (token, user_id, organization_id, expires_at) VALUES ('t1', $1, $2, now() + interval '1 day')`,
    [USER_B, A],
    /violates foreign key/,
  );
  await rejects(
    `INSERT INTO sessions (token, user_id, organization_id, active_organization_id, expires_at)
     VALUES ('t2', $1, $2, $2, now() + interval '1 day')`,
    [USER_B, B],
    /sessions_check/,
  );
});
