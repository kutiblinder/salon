import type { PoolClient } from 'pg';
import { writeAudit } from '../audit';
import { sniffImage, toWebp } from '../images';
import { isUuid } from '../panel/schedule';
import { deleteObject, putObject } from '../storage';
import { AdminError, type AdminContext } from './core';
import {
  GALLERY_MAX_ITEMS,
  GALLERY_MAX_TOTAL_BYTES,
  GALLERY_MAX_UPLOAD_BYTES,
  type GalleryItem,
} from './gallery-types';
import { loadAdminLocations } from './prices';

export type { GalleryItem } from './gallery-types';
export {
  GALLERY_MAX_ITEMS,
  GALLERY_MAX_TOTAL_BYTES,
  GALLERY_MAX_UPLOAD_BYTES,
} from './gallery-types';

export function parseAltText(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string') return null;
  const text = raw.trim().replace(/\s+/g, ' ');
  if (text.length === 0) return null;
  if (text.length > 120) return null;
  return text;
}

export function parseCaption(raw: unknown): string | null | undefined {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string') return undefined;
  const text = raw.trim().replace(/\s+/g, ' ');
  if (text.length === 0) return null;
  if (text.length > 200) return undefined;
  return text;
}

export function parseOptionalLocationId(raw: unknown): string | null | undefined {
  if (raw === undefined || raw === null || raw === '') return null;
  if (!isUuid(raw)) return undefined;
  return raw.toLowerCase();
}

export async function listGallery(client: PoolClient, ctx: AdminContext): Promise<GalleryItem[]> {
  ctx.require('gallery.edit');
  const res = await client.query<{
    id: string;
    media_id: string;
    alt_text: string | null;
    caption: string | null;
    sort_order: number;
    location_id: string | null;
    location_name: string | null;
    width: number | null;
    height: number | null;
    size_bytes: string | null;
  }>(
    `SELECT g.id, g.media_id, g.alt_text, g.caption, g.sort_order, g.location_id,
            l.name AS location_name, m.width, m.height, m.size_bytes::text
       FROM gallery_items g
       JOIN media m ON m.id = g.media_id
       LEFT JOIN locations l ON l.id = g.location_id
      WHERE g.organization_id = $1
      ORDER BY g.sort_order, g.id`,
    [ctx.organizationId],
  );
  return res.rows.map((r) => ({
    id: r.id,
    mediaId: r.media_id,
    altText: r.alt_text,
    caption: r.caption,
    sortOrder: r.sort_order,
    locationId: r.location_id,
    locationName: r.location_name,
    width: r.width,
    height: r.height,
    sizeBytes: r.size_bytes ? Number(r.size_bytes) : null,
  }));
}

async function assertLocation(client: PoolClient, organizationId: string, locationId: string | null) {
  if (!locationId) return;
  const res = await client.query(
    `SELECT 1 FROM locations WHERE id = $1 AND organization_id = $2 AND is_active`,
    [locationId, organizationId],
  );
  if (!res.rows[0]) throw new AdminError('Lokacija ne postoji.');
}

