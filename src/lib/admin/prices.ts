import type { PoolClient } from 'pg';
import { writeAudit } from '../audit';
import { isUuid } from '../panel/schedule';
import { AdminError, type AdminContext } from './core';
import type { AdminLocation, ServiceDetail, ServiceListItem, ServiceOffer } from './prices-types';

export type { AdminLocation, ServiceDetail, ServiceListItem, ServiceOffer } from './prices-types';

export function parseServiceName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw.trim().replace(/\s+/g, ' ');
  return name.length > 0 && name.length <= 80 ? name : null;
}

export function parseDescription(raw: unknown): string | null | undefined {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string') return undefined;
  const text = raw.trim().replace(/\s+/g, ' ');
  if (text.length === 0) return null;
  if (text.length > 500) return undefined;
  return text;
}

export function parseSortOrder(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === '') return 0;
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isInteger(n) || n < 0 || n > 10_000) return null;
  return n;
}

/** Cena u dinarima, 0–2 decimale, kao tekst za numeric. */
export function parsePrice(raw: unknown): string | null {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  const text = String(raw).trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const n = Number(text);
  if (!Number.isFinite(n) || n < 0 || n > 999_999.99) return null;
  return n.toFixed(2);
}

export function parseDurationMin(raw: unknown): number | null {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isInteger(n) || n <= 0 || n > 24 * 60) return null;
  return n;
}

export function parseBufferMin(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === '') return 0;
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isInteger(n) || n < 0 || n > 24 * 60) return null;
  return n;
}

function requireCatalogAndPrices(ctx: AdminContext) {
  ctx.require('services.edit');
  ctx.require('prices.edit');
}

export async function loadAdminLocations(client: PoolClient, organizationId: string): Promise<AdminLocation[]> {
  const res = await client.query<AdminLocation>(
    `SELECT id, name FROM locations WHERE organization_id = $1 AND is_active ORDER BY sort_order, name`,
    [organizationId],
  );
  return res.rows;
}

