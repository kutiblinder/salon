/**
 * Admin pregled audit logova: samo salon iz sesije, najnoviji prvi.
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { testId } from '../test-id';
import type { PoolClient } from 'pg';
import { writeAudit } from '../audit';
import { getPool, withTenant } from '../db';
import { listAuditLogs } from './audit';
import { loadAdminContext, AdminError, type AdminContext, type PlatformSession } from './core';

const ORG = testId();
const OTHER = testId();
const ADMIN_USER = testId();
const OWNER_USER = testId();

before(async () => {
  await getPool().query(`
    INSERT INTO organizations (id, name, slug, status) VALUES
      ('${ORG}', 'Audit salon', 'au-${ORG.slice(0, 8)}', 'draft'),
      ('${OTHER}', 'Other salon', 'ao-${OTHER.slice(0, 8)}', 'published');
    INSERT INTO users (id, organization_id, email, full_name) VALUES
      ('${ADMIN_USER}', NULL, 'admin-audit@test.rs', 'Admin'),
      ('${OWNER_USER}', '${ORG}', 'owner-audit@test.rs', 'Vlasnik');
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
    user: { id: ADMIN_USER, name: 'Admin', email: 'admin-audit@test.rs', phone: null, organizationId: null },
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

test('lista samo zapise izabranog salona, najnoviji prvi, sa imenom naloga', async () => {
  await asAdmin(ORG, async (client, ctx) => {
    await writeAudit(client, {
      organizationId: ctx.organizationId,
      userId: ADMIN_USER,
      action: 'content.update',
      objectType: 'organization',
      objectId: ORG,
      oldValue: { name: 'Staro' },
      newValue: { name: 'Novo' },
    });
    await writeAudit(client, {
      organizationId: ctx.organizationId,
      userId: OWNER_USER,
      action: 'appointment.create',
      objectType: 'appointment',
      objectId: '99',
    });
  });
  await asAdmin(OTHER, async (client, ctx) => {
    await writeAudit(client, {
      organizationId: ctx.organizationId,
      userId: ADMIN_USER,
      action: 'gallery.create',
      objectType: 'gallery_item',
      objectId: '1',
    });
  });

  const rows = await asAdmin(ORG, (client, ctx) => listAuditLogs(client, ctx));
  assert.ok(rows.length >= 2);
  assert.equal(rows[0].action, 'appointment.create');
  assert.equal(rows[0].actorName, 'Vlasnik');
  assert.equal(rows[0].actorEmail, 'owner-audit@test.rs');
  assert.equal(rows[1].action, 'content.update');
  assert.deepEqual(rows[1].newValue, { name: 'Novo' });
  assert.equal(
    rows.some((r) => r.action === 'gallery.create'),
    false,
  );
});

test('bez naloga (skripta) ostaje u listi kao zapis bez glumca', async () => {
  await asAdmin(ORG, async (client, ctx) => {
    await writeAudit(client, {
      organizationId: ctx.organizationId,
      userId: null,
      action: 'user.create',
      objectType: 'membership',
      objectId: OWNER_USER,
      newValue: { email: 'x@y.rs', password: 'ne-sme' },
    });
  });
  const rows = await asAdmin(ORG, (client, ctx) => listAuditLogs(client, ctx, 1));
  assert.equal(rows[0].action, 'user.create');
  assert.equal(rows[0].actorName, null);
  assert.equal(rows[0].actorEmail, null);
  assert.deepEqual(rows[0].newValue, { email: 'x@y.rs', password: 'ne-sme' });
});