export async function addGalleryImage(
  client: PoolClient,
  ctx: AdminContext,
  input: { bytes: Buffer; altText: string; caption: string | null; locationId: string | null },
): Promise<{ id: string; mediaId: string }> {
  ctx.require('gallery.edit');
  if (input.bytes.length === 0 || input.bytes.length > GALLERY_MAX_UPLOAD_BYTES) {
    throw new AdminError('Slika mora biti do 5 MB.');
  }
  if (!sniffImage(input.bytes)) throw new AdminError('Slika mora biti JPEG, PNG ili WebP.');

  const counts = await client.query<{ n: number; bytes: string }>(
    `SELECT count(*)::int AS n, coalesce(sum(m.size_bytes), 0)::text AS bytes
       FROM gallery_items g JOIN media m ON m.id = g.media_id
      WHERE g.organization_id = $1`,
    [ctx.organizationId],
  );
  if (counts.rows[0].n >= GALLERY_MAX_ITEMS) {
    throw new AdminError(`Galerija može imati najviše ${GALLERY_MAX_ITEMS} slika.`);
  }

  const webp = await toWebp(input.bytes);
  if (Number(counts.rows[0].bytes) + webp.buffer.length > GALLERY_MAX_TOTAL_BYTES) {
    throw new AdminError('Popunjena je kvota prostora za slike ovog salona.');
  }
  await assertLocation(client, ctx.organizationId, input.locationId);

  const maxSort = await client.query<{ n: number }>(
    `SELECT coalesce(max(sort_order), -1)::int AS n FROM gallery_items WHERE organization_id = $1`,
    [ctx.organizationId],
  );
  const sortOrder = maxSort.rows[0].n + 1;

  const media = await client.query<{ id: string }>(
    `INSERT INTO media (organization_id, storage_key, mime_type, width, height, size_bytes, uploaded_by)
     VALUES ($1, 'pending', 'image/webp', $2, $3, $4, $5) RETURNING id`,
    [ctx.organizationId, webp.width, webp.height, webp.buffer.length, ctx.actor.userId],
  );
  const mediaId = media.rows[0].id;
  const storageKey = `${ctx.organizationId}/${mediaId}.webp`;
  await client.query(`UPDATE media SET storage_key = $2 WHERE id = $1 AND organization_id = $3`, [
    mediaId,
    storageKey,
    ctx.organizationId,
  ]);

  const item = await client.query<{ id: string }>(
    `INSERT INTO gallery_items (organization_id, location_id, media_id, alt_text, caption, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [ctx.organizationId, input.locationId, mediaId, input.altText, input.caption, sortOrder],
  );
  await writeAudit(client, {
    organizationId: ctx.organizationId,
    userId: ctx.actor.userId,
    action: 'gallery.create',
    objectType: 'gallery_item',
    objectId: item.rows[0].id,
    newValue: { mediaId, altText: input.altText, locationId: input.locationId },
  });
  await putObject(storageKey, webp.buffer);
  return { id: item.rows[0].id, mediaId };
}

export async function updateGalleryItem(
  client: PoolClient,
  ctx: AdminContext,
  input: { id: string; altText: string; caption: string | null; locationId: string | null },
): Promise<void> {
  ctx.require('gallery.edit');
  await assertLocation(client, ctx.organizationId, input.locationId);
  const prev = await client.query<{ alt_text: string | null; caption: string | null; location_id: string | null }>(
    `SELECT alt_text, caption, location_id FROM gallery_items WHERE id = $1 AND organization_id = $2`,
    [input.id, ctx.organizationId],
  );
  if (!prev.rows[0]) throw new AdminError('Slika ne postoji.');
  await client.query(
    `UPDATE gallery_items SET alt_text = $3, caption = $4, location_id = $5 WHERE id = $1 AND organization_id = $2`,
    [input.id, ctx.organizationId, input.altText, input.caption, input.locationId],
  );
  await writeAudit(client, {
    organizationId: ctx.organizationId,
    userId: ctx.actor.userId,
    action: 'gallery.update',
    objectType: 'gallery_item',
    objectId: input.id,
    oldValue: prev.rows[0],
    newValue: { altText: input.altText, caption: input.caption, locationId: input.locationId },
  });
}

export async function deleteGalleryItem(client: PoolClient, ctx: AdminContext, id: string): Promise<void> {
  ctx.require('gallery.edit');
  const row = await client.query<{ media_id: string; storage_key: string }>(
    `SELECT g.media_id, m.storage_key
       FROM gallery_items g JOIN media m ON m.id = g.media_id
      WHERE g.id = $1 AND g.organization_id = $2`,
    [id, ctx.organizationId],
  );
  if (!row.rows[0]) throw new AdminError('Slika ne postoji.');
  await client.query(`DELETE FROM gallery_items WHERE id = $1 AND organization_id = $2`, [id, ctx.organizationId]);
  await client.query(`DELETE FROM media WHERE id = $1 AND organization_id = $2`, [
    row.rows[0].media_id,
    ctx.organizationId,
  ]);
  await deleteObject(row.rows[0].storage_key);
  await writeAudit(client, {
    organizationId: ctx.organizationId,
    userId: ctx.actor.userId,
    action: 'gallery.delete',
    objectType: 'gallery_item',
    objectId: id,
    oldValue: { mediaId: row.rows[0].media_id },
  });
}

export async function moveGalleryItem(
  client: PoolClient,
  ctx: AdminContext,
  id: string,
  direction: 'up' | 'down',
): Promise<void> {
  ctx.require('gallery.edit');
  const items = await client.query<{ id: string; sort_order: number }>(
    `SELECT id, sort_order FROM gallery_items WHERE organization_id = $1 ORDER BY sort_order, id`,
    [ctx.organizationId],
  );
  const index = items.rows.findIndex((r) => r.id === id);
  if (index < 0) throw new AdminError('Slika ne postoji.');
  const swapWith = direction === 'up' ? index - 1 : index + 1;
  if (swapWith < 0 || swapWith >= items.rows.length) return;
  const a = items.rows[index];
  const b = items.rows[swapWith];
  await client.query(`UPDATE gallery_items SET sort_order = $2 WHERE id = $1 AND organization_id = $3`, [
    a.id,
    b.sort_order,
    ctx.organizationId,
  ]);
  await client.query(`UPDATE gallery_items SET sort_order = $2 WHERE id = $1 AND organization_id = $3`, [
    b.id,
    a.sort_order,
    ctx.organizationId,
  ]);
}

export { loadAdminLocations };
