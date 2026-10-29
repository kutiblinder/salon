/**
 * Admin galerija: upload WebP, kvota, izolacija salona, audit.
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { testId } from '../test-id';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { PoolClient } from 'pg';
import { getPool, withTenant } from '../db';
import { getObject } from '../storage';
import { loadAdminContext, AdminError, type AdminContext, type PlatformSession } from './core';
import { addGalleryImage, deleteGalleryItem, listGallery, updateGalleryItem } from './gallery';

const ORG = testId();
const OTHER = testId();
const LOC = testId();
const LOC_OTHER = testId();
const ADMIN_USER = testId();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'salon-gallery-'));

process.env.STORAGE_DIR = TMP;

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

before(async () => {
  await getPool().query(`
    INSERT INTO organizations (id, name, slug) VALUES
      ('${ORG}', 'Gallery test', 'gl-${ORG.slice(0, 8)}'),
      ('${OTHER}', 'Other', 'go-${OTHER.slice(0, 8)}');
    INSERT INTO locations (id, organization_id, name) VALUES
      ('${LOC}', '${ORG}', 'A'), ('${LOC_OTHER}', '${OTHER}', 'X');
    INSERT INTO users (id, organization_id, email, full_name) VALUES
      ('${ADMIN_USER}', NULL, 'admin-gallery@test.rs', 'Admin');
    INSERT INTO memberships (user_id, role, scope, organization_id) VALUES
      ('${ADMIN_USER}', 'admin', 'platform', NULL);
  `);
});

after(async () => {
  await getPool().query('DELETE FROM organizations WHERE id IN ($1, $2)', [ORG, OTHER]);
  await getPool().query('DELETE FROM users WHERE id = $1', [ADMIN_USER]);
  await getPool().end();
  fs.rmSync(TMP, { recursive: true, force: true });
});

function session(orgId: string | null): PlatformSession {
  return {
    realm: { kind: 'platform' },
    user: { id: ADMIN_USER, name: 'Admin', email: 'admin-gallery@test.rs', phone: null, organizationId: null },
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

test('admin dodaje sliku; fajl je WebP; audit', async () => {
  const created = await asAdmin(ORG, (client, ctx) =>
    addGalleryImage(client, ctx, {
      bytes: PNG_1X1,
      altText: 'Fade',
      caption: 'Primer',
      locationId: LOC,
    }),
  );
  const items = await asAdmin(ORG, (client, ctx) => listGallery(client, ctx));
  assert.equal(items.length, 1);
  assert.equal(items[0].altText, 'Fade');
  assert.equal(items[0].locationId, LOC);
  const stored = await getObject(`${ORG}/${created.mediaId}.webp`);
  assert.ok(stored && stored.length > 0);
  assert.equal(stored.toString('ascii', 0, 4), 'RIFF');
  const audit = await getPool().query(`SELECT action FROM audit_log WHERE object_id = $1`, [created.id]);
  assert.ok(audit.rows.some((r) => r.action === 'gallery.create'));
});

test('lokacija drugog salona se odbija; drugi salon ne vidi slike', async () => {
  await assert.rejects(
    asAdmin(ORG, (client, ctx) =>
      addGalleryImage(client, ctx, { bytes: PNG_1X1, altText: 'X', caption: null, locationId: LOC_OTHER }),
    ),
    AdminError,
  );
  const list = await asAdmin(OTHER, (client, ctx) => listGallery(client, ctx));
  assert.equal(list.length, 0);
});

test('izmena alt teksta i brisanje uklanja fajl', async () => {
  const created = await asAdmin(ORG, (client, ctx) =>
    addGalleryImage(client, ctx, { bytes: PNG_1X1, altText: 'Staro', caption: null, locationId: null }),
  );
  await asAdmin(ORG, (client, ctx) =>
    updateGalleryItem(client, ctx, { id: created.id, altText: 'Novo', caption: 'opis', locationId: LOC }),
  );
  const items = await asAdmin(ORG, (client, ctx) => listGallery(client, ctx));
  const row = items.find((i) => i.id === created.id);
  assert.equal(row?.altText, 'Novo');
  assert.equal(row?.caption, 'opis');
  await asAdmin(ORG, (client, ctx) => deleteGalleryItem(client, ctx, created.id));
  assert.equal(await getObject(`${ORG}/${created.mediaId}.webp`), null);
});
