import { randomBytes } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import type { PoolClient } from 'pg';
import { writeAudit } from '../audit';
import { dropUserSessions, removeStaffLogin } from '../staff-account';
import { PanelError } from './core';
import { isUuid } from './schedule';
import type { Permission } from '../auth/permissions';
import type { CreateLoginResult, OrgService, StaffDetail, StaffListItem, StaffServiceAssignment } from './staff-types';

export type { CreateLoginResult, OrgService, StaffDetail, StaffListItem, StaffServiceAssignment } from './staff-types';

/** Panel i admin dele iste upise; dozvole proverava pozivalac kroz require / locationsFor. */
export interface StaffAccess {
  organizationId: string;
  actor: { userId: string };
  locations: { id: string }[];
  require(permission: Permission, resource?: { locationId?: string; staffId?: string }): void;
  locationsFor(permission: Permission): { id: string }[];
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UNIQUE_VIOLATION = '23505';

export function parseStaffName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw.trim().replace(/\s+/g, ' ');
  return name.length > 0 && name.length <= 80 ? name : null;
}

export function parseOptionalText(raw: unknown, maxLength: number): string | null | undefined {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string') return undefined;
  const text = raw.trim().replace(/\s+/g, ' ');
  if (text.length === 0) return null;
  if (text.length > maxLength) return undefined;
  return text;
}

export function parseEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const email = raw.trim().toLowerCase();
  return EMAIL.test(email) && email.length <= 254 ? email : null;
}

/** Prazno = koristi trajanje sa lokacije; neispravno = undefined. */
export function parseDurationOverride(raw: unknown): number | null | undefined {
  if (raw === undefined || raw === null || raw === '') return null;
  if (typeof raw !== 'string' && typeof raw !== 'number') return undefined;
  const n = typeof raw === 'number' ? raw : Number(raw.trim());
  if (!Number.isInteger(n) || n <= 0 || n > 24 * 60) return undefined;
  return n;
}

export function parseIdList(values: unknown[]): string[] | null {
  const ids: string[] = [];
  for (const value of values) {
    if (value === '' || value === undefined || value === null) continue;
    if (!isUuid(value)) return null;
    ids.push(value.toLowerCase());
  }
  return [...new Set(ids)];
}

export function parseSortOrder(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === '') return 0;
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isInteger(n) || n < 0 || n > 10_000) return null;
  return n;
}

export type ParsedStaffProfile =
  | { error: string }
  | {
      name: string;
      title: string | null;
      bio: string | null;
      sortOrder: number;
      locationIds: string[];
      services: StaffServiceAssignment[];
    };

export function parseStaffProfileForm(formData: FormData): ParsedStaffProfile {
  const name = parseStaffName(formData.get('name'));
  const title = parseOptionalText(formData.get('title'), 80);
  const bio = parseOptionalText(formData.get('bio'), 500);
  const sortOrder = parseSortOrder(formData.get('sortOrder'));
  const locationIds = parseIdList(formData.getAll('locationId'));
  const serviceIds = parseIdList(formData.getAll('serviceId'));
  if (!name) return { error: 'Unesite ime (do 80 karaktera).' };
  if (title === undefined) return { error: 'Titula je predugačka.' };
  if (bio === undefined) return { error: 'Opis je predugačak.' };
  if (sortOrder === null) return { error: 'Redosled mora biti nula ili pozitivan broj.' };
  if (!locationIds) return { error: 'Neispravan objekat.' };
  if (locationIds.length === 0) return { error: 'Izaberite bar jedan objekat.' };
  if (!serviceIds) return { error: 'Neispravna usluga.' };
  const services: StaffServiceAssignment[] = [];
  for (const serviceId of serviceIds) {
    const duration = parseDurationOverride(formData.get(`duration_${serviceId}`));
    if (duration === undefined) return { error: 'Trajanje usluge mora biti ceo broj minuta, ili prazno.' };
    services.push({ serviceId, durationOverrideMin: duration });
  }
  return { name, title, bio, sortOrder, locationIds, services };
}

function requireManage(ctx: StaffAccess, locationIds: string[] = []) {
  if (locationIds.length === 0) {
    if (ctx.locationsFor('staff.manage').length === 0) {
      throw new PanelError('Nemate dozvolu za ovu radnju.');
    }
    return;
  }
  for (const locationId of locationIds) {
    ctx.require('staff.manage', { locationId });
  }
}

