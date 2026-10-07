import { hmToMinutes, zonedTimeToUtcMs } from './time';
import type { ShiftWindow } from './schedule';

/** Poluotvoren interval [start, end) u UTC milisekundama. */
export interface Interval {
  start: number;
  end: number;
}

export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

export interface SlotParams {
  /** Lokalni datum lokacije, 'YYYY-MM-DD' */
  date: string;
  /** IANA zona lokacije, npr. 'Europe/Belgrade' */
  timezone: string;
  /** Korak pocetaka termina u minutima (locations.slot_step_min) */
  stepMin: number;
  /** Trajanje same usluge u minutima */
  durationMin: number;
  /** Priprema/ciscenje posle usluge. Blokira slot, ali ne mora da stane u smenu. */
  bufferMin: number;
  /** Smena zaposlenog tog dana (null = ne radi) */
  shift: ShiftWindow | null;
  /** Pauze i odsustva zaposlenog */
  timeOff: Interval[];
  /**
   * Zauzeti intervali zaposlenog (pending + confirmed termini).
   * Pretpostavka: appointments.ends_at = pocetak + trajanje + buffer.
   */
  busy: Interval[];
  /** Najraniji dozvoljeni pocetak (npr. sada + minimalno vreme unapred) */
  earliestStartMs?: number;
}

/**
 * Racuna slobodne pocetke termina jednog zaposlenog za jedan dan.
 * Cista funkcija: bez baze, bez trenutnog vremena, lako se testira.
 *
 * Pravila:
 * - pocetci su poravnati na mrezu `stepMin` (po lokalnom satu, npr. 08:00, 08:15, ...);
 * - sama usluga mora cela da stane u smenu i ne sme da se preklapa sa pauzom/odsustvom;
 * - blok usluga + buffer ne sme da se preklapa ni sa jednim postojecim terminom.
 *
 * Ogranicenje: smena preko ponoci nije podrzana. Smena koja prelazi u/iz letnjeg vremena
 * (promena u 02:00/03:00) racuna se po pomeraju na pocetku smene.
 */
export function computeSlots(p: SlotParams): number[] {
  if (!(p.stepMin > 0)) throw new Error('stepMin must be > 0');
  if (!(p.durationMin > 0)) throw new Error('durationMin must be > 0');
  if (p.bufferMin < 0) throw new Error('bufferMin must be >= 0');
  if (!p.shift) return [];

  const shiftStartMin = hmToMinutes(p.shift.start);
  const shiftEndMin = hmToMinutes(p.shift.end);
  if (shiftEndMin <= shiftStartMin) return [];

  const shiftStartMs = zonedTimeToUtcMs(p.date, p.shift.start, p.timezone);
  const shiftEndMs = shiftStartMs + (shiftEndMin - shiftStartMin) * 60_000;

  const firstMinute = Math.ceil(shiftStartMin / p.stepMin) * p.stepMin;
  const slots: number[] = [];

  for (let minute = firstMinute; minute < shiftEndMin; minute += p.stepMin) {
    const start = shiftStartMs + (minute - shiftStartMin) * 60_000;
    const serviceEnd = start + p.durationMin * 60_000;
    if (serviceEnd > shiftEndMs) break; // dalji pocetci takodje ne staju

    if (p.earliestStartMs !== undefined && start < p.earliestStartMs) continue;

    const service: Interval = { start, end: serviceEnd };
    const block: Interval = { start, end: serviceEnd + p.bufferMin * 60_000 };

    if (p.timeOff.some((t) => overlaps(service, t))) continue;
    if (p.busy.some((b) => overlaps(block, b))) continue;

    slots.push(start);
  }
  return slots;
}

export interface StaffSlots {
  staffId: string;
  starts: number[];
}

export interface MergedSlot {
  start: number;
  /** Zaposleni koji su slobodni u tom trenutku (redosled kao u ulazu) */
  staffIds: string[];
}

/** Spaja slobodne pocetke vise zaposlenih za opciju "bilo koji radnik". Sortirano po vremenu. */
export function mergeStaffSlots(list: StaffSlots[]): MergedSlot[] {
  const byStart = new Map<number, string[]>();
  for (const { staffId, starts } of list) {
    for (const start of starts) {
      const ids = byStart.get(start);
      if (ids) ids.push(staffId);
      else byStart.set(start, [staffId]);
    }
  }
  return [...byStart.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([start, staffIds]) => ({ start, staffIds }));
}

/**
 * Bira zaposlenog za "bilo koji radnik": onog sa najmanje termina tog dana.
 * Pri izjednacenju pobedjuje prvi u listi kandidata (deterministicki).
 */
export function pickStaff(candidates: string[], load: Map<string, number>): string {
  if (candidates.length === 0) throw new Error('No candidates');
  let best = candidates[0];
  let bestLoad = load.get(best) ?? 0;
  for (const id of candidates.slice(1)) {
    const l = load.get(id) ?? 0;
    if (l < bestLoad) {
      best = id;
      bestLoad = l;
    }
  }
  return best;
}
