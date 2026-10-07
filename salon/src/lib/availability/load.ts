import type { PoolClient } from 'pg';
import { addDays, weekdayMonday0, zonedTimeToUtcMs } from './time';
import { resolveShift, type ExceptionEntry, type WeeklyEntry } from './schedule';
import { computeSlots, mergeStaffSlots, type Interval } from './slots';

/** Najmanje vreme unapred za zakazivanje (minuti). Kasnije moze postati podesavanje salona. */
export const MIN_NOTICE_MIN = 30;
/** Koliko dana unapred se moze zakazati. */
export const MAX_DAYS_AHEAD = 90;

export interface AvailabilityQuery {
  organizationId: string;
  locationId: string;
  serviceId: string;
  /** null = "bilo koji radnik" */
  staffId: string | null;
  /** Lokalni datum lokacije, 'YYYY-MM-DD' */
  date: string;
  nowMs: number;
}

export interface AvailabilityResult {
  date: string;
  timezone: string;
  service: { id: string; name: string; price: string; currency: string; durationMin: number; bufferMin: number };
  /** Zaposleni koji rade ovu uslugu na lokaciji (sa njihovim trajanjem usluge) */
  staff: { id: string; name: string; durationMin: number }[];
  /** Slobodni pocetci (ISO, UTC) i ko je slobodan u tom trenutku */
  slots: { start: string; staffIds: string[] }[];
}

interface LocationServiceRow {
  timezone: string;
  slot_step_min: number;
  duration_min: number;
  buffer_min: number;
  price: string;
  currency: string;
  service_name: string;
}
interface StaffRow {
  id: string;
  display_name: string;
  duration_override_min: number | null;
}
interface WeeklyRow {
  staff_id: string;
  location_id: string;
  weekday: number;
  start_hm: string;
  end_hm: string;
}
interface ExceptionRow {
  staff_id: string;
  location_id: string | null;
  work_date: string;
  start_hm: string | null;
  end_hm: string | null;
}
interface IntervalRow {
  staff_id: string;
  s: string;
  e: string;
}

/**
 * Ucitava podatke za jedan dan i racuna slobodne termine.
 * Vraca null ako lokacija ili usluga ne postoje / nisu aktivne u ovom salonu.
 * Pozivati unutar withTenant().
 */
