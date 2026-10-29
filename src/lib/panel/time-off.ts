import type { PoolClient } from 'pg';
import { writeAudit } from '../audit';
import { addDays, zonedTimeToUtcMs } from '../availability/time';
import { PanelError, type PanelContext } from './core';
import { isDate, parseShiftWindow } from './schedule';
import { isTimeOffKind, type TimeOffKind, type TimeOffRow, type TimeOffStaff } from './time-off-types';

export { isTimeOffKind, TIME_OFF_KINDS, TIME_OFF_LABELS, type TimeOffKind, type TimeOffRow, type TimeOffStaff } from './time-off-types';

/** Inclusive local dates -> [from 00:00, to+1 00:00) in the location timezone. */
export function fullDayRange(from: string, to: string, timeZone: string): { startMs: number; endMs: number } | null {
  if (!isDate(from) || !isDate(to) || to < from) return null;
  return {
    startMs: zonedTimeToUtcMs(from, '00:00', timeZone),
    endMs: zonedTimeToUtcMs(addDays(to, 1), '00:00', timeZone),
  };
}

/** Same-day pause. Overnight is not in the MVP. */
export function breakRange(date: string, start: unknown, end: unknown, timeZone: string): { startMs: number; endMs: number } | null {
  if (!isDate(date)) return null;
  const window = parseShiftWindow(start, end);
  if (!window) return null;
  return {
    startMs: zonedTimeToUtcMs(date, window.start, timeZone),
    endMs: zonedTimeToUtcMs(date, window.end, timeZone),
  };
}

export function parseNote(raw: unknown): string | null | undefined {
  if (raw === undefined || raw === null || raw === '') return null;
  if (typeof raw !== 'string') return undefined;
  const note = raw.trim().replace(/\s+/g, ' ');
  if (note.length === 0) return null;
  if (note.length > 500) return undefined;
  return note;
}

/** Zaposleni koje nalog sme da vidi/menja (bar na jednoj lokaciji). */
export async function loadManageableStaff(client: PoolClient, ctx: PanelContext): Promise<TimeOffStaff[]> {
  const res = await client.query<{ id: string; name: string; location_ids: string[] }>(
    `SELECT s.id, s.display_name AS name, array_agg(sl.location_id::text ORDER BY sl.location_id) AS location_ids
       FROM staff s
       JOIN staff_locations sl ON sl.staff_id = s.id
      WHERE s.organization_id = $1 AND s.is_active
      GROUP BY s.id
      ORDER BY s.sort_order, s.display_name`,
    [ctx.organizationId],
  );
  return res.rows
    .map((r) => ({ id: r.id, name: r.name, locationIds: r.location_ids }))
    .filter((s) => s.locationIds.some((locationId) => ctx.can('schedule.manage', { locationId, staffId: s.id })));
}

function requireStaffSchedule(ctx: PanelContext, staff: { id: string; locationIds: string[] }) {
  const locationId = staff.locationIds.find((id) => ctx.can('schedule.manage', { locationId: id, staffId: staff.id }));
  if (!locationId) throw new PanelError('Nemate dozvolu za ovu radnju.');
  ctx.require('schedule.manage', { locationId, staffId: staff.id });
}

async function loadStaffInOrg(client: PoolClient, organizationId: string, staffId: string) {
  const res = await client.query<{ id: string; location_ids: string[] }>(
    `SELECT s.id, coalesce(array_agg(sl.location_id::text) FILTER (WHERE sl.location_id IS NOT NULL), '{}') AS location_ids
       FROM staff s
       LEFT JOIN staff_locations sl ON sl.staff_id = s.id
      WHERE s.id = $1 AND s.organization_id = $2 AND s.is_active
      GROUP BY s.id`,
    [staffId, organizationId],
  );
  const row = res.rows[0];
  if (!row || row.location_ids.length === 0) throw new PanelError('Zaposleni ne postoji.');
  return { id: row.id, locationIds: row.location_ids };
}

