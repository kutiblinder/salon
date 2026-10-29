import type { PoolClient } from 'pg';
import { writeAudit } from '../audit';
import type { StaffAccess } from '../panel/staff';
import type { StaffListItem } from '../panel/staff-types';
import { dropUserSessions, removeStaffLogin } from '../staff-account';
import { AdminError, type AdminContext } from './core';

export type { StaffListItem };

export async function loadStaffLocations(
  client: PoolClient,
  ctx: AdminContext,
): Promise<{ id: string; name: string; timezone: string }[]> {
  ctx.require('staff.manage');
  const res = await client.query<{ id: string; name: string; timezone: string }>(
    `SELECT id, name, timezone FROM locations
      WHERE organization_id = $1 AND is_active ORDER BY sort_order, name`,
    [ctx.organizationId],
  );
  return res.rows;
}

export function staffAccess(
  ctx: AdminContext,
  locations: { id: string; name: string; timezone: string }[],
): StaffAccess {
  return {
    organizationId: ctx.organizationId,
    actor: ctx.actor,
    locations,
    require(permission) {
      ctx.require(permission);
    },
    locationsFor() {
      return locations;
    },
  };
}

export async function listAdminStaff(client: PoolClient, ctx: AdminContext): Promise<StaffListItem[]> {
  ctx.require('staff.manage');
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

export async function deleteStaffProfile(client: PoolClient, ctx: AdminContext, staffId: string): Promise<void> {
  ctx.require('staff.manage');
  const prev = await client.query<{ display_name: string; user_id: string | null }>(
    `SELECT display_name, user_id FROM staff WHERE id = $1 AND organization_id = $2`,
    [staffId, ctx.organizationId],
  );
  if (!prev.rows[0]) throw new AdminError('Zaposleni ne postoji.');

  const future = await client.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM appointments
      WHERE staff_id = $1 AND organization_id = $2
        AND status IN ('pending', 'confirmed') AND starts_at > now()`,
    [staffId, ctx.organizationId],
  );
  if (future.rows[0].n > 0) {
    throw new AdminError('Zaposleni ima zakazane termine. Otkažite ih pa obrišite profil.');
  }

  await client.query(`DELETE FROM appointments WHERE staff_id = $1 AND organization_id = $2`, [
    staffId,
    ctx.organizationId,
  ]);
  const userId = prev.rows[0].user_id;
  await client.query(`DELETE FROM staff WHERE id = $1 AND organization_id = $2`, [staffId, ctx.organizationId]);
  if (userId) await removeStaffLogin(client, ctx.organizationId, userId);
  await writeAudit(client, {
    organizationId: ctx.organizationId,
    userId: ctx.actor.userId,
    action: 'staff.delete',
    objectType: 'staff',
    objectId: staffId,
    oldValue: { name: prev.rows[0].display_name },
  });
}

export async function setStaffActive(
  client: PoolClient,
  ctx: AdminContext,
  staffId: string,
  isActive: boolean,
): Promise<void> {
  ctx.require('staff.manage');
  const prev = await client.query<{ display_name: string; is_active: boolean; user_id: string | null }>(
    `SELECT display_name, is_active, user_id FROM staff WHERE id = $1 AND organization_id = $2`,
    [staffId, ctx.organizationId],
  );
  if (!prev.rows[0]) throw new AdminError('Zaposleni ne postoji.');
  if (prev.rows[0].is_active === isActive) return;

  await client.query(`UPDATE staff SET is_active = $3 WHERE id = $1 AND organization_id = $2`, [
    staffId,
    ctx.organizationId,
    isActive,
  ]);
  if (!isActive && prev.rows[0].user_id) await dropUserSessions(client, prev.rows[0].user_id);
  await writeAudit(client, {
    organizationId: ctx.organizationId,
    userId: ctx.actor.userId,
    action: 'staff.update',
    objectType: 'staff',
    objectId: staffId,
    oldValue: { name: prev.rows[0].display_name, isActive: prev.rows[0].is_active },
    newValue: { isActive },
  });
}