export async function getAvailability(
  client: PoolClient,
  q: AvailabilityQuery,
): Promise<AvailabilityResult | null> {
  // 1) Lokacija + usluga (cena i trajanje po lokaciji)
  const ls = await client.query<LocationServiceRow>(
    `SELECT l.timezone, l.slot_step_min, ls.duration_min, ls.buffer_min, ls.price::text AS price,
            ls.currency, s.name AS service_name
       FROM locations l
       JOIN location_services ls ON ls.location_id = l.id AND ls.is_active
       JOIN services s ON s.id = ls.service_id AND s.is_active AND s.organization_id = l.organization_id
      WHERE l.id = $1 AND l.organization_id = $2 AND l.is_active AND ls.service_id = $3`,
    [q.locationId, q.organizationId, q.serviceId],
  );
  const loc = ls.rows[0];
  if (!loc) return null;

  // 2) Zaposleni koji rade tu uslugu na toj lokaciji (opciono samo jedan izabrani)
  const staffRes = await client.query<StaffRow>(
    `SELECT st.id, st.display_name, ss.duration_override_min
       FROM staff st
       JOIN staff_locations sl ON sl.staff_id = st.id AND sl.location_id = $1
       JOIN staff_services ss ON ss.staff_id = st.id AND ss.service_id = $2
      WHERE st.organization_id = $3 AND st.is_active
        AND ($4::uuid IS NULL OR st.id = $4::uuid)
      ORDER BY st.sort_order, st.display_name`,
    [q.locationId, q.serviceId, q.organizationId, q.staffId],
  );
  const staff = staffRes.rows;

  const result: AvailabilityResult = {
    date: q.date,
    timezone: loc.timezone,
    service: {
      id: q.serviceId,
      name: loc.service_name,
      price: loc.price,
      currency: loc.currency,
      durationMin: loc.duration_min,
      bufferMin: loc.buffer_min,
    },
    staff: staff.map((s) => ({
      id: s.id,
      name: s.display_name,
      durationMin: s.duration_override_min ?? loc.duration_min,
    })),
    slots: [],
  };
  if (staff.length === 0) return result;
  const staffIds = staff.map((s) => s.id);

  // 3) Smene: nedeljni obrazac i izuzeci za taj datum
  const weekday = weekdayMonday0(q.date);
  const weeklyRes = await client.query<WeeklyRow>(
    `SELECT ws.staff_id, ws.location_id, ws.weekday,
            to_char(t.starts_at, 'HH24:MI') AS start_hm, to_char(t.ends_at, 'HH24:MI') AS end_hm
       FROM weekly_schedule ws
       JOIN shift_templates t ON t.id = ws.shift_template_id
      WHERE ws.staff_id = ANY($1::uuid[]) AND ws.weekday = $2`,
    [staffIds, weekday],
  );
  const exceptionRes = await client.query<ExceptionRow>(
    `SELECT se.staff_id, se.location_id, to_char(se.work_date, 'YYYY-MM-DD') AS work_date,
            to_char(t.starts_at, 'HH24:MI') AS start_hm, to_char(t.ends_at, 'HH24:MI') AS end_hm
       FROM schedule_exceptions se
       LEFT JOIN shift_templates t ON t.id = se.shift_template_id
      WHERE se.staff_id = ANY($1::uuid[]) AND se.work_date = $2::date`,
    [staffIds, q.date],
  );

  // 4) Prozor dana u UTC-u (lokalna ponoc do ponoci), za pauze i termine
  const dayStartMs = zonedTimeToUtcMs(q.date, '00:00', loc.timezone);
  const dayEndMs = zonedTimeToUtcMs(addDays(q.date, 1), '00:00', loc.timezone);
  const windowParams = [staffIds, new Date(dayStartMs).toISOString(), new Date(dayEndMs).toISOString()];

  const timeOffRes = await client.query<IntervalRow>(
    `SELECT staff_id,
            floor(extract(epoch FROM lower(during)) * 1000)::bigint::text AS s,
            floor(extract(epoch FROM upper(during)) * 1000)::bigint::text AS e
       FROM time_off
      WHERE staff_id = ANY($1::uuid[]) AND during && tstzrange($2::timestamptz, $3::timestamptz)`,
    windowParams,
  );

  // Zauzeto: pending + confirmed (isto kao exclusion constraint u bazi)
  const busyRes = await client.query<IntervalRow>(
    `SELECT staff_id,
            floor(extract(epoch FROM starts_at) * 1000)::bigint::text AS s,
            floor(extract(epoch FROM ends_at) * 1000)::bigint::text AS e
       FROM appointments
      WHERE organization_id = $4 AND staff_id = ANY($1::uuid[])
        AND status IN ('pending', 'confirmed')
        AND during && tstzrange($2::timestamptz, $3::timestamptz)`,
    [...windowParams, q.organizationId],
  );

  const groupIntervals = (rows: IntervalRow[]): Map<string, Interval[]> => {
    const m = new Map<string, Interval[]>();
    for (const r of rows) {
      const list = m.get(r.staff_id) ?? [];
      list.push({ start: Number(r.s), end: Number(r.e) });
      m.set(r.staff_id, list);
    }
    return m;
  };
  const timeOffByStaff = groupIntervals(timeOffRes.rows);
  const busyByStaff = groupIntervals(busyRes.rows);

  // 5) Slobodni pocetci po zaposlenom, pa spajanje
  const earliestStartMs = q.nowMs + MIN_NOTICE_MIN * 60_000;
  const perStaff = staff.map((s) => {
    const weekly: WeeklyEntry[] = weeklyRes.rows
      .filter((r) => r.staff_id === s.id)
      .map((r) => ({ locationId: r.location_id, weekday: r.weekday, shift: { start: r.start_hm, end: r.end_hm } }));
    const exceptions: ExceptionEntry[] = exceptionRes.rows
      .filter((r) => r.staff_id === s.id)
      .map((r) => ({
        workDate: r.work_date,
        locationId: r.location_id,
        shift: r.start_hm && r.end_hm ? { start: r.start_hm, end: r.end_hm } : null,
      }));
    const shift = resolveShift({ date: q.date, locationId: q.locationId, weekly, exceptions });
    const starts = computeSlots({
      date: q.date,
      timezone: loc.timezone,
      stepMin: loc.slot_step_min,
      durationMin: s.duration_override_min ?? loc.duration_min,
      bufferMin: loc.buffer_min,
      shift,
      timeOff: timeOffByStaff.get(s.id) ?? [],
      busy: busyByStaff.get(s.id) ?? [],
      earliestStartMs,
    });
    return { staffId: s.id, starts };
  });

  result.slots = mergeStaffSlots(perStaff).map((m) => ({
    start: new Date(m.start).toISOString(),
    staffIds: m.staffIds,
  }));
  return result;
}