export async function loadTimeOff(
  client: PoolClient,
  ctx: PanelContext,
  staff: TimeOffStaff[],
  fromMs: number,
): Promise<TimeOffRow[]> {
  if (staff.length === 0) return [];
  const res = await client.query<{
    id: string;
    staff_id: string;
    staff_name: string;
    kind: TimeOffKind;
    starts_at: Date;
    ends_at: Date;
    note: string | null;
  }>(
    `SELECT t.id, t.staff_id, s.display_name AS staff_name, t.kind,
            lower(t.during) AS starts_at, upper(t.during) AS ends_at, t.note
       FROM time_off t
       JOIN staff s ON s.id = t.staff_id
      WHERE s.organization_id = $1 AND t.staff_id = ANY($2::uuid[])
        AND upper(t.during) > $3::timestamptz
      ORDER BY lower(t.during), s.sort_order, s.display_name`,
    [ctx.organizationId, staff.map((s) => s.id), new Date(fromMs).toISOString()],
  );
  return res.rows.map((r) => ({
    id: r.id,
    staffId: r.staff_id,
    staffName: r.staff_name,
    kind: r.kind,
    startsAt: r.starts_at.toISOString(),
    endsAt: r.ends_at.toISOString(),
    note: r.note,
  }));
}

export async function createTimeOff(
  client: PoolClient,
  ctx: PanelContext,
  input: { staffId: string; kind: TimeOffKind; startMs: number; endMs: number; note: string | null },
): Promise<{ id: string }> {
  if (!isTimeOffKind(input.kind) || !(input.endMs > input.startMs)) {
    throw new PanelError('Proverite početak i kraj odsustva.');
  }
  const staff = await loadStaffInOrg(client, ctx.organizationId, input.staffId);
  requireStaffSchedule(ctx, staff);

  const ins = await client.query<{ id: string }>(
    `INSERT INTO time_off (staff_id, during, kind, note)
     VALUES ($1, tstzrange($2::timestamptz, $3::timestamptz, '[)'), $4::time_off_kind, $5)
     RETURNING id`,
    [input.staffId, new Date(input.startMs).toISOString(), new Date(input.endMs).toISOString(), input.kind, input.note],
  );
  const id = ins.rows[0].id;
  await writeAudit(client, {
    organizationId: ctx.organizationId,
    userId: ctx.actor.userId,
    action: 'schedule.time_off.create',
    objectType: 'time_off',
    objectId: id,
    newValue: {
      staffId: input.staffId,
      kind: input.kind,
      startsAt: new Date(input.startMs).toISOString(),
      endsAt: new Date(input.endMs).toISOString(),
      note: input.note,
    },
  });
  return { id };
}

export async function deleteTimeOff(client: PoolClient, ctx: PanelContext, id: string): Promise<void> {
  const prev = await client.query<{
    staff_id: string;
    kind: TimeOffKind;
    starts_at: Date;
    ends_at: Date;
    note: string | null;
  }>(
    `SELECT t.staff_id, t.kind, lower(t.during) AS starts_at, upper(t.during) AS ends_at, t.note
       FROM time_off t
       JOIN staff s ON s.id = t.staff_id
      WHERE t.id = $1 AND s.organization_id = $2`,
    [id, ctx.organizationId],
  );
  const old = prev.rows[0];
  if (!old) throw new PanelError('Odsustvo ne postoji.');
  const staff = await loadStaffInOrg(client, ctx.organizationId, old.staff_id);
  requireStaffSchedule(ctx, staff);
  await client.query('DELETE FROM time_off WHERE id = $1', [id]);
  await writeAudit(client, {
    organizationId: ctx.organizationId,
    userId: ctx.actor.userId,
    action: 'schedule.time_off.delete',
    objectType: 'time_off',
    objectId: id,
    oldValue: {
      staffId: old.staff_id,
      kind: old.kind,
      startsAt: old.starts_at.toISOString(),
      endsAt: old.ends_at.toISOString(),
      note: old.note,
    },
  });
}
