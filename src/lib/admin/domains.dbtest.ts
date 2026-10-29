/**
 * Custom domeni: CRUD u salonu iz sesije, izolacija, audit.
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { testId } from '../test-id';
import type { PoolClient } from 'pg';
import { getPool, withTenant } from '../db';
import { loadAdminContext, AdminError, type AdminContext, type PlatformSession } from './core';
import { resolveTenantByHost } from '../tenant';
import { isTlsIssuanceAllowed } from '../tls-ask';
import { addDomain, deleteDomain, listDomains, setDomainVerified } from './domains';

const ORG = testId();
const OTHER = testId();
const ADMIN_USER = testId();
const DOMAIN = `t-${ORG.slice(0, 8)}.example.rs`;

before(async () => {
  await getPool().query(`
    INSERT INTO organizations (id, name, slug, status) VALUES
      ('${ORG}', 'Domain salon', 'ds-${ORG.slice(0, 8)}', 'draft'),
      ('${OTHER}', 'Other salon', 'do-${OTHER.slice(0, 8)}', 'published');
    INSERT INTO users (id, organization_id, email, full_name) VALUES
      ('${ADMIN_USER}', NULL, 'admin-domains@test.rs', 'Admin');
    INSERT INTO memberships (user_id, role, scope, organization_id) VALUES
      ('${ADMIN_USER}', 'admin', 'platform', NULL);
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
    user: { id: ADMIN_USER, name: 'Admin', email: 'admin-domains@test.rs', phone: null, organizationId: null },
    sessionId: testId(),
    activeOrganizationId,
  };
}

function asAdmin<T>(orgId: string, fn: (client: PoolClient, ctx: AdminContext) => Promise<T>) {
  return withTenant(orgId, async (client) => {
    const ctx = await loadAdminContext(client, session(orgId));
    if (!ctx) throw new AdminError('nema salona');
    return fn(client, ctx);
  });
}

test('admin dodaje, proverava i brise domen; drugi salon ga ne vidi', async () => {
  await asAdmin(ORG, (client, ctx) => addDomain(client, ctx, DOMAIN));
  assert.equal(await isTlsIssuanceAllowed(DOMAIN), false);
  const listed = await asAdmin(ORG, (client, ctx) => listDomains(client, ctx));
  assert.equal(listed.length, 1);
  assert.equal(listed[0].domain, DOMAIN);
  assert.equal(listed[0].verifiedAt, null);

  await asAdmin(ORG, (client, ctx) => setDomainVerified(client, ctx, DOMAIN, true));
  assert.equal(await isTlsIssuanceAllowed(DOMAIN), true);
  assert.equal(await isTlsIssuanceAllowed(`www.${DOMAIN}`), true);
  const tenant = await resolveTenantByHost(`www.${DOMAIN}`);
  assert.equal(tenant?.id, ORG);
  const verified = await asAdmin(ORG, (client, ctx) => listDomains(client, ctx));
  assert.ok(verified[0].verifiedAt);

  const other = await asAdmin(OTHER, (client, ctx) => listDomains(client, ctx));
  assert.equal(other.length, 0);

  await assert.rejects(
    () => asAdmin(OTHER, (client, ctx) => addDomain(client, ctx, DOMAIN)),
    (e: unknown) => e instanceof AdminError,
  );

  const audit = await getPool().query<{ action: string }>(
    `SELECT action FROM audit_log WHERE object_id = $1 ORDER BY id`,
    [DOMAIN],
  );
  assert.deepEqual(
    audit.rows.map((r) => r.action),
    ['domains.add', 'domains.verify'],
  );

  await asAdmin(ORG, (client, ctx) => deleteDomain(client, ctx, DOMAIN));
  const empty = await asAdmin(ORG, (client, ctx) => listDomains(client, ctx));
  assert.equal(empty.length, 0);
});
