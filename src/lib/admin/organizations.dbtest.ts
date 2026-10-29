/**
 * Admin pravi salon: slug, prvi objekat, audit, ulazak u sesiju.
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { testId } from '../test-id';
import { getPool } from '../db';
import { AdminError, type PlatformSession } from './core';
import { createOrganization, deleteOrganization } from './organizations';

const ADMIN_USER = testId();
const SESSION = testId();
const SLUG = `ns-${ADMIN_USER.slice(0, 8)}`;

before(async () => {
  await getPool().query(`
    INSERT INTO users (id, organization_id, email, full_name) VALUES
      ('${ADMIN_USER}', NULL, 'admin-orgs@test.rs', 'Admin');
    INSERT INTO memberships (user_id, role, scope, organization_id) VALUES
      ('${ADMIN_USER}', 'admin', 'platform', NULL);
    INSERT INTO sessions (id, token, user_id, organization_id, expires_at)
      VALUES ('${SESSION}', 'tok-${SESSION}', '${ADMIN_USER}', NULL, now() + interval '1 day');
  `);
});

after(async () => {
  await getPool().query(`DELETE FROM organizations WHERE slug LIKE $1`, [`%${ADMIN_USER.slice(0, 8)}%`]);
  await getPool().query('DELETE FROM users WHERE id = $1', [ADMIN_USER]);
  await getPool().end();
});

function session(): PlatformSession {
  return {
    realm: { kind: 'platform' },
    user: { id: ADMIN_USER, name: 'Admin', email: 'admin-orgs@test.rs', phone: null, organizationId: null },
    sessionId: SESSION,
    activeOrganizationId: null,
  };
}

test('pravi salon sa objektom, audit i ulazak u sesiju', async () => {
  const client = await getPool().connect();
  let created: { id: string; locationId: string };
  try {
    await client.query('BEGIN');
    created = await createOrganization(client, session(), {
      name: 'Novi salon',
      slug: SLUG,
      locationName: 'Glavni',
    });
    await client.query('COMMIT');
  } finally {
    client.release();
  }

  const org = await getPool().query<{ name: string; status: string }>(
    `SELECT name, status FROM organizations WHERE id = $1`,
    [created.id],
  );
  assert.equal(org.rows[0].name, 'Novi salon');
  assert.equal(org.rows[0].status, 'draft');

  const loc = await getPool().query<{ name: string }>(
    `SELECT name FROM locations WHERE id = $1 AND organization_id = $2`,
    [created.locationId, created.id],
  );
  assert.equal(loc.rows[0].name, 'Glavni');

  const audit = await getPool().query<{ action: string }>(
    `SELECT action FROM audit_log WHERE organization_id = $1 AND object_type = 'organization' ORDER BY action`,
    [created.id],
  );
  assert.deepEqual(
    audit.rows.map((r) => r.action),
    ['admin.enter_organization', 'organization.create'],
  );

  const sess = await getPool().query<{ active_organization_id: string }>(
    `SELECT active_organization_id FROM sessions WHERE id = $1`,
    [SESSION],
  );
  assert.equal(sess.rows[0].active_organization_id, created.id);
});

test('isti slug se odbija', async () => {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await assert.rejects(
      createOrganization(client, session(), {
        name: 'Drugi',
        slug: SLUG,
        locationName: 'X',
      }),
      AdminError,
    );
    await client.query('ROLLBACK');
  } finally {
    client.release();
  }
});

test('briše salon i čisti sesiju', async () => {
  const slug = `nd-${ADMIN_USER.slice(0, 8)}`;
  const client = await getPool().connect();
  let orgId: string;
  try {
    await client.query('BEGIN');
    const created = await createOrganization(client, session(), {
      name: 'Za brisanje',
      slug,
      locationName: 'Jedini',
    });
    orgId = created.id;
    await client.query('COMMIT');
  } finally {
    client.release();
  }

  const del = await getPool().connect();
  try {
    await del.query('BEGIN');
    await deleteOrganization(del, session(), orgId);
    await del.query('COMMIT');
  } finally {
    del.release();
  }

  const gone = await getPool().query(`SELECT 1 FROM organizations WHERE id = $1`, [orgId]);
  assert.equal(gone.rowCount, 0);
  const sess = await getPool().query<{ active_organization_id: string | null }>(
    `SELECT active_organization_id FROM sessions WHERE id = $1`,
    [SESSION],
  );
  assert.equal(sess.rows[0].active_organization_id, null);
});

test('ne briše salon sa budućim terminom', async () => {
  const slug = `nf-${ADMIN_USER.slice(0, 8)}`;
  const client = await getPool().connect();
  let orgId: string;
  let locationId: string;
  try {
    await client.query('BEGIN');
    const created = await createOrganization(client, session(), {
      name: 'Sa terminom',
      slug,
      locationName: 'Obj',
    });
    orgId = created.id;
    locationId = created.locationId;
    await client.query('COMMIT');
  } finally {
    client.release();
  }

  const staff = testId();
  const service = testId();
  await getPool().query(`
    INSERT INTO services (id, organization_id, name) VALUES ('${service}', '${orgId}', 'U');
    INSERT INTO staff (id, organization_id, display_name) VALUES ('${staff}', '${orgId}', 'R');
    INSERT INTO appointments (
      organization_id, location_id, staff_id, service_id, guest_name, guest_phone,
      starts_at, ends_at, service_name_snapshot, price_snapshot, duration_snapshot_min, status
    ) VALUES (
      '${orgId}', '${locationId}', '${staff}', '${service}', 'Gost', '060',
      now() + interval '2 days', now() + interval '2 days 30 min', 'U', 1000, 30, 'confirmed'
    );
  `);

  const del = await getPool().connect();
  try {
    await del.query('BEGIN');
    await assert.rejects(deleteOrganization(del, session(), orgId), /zakazan/);
    await del.query('ROLLBACK');
  } finally {
    del.release();
  }
});