function assertOrgLocations(ctx: StaffAccess, locationIds: string[]) {
  const allowed = new Set(ctx.locations.map((l) => l.id));
  if (locationIds.some((id) => !allowed.has(id))) throw new PanelError('Lokacija ne postoji.');
}

async function loadOwnedStaff(client: PoolClient, organizationId: string, staffId: string) {
  const res = await client.query<{ id: string }>(
    `SELECT id FROM staff WHERE id = $1 AND organization_id = $2`,
    [staffId, organizationId],
  );
  if (!res.rows[0]) throw new PanelError('Zaposleni ne postoji.');
}

export async function loadOrgServices(client: PoolClient, organizationId: string): Promise<OrgService[]> {
  const res = await client.query<OrgService>(
    `SELECT id, name FROM services WHERE organization_id = $1 AND is_active ORDER BY sort_order, name`,
    [organizationId],
  );
  return res.rows;
}

export async function listStaff(client: PoolClient, ctx: StaffAccess): Promise<StaffListItem[]> {
  requireManage(ctx);
  const res = await client.query<{
    id: string;
    name: string;
    title: string | null;
    is_active: boolean;
    location_names: string[] | null;
    email: string | null;
  }>(
    `SELECT s.id, s.display_name AS name, s.title, s.is_active,
            array_remove(array_agg(l.name ORDER BY l.sort_order, l.name), NULL) AS location_names,
            u.email::text AS email
       FROM staff s
       LEFT JOIN staff_locations sl ON sl.staff_id = s.id
       LEFT JOIN locations l ON l.id = sl.location_id AND l.organization_id = s.organization_id
       LEFT JOIN users u ON u.id = s.user_id AND u.organization_id = s.organization_id
      WHERE s.organization_id = $1
      GROUP BY s.id, u.email
      ORDER BY s.is_active DESC, s.sort_order, s.display_name`,
    [ctx.organizationId],
  );
  return res.rows.map((r) => ({
    id: r.id,
    name: r.name,
    title: r.title,
    isActive: r.is_active,
    locationNames: r.location_names ?? [],
    email: r.email,
  }));
}

export async function getStaff(client: PoolClient, ctx: StaffAccess, staffId: string): Promise<StaffDetail | null> {
  requireManage(ctx);
  const res = await client.query<{
    id: string;
    name: string;
    title: string | null;
    bio: string | null;
    is_active: boolean;
    sort_order: number;
    email: string | null;
  }>(
    `SELECT s.id, s.display_name AS name, s.title, s.bio, s.is_active, s.sort_order, u.email::text AS email
       FROM staff s
       LEFT JOIN users u ON u.id = s.user_id AND u.organization_id = s.organization_id
      WHERE s.id = $1 AND s.organization_id = $2`,
    [staffId, ctx.organizationId],
  );
  const row = res.rows[0];
  if (!row) return null;
  const locations = await client.query<{ location_id: string }>(
    `SELECT location_id FROM staff_locations WHERE staff_id = $1`,
    [staffId],
  );
  const services = await client.query<StaffServiceAssignment>(
    `SELECT service_id AS "serviceId", duration_override_min AS "durationOverrideMin"
       FROM staff_services WHERE staff_id = $1`,
    [staffId],
  );
  return {
    id: row.id,
    name: row.name,
    title: row.title,
    bio: row.bio,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    locationIds: locations.rows.map((r) => r.location_id),
    services: services.rows,
    email: row.email,
  };
}

