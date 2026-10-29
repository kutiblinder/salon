import type { PoolClient } from 'pg';
import { writeAudit } from '../audit';
import { AdminError, type AdminContext } from './core';
import type { AdminLocationDetail, AdminLocationListItem, LocationHour } from './locations-types';

export type { AdminLocationDetail, AdminLocationListItem, LocationHour } from './locations-types';
export {
  parseHoursForm,
  parseLocationName,
  parseOptionalEmail,
  parseOptionalLine,
  parseSlotStep,
  parseSortOrder,
} from './locations-types';

function requireManage(ctx: AdminContext) {
  ctx.require('locations.manage');
}

export async function listLocations(client: PoolClient, ctx: AdminContext): Promise<AdminLocationListItem[]> {
  requireManage(ctx);
  const res = await client.query<AdminLocationListItem>(
    `SELECT id, name, address, city, is_active AS "isActive"
       FROM locations WHERE organization_id = $1
      ORDER BY is_active DESC, sort_order, name`,
    [ctx.organizationId],
  );
  return res.rows;
}

export async function getLocation(
  client: PoolClient,
  ctx: AdminContext,
  locationId: string,
): Promise<AdminLocationDetail | null> {
  requireManage(ctx);
  const res = await client.query<{
    id: string;
    name: string;
    address: string | null;
    city: string | null;
    phone: string | null;
    email: string | null;
    timezone: string;
    slot_step_min: number;
    is_active: boolean;
    sort_order: number;
  }>(
    `SELECT id, name, address, city, phone, email::text AS email, timezone, slot_step_min, is_active, sort_order
       FROM locations WHERE id = $1 AND organization_id = $2`,
    [locationId, ctx.organizationId],
  );
  const row = res.rows[0];
  if (!row) return null;
  const hours = await client.query<{ weekday: number; opens: string; closes: string }>(
    `SELECT weekday, to_char(opens_at, 'HH24:MI') AS opens, to_char(closes_at, 'HH24:MI') AS closes
       FROM location_hours WHERE location_id = $1 ORDER BY weekday`,
    [locationId],
  );
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    city: row.city,
    phone: row.phone,
    email: row.email,
    timezone: row.timezone,
    slotStepMin: row.slot_step_min,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    hours: hours.rows,
  };
}

async function replaceHours(client: PoolClient, locationId: string, hours: LocationHour[]) {
  await client.query(`DELETE FROM location_hours WHERE location_id = $1`, [locationId]);
  for (const h of hours) {
    await client.query(
      `INSERT INTO location_hours (location_id, weekday, opens_at, closes_at) VALUES ($1, $2, $3::time, $4::time)`,
      [locationId, h.weekday, h.opens, h.closes],
    );
  }
}

async function copyOffersFromFirst(client: PoolClient, organizationId: string, newLocationId: string): Promise<number> {
  const first = await client.query<{ id: string }>(
    `SELECT id FROM locations
      WHERE organization_id = $1 AND is_active AND id <> $2
      ORDER BY sort_order, name, id LIMIT 1`,
    [organizationId, newLocationId],
  );
  if (!first.rows[0]) return 0;
  const copied = await client.query(
    `INSERT INTO location_services (location_id, service_id, price, duration_min, buffer_min, currency, is_active)
     SELECT $1, service_id, price, duration_min, buffer_min, currency, is_active
       FROM location_services WHERE location_id = $2
     ON CONFLICT DO NOTHING`,
    [newLocationId, first.rows[0].id],
  );
  return copied.rowCount ?? 0;
}

