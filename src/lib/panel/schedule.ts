import type { PoolClient } from 'pg';
import { writeAudit } from '../audit';
import { hmToMinutes } from '../availability/time';
import { PanelError, type PanelContext } from './core';
import { WEEKDAYS, type ScheduleExceptionRow, type ShiftTemplate, type StaffWeekly, type WeeklyDay } from './schedule-types';

export { WEEKDAYS, type ScheduleExceptionRow, type ShiftTemplate, type StaffWeekly, type WeeklyDay } from './schedule-types';

const TIME = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** 'HH:MM' ili 'HH:MM:SS' -> 'HH:MM', inace null. */
export function parseTimeHm(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const m = TIME.exec(raw.trim());
  return m ? `${m[1]}:${m[2]}` : null;
}

export function parseShiftWindow(start: unknown, end: unknown): { start: string; end: string } | null {
  const s = parseTimeHm(start);
  const e = parseTimeHm(end);
  if (!s || !e || hmToMinutes(s) >= hmToMinutes(e)) return null;
  return { start: s, end: e };
}

export function parseTemplateName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw.trim().replace(/\s+/g, ' ');
  return name.length > 0 && name.length <= 80 ? name : null;
}

export function isWeekday(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 6;
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

export function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export async function loadShiftTemplates(client: PoolClient, organizationId: string, locationId: string) {
  const res = await client.query<ShiftTemplate>(
    `SELECT t.id, t.location_id AS "locationId", t.name,
            to_char(t.starts_at, 'HH24:MI') AS "startsAt",
            to_char(t.ends_at, 'HH24:MI') AS "endsAt"
       FROM shift_templates t
       JOIN locations l ON l.id = t.location_id
      WHERE l.organization_id = $1 AND t.location_id = $2
      ORDER BY t.starts_at, t.name`,
    [organizationId, locationId],
  );
  return res.rows;
}

export async function loadWeeklyByLocation(
  client: PoolClient,
  ctx: PanelContext,
  locationId: string,
  staff: { id: string; name: string }[],
): Promise<StaffWeekly[]> {
  if (staff.length === 0) return [];
  const ids = staff.map((s) => s.id);
  const res = await client.query<{
    staff_id: string;
    location_id: string;
    weekday: number;
    template_id: string;
    template_name: string;
    location_name: string;
  }>(
    `SELECT ws.staff_id, ws.location_id, ws.weekday, ws.shift_template_id AS template_id,
            t.name AS template_name, l.name AS location_name
       FROM weekly_schedule ws
       JOIN shift_templates t ON t.id = ws.shift_template_id
       JOIN locations l ON l.id = ws.location_id
       JOIN staff s ON s.id = ws.staff_id
      WHERE s.organization_id = $1 AND ws.staff_id = ANY($2::uuid[])`,
    [ctx.organizationId, ids],
  );

  return staff.map((s) => {
    const days: WeeklyDay[] = WEEKDAYS.map((d) => {
      const row = res.rows.find((r) => r.staff_id === s.id && Number(r.weekday) === d.value);
      if (!row) return { weekday: d.value, templateId: null, otherLocation: null };
      if (row.location_id === locationId) {
        return { weekday: d.value, templateId: row.template_id, otherLocation: null };
      }
      return {
        weekday: d.value,
        templateId: null,
        otherLocation: { id: row.location_id, name: row.location_name, templateName: row.template_name },
      };
    });
    return { staffId: s.id, name: s.name, days };
  });
}

export async function loadExceptions(
  client: PoolClient,
  organizationId: string,
  staffIds: string[],
  fromDate: string,
): Promise<ScheduleExceptionRow[]> {
  if (staffIds.length === 0) return [];
  const res = await client.query<{
    staff_id: string;
    staff_name: string;
    work_date: string;
    location_id: string | null;
    location_name: string | null;
    template_id: string | null;
    template_name: string | null;
    starts_at: string | null;
    ends_at: string | null;
  }>(
    `SELECT se.staff_id, s.display_name AS staff_name, to_char(se.work_date, 'YYYY-MM-DD') AS work_date,
            se.location_id, l.name AS location_name, se.shift_template_id AS template_id,
            t.name AS template_name,
            to_char(t.starts_at, 'HH24:MI') AS starts_at,
            to_char(t.ends_at, 'HH24:MI') AS ends_at
       FROM schedule_exceptions se
       JOIN staff s ON s.id = se.staff_id
       LEFT JOIN locations l ON l.id = se.location_id
       LEFT JOIN shift_templates t ON t.id = se.shift_template_id
      WHERE s.organization_id = $1 AND se.staff_id = ANY($2::uuid[]) AND se.work_date >= $3::date
      ORDER BY se.work_date, s.sort_order, s.display_name`,
    [organizationId, staffIds, fromDate],
  );
  return res.rows.map((r) => ({
    staffId: r.staff_id,
    staffName: r.staff_name,
    date: r.work_date,
    locationId: r.location_id,
    locationName: r.location_name,
    templateId: r.template_id,
    templateName: r.template_name,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
  }));
}

async function requireLocation(ctx: PanelContext, locationId: string) {
  const loc = ctx.locations.find((l) => l.id === locationId);
  if (!loc) throw new PanelError('Lokacija ne postoji.');
  return loc;
}

/** Sabloni nemaju zaposlenog: samo nalog sa dozvolom nad celom lokacijom (ne own_only). */
function requireTemplates(ctx: PanelContext, locationId: string) {
  ctx.require('schedule.manage', { locationId, staffId: null });
}

async function loadOwnedTemplate(client: PoolClient, organizationId: string, templateId: string) {
  const res = await client.query<ShiftTemplate>(
    `SELECT t.id, t.location_id AS "locationId", t.name,
            to_char(t.starts_at, 'HH24:MI') AS "startsAt",
            to_char(t.ends_at, 'HH24:MI') AS "endsAt"
       FROM shift_templates t
       JOIN locations l ON l.id = t.location_id
      WHERE t.id = $1 AND l.organization_id = $2`,
    [templateId, organizationId],
  );
  const row = res.rows[0];
  if (!row) throw new PanelError('Šablon ne postoji.');
  return row;
}

async function requireStaffAtLocation(
  client: PoolClient,
  organizationId: string,
  staffId: string,
  locationId: string,
) {
  const res = await client.query(
    `SELECT 1 FROM staff s
       JOIN staff_locations sl ON sl.staff_id = s.id AND sl.location_id = $3
      WHERE s.id = $1 AND s.organization_id = $2 AND s.is_active`,
    [staffId, organizationId, locationId],
  );
  if (res.rowCount === 0) throw new PanelError('Zaposleni ne radi na ovoj lokaciji.');
}

export async function createShiftTemplate(
  client: PoolClient,
  ctx: PanelContext,
  input: { locationId: string; name: string; start: string; end: string },
): Promise<{ id: string }> {
  await requireLocation(ctx, input.locationId);
  requireTemplates(ctx, input.locationId);
  const ins = await client.query<{ id: string }>(
    `INSERT INTO shift_templates (location_id, name, starts_at, ends_at)
     VALUES ($1, $2, $3::time, $4::time) RETURNING id`,
    [input.locationId, input.name, input.start, input.end],
  );
  const id = ins.rows[0].id;
  await writeAudit(client, {
    organizationId: ctx.organizationId,
    userId: ctx.actor.userId,
    action: 'schedule.template.create',
    objectType: 'shift_template',
    objectId: id,
    newValue: input,
  });
  return { id };
}

export async function updateShiftTemplate(
  client: PoolClient,
  ctx: PanelContext,
  input: { templateId: string; name: string; start: string; end: string },
): Promise<void> {
  const old = await loadOwnedTemplate(client, ctx.organizationId, input.templateId);
  requireTemplates(ctx, old.locationId);
  await client.query(
    `UPDATE shift_templates SET name = $2, starts_at = $3::time, ends_at = $4::time WHERE id = $1`,
    [input.templateId, input.name, input.start, input.end],
  );
  await writeAudit(client, {
    organizationId: ctx.organizationId,
    userId: ctx.actor.userId,
    action: 'schedule.template.update',
    objectType: 'shift_template',
    objectId: input.templateId,
    oldValue: { name: old.name, start: old.startsAt, end: old.endsAt },
    newValue: { name: input.name, start: input.start, end: input.end },
  });
}

export async function deleteShiftTemplate(client: PoolClient, ctx: PanelContext, templateId: string): Promise<void> {
  const old = await loadOwnedTemplate(client, ctx.organizationId, templateId);
  requireTemplates(ctx, old.locationId);
  const used = await client.query<{ n: number }>(
    `SELECT (
       (SELECT count(*) FROM weekly_schedule WHERE shift_template_id = $1) +
       (SELECT count(*) FROM schedule_exceptions WHERE shift_template_id = $1)
     )::int AS n`,
    [templateId],
  );
  if (used.rows[0].n > 0) {
    throw new PanelError('Šablon se koristi u rasporedu. Prvo ga sklonite sa dana i izuzetaka.');
  }
  await client.query('DELETE FROM shift_templates WHERE id = $1', [templateId]);
  await writeAudit(client, {
    organizationId: ctx.organizationId,
    userId: ctx.actor.userId,
    action: 'schedule.template.delete',
    objectType: 'shift_template',
    objectId: templateId,
    oldValue: { name: old.name, start: old.startsAt, end: old.endsAt, locationId: old.locationId },
  });
}

/**
 * Postavlja smenu za jedan dan u nedelji na ovoj lokaciji.
 * templateId null: brise samo unos ove lokacije (raspored na drugoj lokaciji ostaje).
 * Predaja sablona prepisuje i dan koji je bio na drugoj lokaciji (PK je staff+weekday).
 */
export async function setWeeklyDay(
  client: PoolClient,
  ctx: PanelContext,
  input: { staffId: string; locationId: string; weekday: number; templateId: string | null },
): Promise<void> {
  await requireLocation(ctx, input.locationId);
  ctx.require('schedule.manage', { locationId: input.locationId, staffId: input.staffId });
  await requireStaffAtLocation(client, ctx.organizationId, input.staffId, input.locationId);

  const prev = await client.query<{ location_id: string; shift_template_id: string }>(
    `SELECT location_id, shift_template_id FROM weekly_schedule WHERE staff_id = $1 AND weekday = $2`,
    [input.staffId, input.weekday],
  );
  const old = prev.rows[0] ?? null;

  if (input.templateId === null) {
    if (!old || old.location_id !== input.locationId) return;
    await client.query(`DELETE FROM weekly_schedule WHERE staff_id = $1 AND weekday = $2 AND location_id = $3`, [
      input.staffId,
      input.weekday,
      input.locationId,
    ]);
  } else {
    const template = await loadOwnedTemplate(client, ctx.organizationId, input.templateId);
    if (template.locationId !== input.locationId) throw new PanelError('Šablon ne pripada ovoj lokaciji.');
    await client.query(
      `INSERT INTO weekly_schedule (staff_id, location_id, weekday, shift_template_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (staff_id, weekday) DO UPDATE
         SET location_id = EXCLUDED.location_id, shift_template_id = EXCLUDED.shift_template_id`,
      [input.staffId, input.locationId, input.weekday, input.templateId],
    );
  }

  await writeAudit(client, {
    organizationId: ctx.organizationId,
    userId: ctx.actor.userId,
    action: 'schedule.weekly.set',
    objectType: 'weekly_schedule',
    objectId: `${input.staffId}:${input.weekday}`,
    oldValue: old,
    newValue: { locationId: input.locationId, weekday: input.weekday, templateId: input.templateId },
  });
}

export async function upsertException(
  client: PoolClient,
  ctx: PanelContext,
  input:
    | { staffId: string; date: string; kind: 'off'; locationId: string }
    | { staffId: string; date: string; kind: 'shift'; locationId: string; templateId: string },
): Promise<void> {
  await requireLocation(ctx, input.locationId);
  ctx.require('schedule.manage', { locationId: input.locationId, staffId: input.staffId });
  await requireStaffAtLocation(client, ctx.organizationId, input.staffId, input.locationId);

  let locationId: string | null = null;
  let templateId: string | null = null;
  if (input.kind === 'shift') {
    const template = await loadOwnedTemplate(client, ctx.organizationId, input.templateId);
    if (template.locationId !== input.locationId) throw new PanelError('Šablon ne pripada ovoj lokaciji.');
    locationId = input.locationId;
    templateId = input.templateId;
  }

  const prev = await client.query<{ location_id: string | null; shift_template_id: string | null }>(
    `SELECT location_id, shift_template_id FROM schedule_exceptions WHERE staff_id = $1 AND work_date = $2::date`,
    [input.staffId, input.date],
  );
  await client.query(
    `INSERT INTO schedule_exceptions (staff_id, work_date, location_id, shift_template_id)
     VALUES ($1, $2::date, $3, $4)
     ON CONFLICT (staff_id, work_date) DO UPDATE
       SET location_id = EXCLUDED.location_id, shift_template_id = EXCLUDED.shift_template_id`,
    [input.staffId, input.date, locationId, templateId],
  );
  await writeAudit(client, {
    organizationId: ctx.organizationId,
    userId: ctx.actor.userId,
    action: 'schedule.exception.upsert',
    objectType: 'schedule_exception',
    objectId: `${input.staffId}:${input.date}`,
    oldValue: prev.rows[0] ?? null,
    newValue: { kind: input.kind, locationId, templateId },
  });
}

export async function deleteException(
  client: PoolClient,
  ctx: PanelContext,
  input: { staffId: string; date: string; locationId: string },
): Promise<void> {
  await requireLocation(ctx, input.locationId);
  ctx.require('schedule.manage', { locationId: input.locationId, staffId: input.staffId });
  const prev = await client.query<{ staff_id: string; location_id: string | null; shift_template_id: string | null }>(
    `SELECT se.staff_id, se.location_id, se.shift_template_id
       FROM schedule_exceptions se
       JOIN staff s ON s.id = se.staff_id
      WHERE se.staff_id = $1 AND se.work_date = $2::date AND s.organization_id = $3`,
    [input.staffId, input.date, ctx.organizationId],
  );
  const old = prev.rows[0];
  if (!old) throw new PanelError('Izuzetak ne postoji.');
  if (old.location_id && old.location_id !== input.locationId) {
    ctx.require('schedule.manage', { locationId: old.location_id, staffId: input.staffId });
  }
  await client.query(`DELETE FROM schedule_exceptions WHERE staff_id = $1 AND work_date = $2::date`, [
    input.staffId,
    input.date,
  ]);
  await writeAudit(client, {
    organizationId: ctx.organizationId,
    userId: ctx.actor.userId,
    action: 'schedule.exception.delete',
    objectType: 'schedule_exception',
    objectId: `${input.staffId}:${input.date}`,
    oldValue: old,
  });
}