async function replaceLocations(client: PoolClient, staffId: string, locationIds: string[]) {
  await client.query(`DELETE FROM staff_locations WHERE staff_id = $1 AND NOT (location_id = ANY($2::bigint[]))`, [
    staffId,
    locationIds,
  ]);
  await client.query(
    `DELETE FROM weekly_schedule WHERE staff_id = $1 AND NOT (location_id = ANY($2::bigint[]))`,
    [staffId, locationIds],
  );
  await client.query(
    `DELETE FROM schedule_exceptions
      WHERE staff_id = $1 AND location_id IS NOT NULL AND NOT (location_id = ANY($2::bigint[]))`,
    [staffId, locationIds],
  );
  for (const locationId of locationIds) {
    await client.query(
      `INSERT INTO staff_locations (staff_id, location_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [staffId, locationId],
    );
  }
}

async function replaceServices(client: PoolClient, staffId: string, services: StaffServiceAssignment[]) {
  const ids = services.map((s) => s.serviceId);
  await client.query(`DELETE FROM staff_services WHERE staff_id = $1 AND NOT (service_id = ANY($2::bigint[]))`, [
    staffId,
    ids,
  ]);
  for (const service of services) {
    await client.query(
      `INSERT INTO staff_services (staff_id, service_id, duration_override_min)
       VALUES ($1, $2, $3)
       ON CONFLICT (staff_id, service_id) DO UPDATE SET duration_override_min = EXCLUDED.duration_override_min`,
      [staffId, service.serviceId, service.durationOverrideMin],
    );
  }
}

async function assertOrgServices(client: PoolClient, organizationId: string, serviceIds: string[]) {
  if (serviceIds.length === 0) return;
  const res = await client.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM services WHERE organization_id = $1 AND id = ANY($2::bigint[])`,
    [organizationId, serviceIds],
  );
  if (res.rows[0].n !== serviceIds.length) throw new PanelError('Usluga ne postoji.');
}

export async function createStaff(
  client: PoolClient,
  ctx: StaffAccess,
  input: {
    name: string;
    title: string | null;
    bio: string | null;
    sortOrder: number;
    locationIds: string[];
    services: StaffServiceAssignment[];
  },
): Promise<{ id: string }> {
  if (input.locationIds.length === 0) throw new PanelError('Izaberite bar jedan objekat.');
  requireManage(ctx, input.locationIds);
  assertOrgLocations(ctx, input.locationIds);
  await assertOrgServices(client, ctx.organizationId, input.services.map((s) => s.serviceId));

  const ins = await client.query<{ id: string }>(
    `INSERT INTO staff (organization_id, display_name, title, bio, sort_order)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [ctx.organizationId, input.name, input.title, input.bio, input.sortOrder],
  );
  const id = ins.rows[0].id;
  await replaceLocations(client, id, input.locationIds);
  await replaceServices(client, id, input.services);
  await writeAudit(client, {
    organizationId: ctx.organizationId,
    userId: ctx.actor.userId,
    action: 'staff.create',
    objectType: 'staff',
    objectId: id,
    newValue: { name: input.name, locationIds: input.locationIds, serviceIds: input.services.map((s) => s.serviceId) },
  });
  return { id };
}

export async function updateStaff(
  client: PoolClient,
  ctx: StaffAccess,
  input: {
    staffId: string;
    name: string;
    title: string | null;
    bio: string | null;
    isActive: boolean;
    sortOrder: number;
    locationIds: string[];
    services: StaffServiceAssignment[];
  },
): Promise<void> {
  if (input.locationIds.length === 0) throw new PanelError('Izaberite bar jedan objekat.');
  await loadOwnedStaff(client, ctx.organizationId, input.staffId);
  requireManage(ctx, input.locationIds);
  assertOrgLocations(ctx, input.locationIds);
  await assertOrgServices(client, ctx.organizationId, input.services.map((s) => s.serviceId));

  const prev = await client.query<{ display_name: string; is_active: boolean; user_id: string | null }>(
    `SELECT display_name, is_active, user_id FROM staff WHERE id = $1`,
    [input.staffId],
  );
  await client.query(
    `UPDATE staff SET display_name = $2, title = $3, bio = $4, is_active = $5, sort_order = $6 WHERE id = $1`,
    [input.staffId, input.name, input.title, input.bio, input.isActive, input.sortOrder],
  );
  if (prev.rows[0]?.user_id) {
    await client.query(`UPDATE users SET full_name = $2 WHERE id = $1 AND organization_id = $3`, [
      prev.rows[0].user_id,
      input.name,
      ctx.organizationId,
    ]);
  }
  if (!input.isActive && prev.rows[0]?.is_active && prev.rows[0].user_id) {
    await dropUserSessions(client, prev.rows[0].user_id);
  }
  await replaceLocations(client, input.staffId, input.locationIds);
  await replaceServices(client, input.staffId, input.services);
  await writeAudit(client, {
    organizationId: ctx.organizationId,
    userId: ctx.actor.userId,
    action: 'staff.update',
    objectType: 'staff',
    objectId: input.staffId,
    oldValue: prev.rows[0],
    newValue: {
      name: input.name,
      isActive: input.isActive,
      locationIds: input.locationIds,
      serviceIds: input.services.map((s) => s.serviceId),
    },
  });
}

/**
 * Pravi nalog za prijavu ili vezuje postojeci nalog istog salona (npr. klijenta).
 * Lozinka se vraca samo kad je nalog nov; nikad ne ide u audit log.
 */
export async function createStaffLogin(
  client: PoolClient,
  ctx: StaffAccess,
  input: { staffId: string; email: string; password: string | null },
): Promise<CreateLoginResult> {
  const staff = await client.query<{ user_id: string | null; display_name: string; location_id: string | null }>(
    `SELECT s.user_id, s.display_name, (SELECT sl.location_id FROM staff_locations sl WHERE sl.staff_id = s.id LIMIT 1) AS location_id
       FROM staff s WHERE s.id = $1 AND s.organization_id = $2`,
    [input.staffId, ctx.organizationId],
  );
  const row = staff.rows[0];
  if (!row) throw new PanelError('Zaposleni ne postoji.');
  if (row.user_id) throw new PanelError('Ovaj zaposleni već ima nalog.');
  requireManage(ctx, row.location_id ? [row.location_id] : []);

  const existing = await client.query<{ id: string }>(
    `SELECT id FROM users WHERE email = $1 AND organization_id = $2`,
    [input.email, ctx.organizationId],
  );
  let userId = existing.rows[0]?.id ?? null;
  let generated: string | null = null;

  if (userId) {
    const taken = await client.query(`SELECT 1 FROM staff WHERE user_id = $1`, [userId]);
    if ((taken.rowCount ?? 0) > 0) throw new PanelError('Taj nalog je već vezan za drugog zaposlenog.');
  } else {
    generated = input.password && input.password.length >= 8 ? input.password : randomBytes(12).toString('base64url');
    try {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO users (organization_id, email, full_name, email_verified) VALUES ($1, $2, $3, true) RETURNING id`,
        [ctx.organizationId, input.email, row.display_name],
      );
      userId = inserted.rows[0].id;
      await client.query(
        `INSERT INTO accounts (account_id, provider_id, user_id, organization_id, password)
         VALUES ($1::text, 'credential', $1::bigint, $2, $3)`,
        [userId, ctx.organizationId, await hashPassword(generated)],
      );
    } catch (error) {
      if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
        throw new PanelError('Taj email već postoji u ovom salonu.');
      }
      throw error;
    }
  }

  await client.query(
    `INSERT INTO memberships (user_id, role, scope, organization_id)
     VALUES ($1, 'staff', 'organization', $2) ON CONFLICT DO NOTHING`,
    [userId, ctx.organizationId],
  );
  try {
    await client.query(`UPDATE staff SET user_id = $1 WHERE id = $2 AND organization_id = $3`, [
      userId,
      input.staffId,
      ctx.organizationId,
    ]);
  } catch (error) {
    if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
      throw new PanelError('Taj nalog je već vezan za drugog zaposlenog.');
    }
    throw error;
  }

  await writeAudit(client, {
    organizationId: ctx.organizationId,
    userId: ctx.actor.userId,
    action: 'staff.login.create',
    objectType: 'staff',
    objectId: input.staffId,
    newValue: { email: input.email, linkedExisting: generated === null },
  });
  return generated ? { kind: 'created', email: input.email, password: generated } : { kind: 'linked', email: input.email };
}