export async function createLocation(
  client: PoolClient,
  ctx: AdminContext,
  input: {
    name: string;
    address: string | null;
    city: string | null;
    phone: string | null;
    email: string | null;
    slotStepMin: number;
    sortOrder: number;
    hours: LocationHour[];
  },
): Promise<{ id: string; copiedOffers: number }> {
  requireManage(ctx);
  const ins = await client.query<{ id: string }>(
    `INSERT INTO locations (organization_id, name, address, city, phone, email, timezone, slot_step_min, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, 'Europe/Belgrade', $7, $8) RETURNING id`,
    [
      ctx.organizationId,
      input.name,
      input.address,
      input.city,
      input.phone,
      input.email,
      input.slotStepMin,
      input.sortOrder,
    ],
  );
  const id = ins.rows[0].id;
  await replaceHours(client, id, input.hours);
  const copiedOffers = await copyOffersFromFirst(client, ctx.organizationId, id);
  await writeAudit(client, {
    organizationId: ctx.organizationId,
    userId: ctx.actor.userId,
    action: 'locations.create',
    objectType: 'location',
    objectId: id,
    newValue: { name: input.name, city: input.city, copiedOffers },
  });
  return { id, copiedOffers };
}

export async function updateLocation(
  client: PoolClient,
  ctx: AdminContext,
  input: {
    locationId: string;
    name: string;
    address: string | null;
    city: string | null;
    phone: string | null;
    email: string | null;
    slotStepMin: number;
    sortOrder: number;
    isActive: boolean;
    hours: LocationHour[];
  },
): Promise<void> {
  requireManage(ctx);
  const prev = await client.query<{ name: string; is_active: boolean }>(
    `SELECT name, is_active FROM locations WHERE id = $1 AND organization_id = $2`,
    [input.locationId, ctx.organizationId],
  );
  if (!prev.rows[0]) throw new AdminError('Objekat ne postoji.');

  if (!input.isActive) {
    const others = await client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM locations
        WHERE organization_id = $1 AND is_active AND id <> $2`,
      [ctx.organizationId, input.locationId],
    );
    if (others.rows[0].n === 0) {
      throw new AdminError('Mora ostati bar jedan aktivan objekat.');
    }
  }

  await client.query(
    `UPDATE locations
        SET name = $2, address = $3, city = $4, phone = $5, email = $6,
            slot_step_min = $7, sort_order = $8, is_active = $9
      WHERE id = $1 AND organization_id = $10`,
    [
      input.locationId,
      input.name,
      input.address,
      input.city,
      input.phone,
      input.email,
      input.slotStepMin,
      input.sortOrder,
      input.isActive,
      ctx.organizationId,
    ],
  );
  await replaceHours(client, input.locationId, input.hours);
  await writeAudit(client, {
    organizationId: ctx.organizationId,
    userId: ctx.actor.userId,
    action: 'locations.update',
    objectType: 'location',
    objectId: input.locationId,
    oldValue: prev.rows[0],
    newValue: { name: input.name, isActive: input.isActive, city: input.city },
  });
}

export async function deleteLocation(client: PoolClient, ctx: AdminContext, locationId: string): Promise<void> {
  requireManage(ctx);
  const prev = await client.query<{ name: string }>(
    `SELECT name FROM locations WHERE id = $1 AND organization_id = $2`,
    [locationId, ctx.organizationId],
  );
  if (!prev.rows[0]) throw new AdminError('Objekat ne postoji.');

  const others = await client.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM locations WHERE organization_id = $1 AND id <> $2`,
    [ctx.organizationId, locationId],
  );
  if (others.rows[0].n === 0) throw new AdminError('Mora ostati bar jedan objekat.');

  const future = await client.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM appointments
      WHERE location_id = $1 AND organization_id = $2
        AND status IN ('pending', 'confirmed') AND starts_at > now()`,
    [locationId, ctx.organizationId],
  );
  if (future.rows[0].n > 0) {
    throw new AdminError('Na ovom objektu ima zakazanih termina. Otkažite ih pa obrišite objekat.');
  }

  await client.query(`DELETE FROM appointments WHERE location_id = $1 AND organization_id = $2`, [
    locationId,
    ctx.organizationId,
  ]);
  await client.query(`DELETE FROM locations WHERE id = $1 AND organization_id = $2`, [locationId, ctx.organizationId]);
  await writeAudit(client, {
    organizationId: ctx.organizationId,
    userId: ctx.actor.userId,
    action: 'locations.delete',
    objectType: 'location',
    objectId: locationId,
    oldValue: prev.rows[0],
  });
}