async function assertOrgLocations(client: PoolClient, organizationId: string, locationIds: string[]) {
  if (locationIds.length === 0) return;
  const res = await client.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM locations WHERE organization_id = $1 AND is_active AND id = ANY($2::uuid[])`,
    [organizationId, locationIds],
  );
  if (res.rows[0].n !== locationIds.length) throw new AdminError('Lokacija ne postoji.');
}

export async function listServices(client: PoolClient, ctx: AdminContext): Promise<ServiceListItem[]> {
  requireCatalogAndPrices(ctx);
  const res = await client.query<{
    id: string;
    name: string;
    is_active: boolean;
    location_count: number;
    min_price: string | null;
  }>(
    `SELECT s.id, s.name, s.is_active,
            count(ls.location_id)::int AS location_count,
            min(ls.price)::text AS min_price
       FROM services s
       LEFT JOIN location_services ls ON ls.service_id = s.id
       LEFT JOIN locations l ON l.id = ls.location_id AND l.organization_id = s.organization_id
      WHERE s.organization_id = $1
      GROUP BY s.id
      ORDER BY s.is_active DESC, s.sort_order, s.name`,
    [ctx.organizationId],
  );
  return res.rows.map((r) => ({
    id: r.id,
    name: r.name,
    isActive: r.is_active,
    locationCount: r.location_count,
    minPrice: r.min_price,
  }));
}

export async function getService(
  client: PoolClient,
  ctx: AdminContext,
  serviceId: string,
): Promise<ServiceDetail | null> {
  requireCatalogAndPrices(ctx);
  const res = await client.query<{
    id: string;
    name: string;
    description: string | null;
    is_active: boolean;
    sort_order: number;
  }>(
    `SELECT id, name, description, is_active, sort_order FROM services WHERE id = $1 AND organization_id = $2`,
    [serviceId, ctx.organizationId],
  );
  const row = res.rows[0];
  if (!row) return null;
  const offers = await client.query<ServiceOffer>(
    `SELECT location_id AS "locationId", price::text AS price, duration_min AS "durationMin", buffer_min AS "bufferMin"
       FROM location_services WHERE service_id = $1`,
    [serviceId],
  );
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    offers: offers.rows,
  };
}

async function replaceOffers(
  client: PoolClient,
  organizationId: string,
  serviceId: string,
  offers: ServiceOffer[],
) {
  const ids = offers.map((o) => o.locationId);
  await client.query(
    `DELETE FROM location_services ls
      USING locations l
      WHERE ls.location_id = l.id AND l.organization_id = $1 AND ls.service_id = $2
        AND NOT (ls.location_id = ANY($3::uuid[]))`,
    [organizationId, serviceId, ids],
  );
  for (const offer of offers) {
    await client.query(
      `INSERT INTO location_services (location_id, service_id, price, currency, duration_min, buffer_min, is_active)
       VALUES ($1, $2, $3, 'RSD', $4, $5, true)
       ON CONFLICT (location_id, service_id)
       DO UPDATE SET price = EXCLUDED.price, duration_min = EXCLUDED.duration_min, buffer_min = EXCLUDED.buffer_min, is_active = true`,
      [offer.locationId, serviceId, offer.price, offer.durationMin, offer.bufferMin],
    );
  }
}

export async function createService(
  client: PoolClient,
  ctx: AdminContext,
  input: {
    name: string;
    description: string | null;
    sortOrder: number;
    offers: ServiceOffer[];
  },
): Promise<{ id: string }> {
  requireCatalogAndPrices(ctx);
  if (input.offers.length === 0) throw new AdminError('Izaberite bar jedan objekat sa cenom i trajanjem.');
  await assertOrgLocations(client, ctx.organizationId, input.offers.map((o) => o.locationId));

  const ins = await client.query<{ id: string }>(
    `INSERT INTO services (organization_id, name, description, sort_order) VALUES ($1, $2, $3, $4) RETURNING id`,
    [ctx.organizationId, input.name, input.description, input.sortOrder],
  );
  const id = ins.rows[0].id;
  await replaceOffers(client, ctx.organizationId, id, input.offers);
  await writeAudit(client, {
    organizationId: ctx.organizationId,
    userId: ctx.actor.userId,
    action: 'services.create',
    objectType: 'service',
    objectId: id,
    newValue: { name: input.name, offers: input.offers },
  });
  return { id };
}

export async function updateService(
  client: PoolClient,
  ctx: AdminContext,
  input: {
    serviceId: string;
    name: string;
    description: string | null;
    isActive: boolean;
    sortOrder: number;
    offers: ServiceOffer[];
  },
): Promise<void> {
  requireCatalogAndPrices(ctx);
  if (input.offers.length === 0) throw new AdminError('Izaberite bar jedan objekat sa cenom i trajanjem.');
  await assertOrgLocations(client, ctx.organizationId, input.offers.map((o) => o.locationId));

  const prev = await client.query<{ name: string; is_active: boolean }>(
    `SELECT name, is_active FROM services WHERE id = $1 AND organization_id = $2`,
    [input.serviceId, ctx.organizationId],
  );
  if (!prev.rows[0]) throw new AdminError('Usluga ne postoji.');
  const prevOffers = await client.query<ServiceOffer>(
    `SELECT location_id AS "locationId", price::text AS price, duration_min AS "durationMin", buffer_min AS "bufferMin"
       FROM location_services WHERE service_id = $1`,
    [input.serviceId],
  );

  await client.query(
    `UPDATE services SET name = $2, description = $3, is_active = $4, sort_order = $5 WHERE id = $1 AND organization_id = $6`,
    [input.serviceId, input.name, input.description, input.isActive, input.sortOrder, ctx.organizationId],
  );
  await replaceOffers(client, ctx.organizationId, input.serviceId, input.offers);
  await writeAudit(client, {
    organizationId: ctx.organizationId,
    userId: ctx.actor.userId,
    action: 'prices.update',
    objectType: 'service',
    objectId: input.serviceId,
    oldValue: { name: prev.rows[0].name, isActive: prev.rows[0].is_active, offers: prevOffers.rows },
    newValue: { name: input.name, isActive: input.isActive, offers: input.offers },
  });
}

export function parseOffers(
  locationIds: unknown[],
  get: (locationId: string, field: 'price' | 'duration' | 'buffer') => unknown,
): ServiceOffer[] | { error: string } {
  const ids: string[] = [];
  for (const value of locationIds) {
    if (value === '' || value === undefined || value === null) continue;
    if (!isUuid(value)) return { error: 'Neispravan objekat.' };
    ids.push(value.toLowerCase());
  }
  const unique = [...new Set(ids)];
  const offers: ServiceOffer[] = [];
  for (const locationId of unique) {
    const price = parsePrice(get(locationId, 'price'));
    const durationMin = parseDurationMin(get(locationId, 'duration'));
    const bufferMin = parseBufferMin(get(locationId, 'buffer'));
    if (!price) return { error: 'Unesite cenu (npr. 1800) za svaki izabrani objekat.' };
    if (!durationMin) return { error: 'Trajanje mora biti ceo broj minuta.' };
    if (bufferMin === null) return { error: 'Pauza posle usluge mora biti 0 ili više minuta.' };
    offers.push({ locationId, price, durationMin, bufferMin });
  }
  return offers;
}