export async function deleteStaff(client: PoolClient, ctx: StaffAccess, staffId: string): Promise<void> {
  await loadOwnedStaff(client, ctx.organizationId, staffId);
  const loc = await client.query<{ location_id: string }>(
    `SELECT location_id FROM staff_locations WHERE staff_id = $1`,
    [staffId],
  );
  requireManage(
    ctx,
    loc.rows.map((r) => r.location_id),
  );

  const future = await client.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM appointments
      WHERE staff_id = $1 AND organization_id = $2
        AND status IN ('pending', 'confirmed') AND starts_at > now()`,
    [staffId, ctx.organizationId],
  );
  if (future.rows[0].n > 0) {
    throw new PanelError('Zaposleni ima zakazane termine. Otkažite ih pa obrišite profil.');
  }

  const prev = await client.query<{ display_name: string; user_id: string | null }>(
    `SELECT display_name, user_id FROM staff WHERE id = $1 AND organization_id = $2`,
    [staffId, ctx.organizationId],
  );
  await client.query(`DELETE FROM appointments WHERE staff_id = $1 AND organization_id = $2`, [
    staffId,
    ctx.organizationId,
  ]);
  await client.query(`DELETE FROM staff WHERE id = $1 AND organization_id = $2`, [staffId, ctx.organizationId]);
  if (prev.rows[0]?.user_id) {
    await removeStaffLogin(client, ctx.organizationId, prev.rows[0].user_id);
  }
  await writeAudit(client, {
    organizationId: ctx.organizationId,
    userId: ctx.actor.userId,
    action: 'staff.delete',
    objectType: 'staff',
    objectId: staffId,
    oldValue: { name: prev.rows[0]?.display_name },
  });
}
