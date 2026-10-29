/**
 * Admin sadrzaj nad pravom bazom: salon iz sesije, audit, istorija.
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { testId } from '../test-id';
import type { PoolClient } from 'pg';
import { getPool, withTenant } from '../db';
import { loadAdminContext, AdminError, type AdminContext, type PlatformSession } from './core';
import { loadContent, saveContent } from './content';

const ORG = testId();
const OTHER = testId();
const ADMIN_USER = testId();
const OWNER_USER = testId();

before(async () => {
  await getPool().query(`
    INSERT INTO organizations (id, name, slug, status) VALUES
      ('${ORG}', 'Admin content', 'ac-${ORG.slice(0, 8)}', 'draft'),
      ('${OTHER}', 'Other salon', 'ot-${OTHER.slice(0, 8)}', 'published');
    INSERT INTO users (id, organization_id, email, full_name) VALUES
      ('${ADMIN_USER}', NULL, 'admin-content@test.rs', 'Admin'),
      ('${OWNER_USER}', '${ORG}', 'owner-content@test.rs', 'Vlasnik');
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

function session(activeOrganizationId: string | null): PlatformSession {
  return {
    realm: { kind: 'platform' },
    user: { id: ADMIN_USER, name: 'Admin', email: 'admin-content@test.rs', phone: null, organizationId: null },
    sessionId: testId(),
    activeOrganizationId,
  };
}

function asAdmin<T>(orgId: string | null, fn: (client: PoolClient, ctx: AdminContext) => Promise<T>) {
  return withTenant(orgId ?? ORG, async (client) => {
    const ctx = await loadAdminContext(client, session(orgId));
    if (!ctx) throw new AdminError('nema salona');
    return fn(client, ctx);
  });
}

test('bez ulaska u salon nema konteksta', async () => {
  const ctx = await withTenant(ORG, (client) => loadAdminContext(client, session(null)));
  assert.equal(ctx, null);
});

test('admin u salonu snima tekst, boju i status; audit i istorija', async () => {
  await asAdmin(ORG, (client, ctx) =>
    saveContent(client, ctx, {
      name: 'Novi naziv',
      status: 'published',
      primaryColor: '#112233',
      values: { 'home.hero_title': 'Frizer Zemun', 'about.body': 'Prva verzija' },
    }),
  );
  const row = await getPool().query<{ value: unknown; version: number }>(
    `SELECT value, version FROM site_content WHERE organization_id = $1 AND page = 'home' AND key = 'hero_title'`,
    [ORG],
  );
  assert.equal(row.rows[0].value, 'Frizer Zemun');
  assert.equal(row.rows[0].version, 1);

  await asAdmin(ORG, (client, ctx) =>
    saveContent(client, ctx, {
      name: 'Novi naziv',
      status: 'published',
      primaryColor: '#112233',
      values: { 'home.hero_title': 'Frizer Zemun 2', 'about.body': 'Prva verzija' },
    }),
  );
  const history = await getPool().query(
    `SELECT h.value FROM site_content_history h
       JOIN site_content s ON s.id = h.site_content_id
      WHERE s.organization_id = $1 AND s.key = 'hero_title'`,
    [ORG],
  );
  assert.equal(history.rows[0].value, 'Frizer Zemun');
  const audit = await getPool().query(`SELECT action, new_value FROM audit_log WHERE organization_id = $1 AND action = 'content.update'`, [
    ORG,
  ]);
  assert.ok(audit.rowCount && audit.rowCount >= 1);
  const org = await getPool().query<{ name: string; status: string; theme: { primaryColor: string } }>(
    `SELECT name, status, theme FROM organizations WHERE id = $1`,
    [ORG],
  );
  assert.equal(org.rows[0].name, 'Novi naziv');
  assert.equal(org.rows[0].status, 'published');
  assert.equal(org.rows[0].theme.primaryColor, '#112233');
});

test('admin u drugom salonu ne vidi sadrzaj prvog', async () => {
  const bundle = await asAdmin(OTHER, (client, ctx) => loadContent(client, ctx));
  assert.equal(bundle.values['home.hero_title'], '');
  assert.equal(bundle.salon.id, OTHER);
});

test('nalog salona nije admin platforme', async () => {
  await assert.rejects(
    withTenant(ORG, (client) =>
      loadAdminContext(client, {
        realm: { kind: 'platform' },
        user: { id: OWNER_USER, name: 'V', email: 'owner-content@test.rs', phone: null, organizationId: ORG },
        sessionId: testId(),
        activeOrganizationId: ORG,
      }),
    ),
    AdminError,
  );
});
