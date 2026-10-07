import { weekdayMonday0 } from './time';

export interface ShiftWindow {
  /** 'HH:MM' lokalno vreme lokacije */
  start: string;
  end: string;
}

/** Red iz weekly_schedule (spojen sa shift_templates). */
export interface WeeklyEntry {
  locationId: string;
  /** 0 = ponedeljak ... 6 = nedelja */
  weekday: number;
  shift: ShiftWindow;
}

/** Red iz schedule_exceptions (spojen sa shift_templates). shift = null znaci slobodan dan. */
export interface ExceptionEntry {
  workDate: string;
  locationId: string | null;
  shift: ShiftWindow | null;
}

/**
 * Odredjuje smenu zaposlenog na datoj lokaciji tog dana, ili null ako ne radi.
 * Izuzetak za datum ima prednost nad nedeljnim obrascem.
 * Izuzetak sa smenom mora imati lokaciju; ako je nema, tretira se kao da ne radi
 * (bezbednije je ne ponuditi termin nego ponuditi pogresan).
 */
export function resolveShift(input: {
  date: string;
  locationId: string;
  weekly: WeeklyEntry[];
  exceptions: ExceptionEntry[];
}): ShiftWindow | null {
  const exception = input.exceptions.find((e) => e.workDate === input.date);
  if (exception) {
    if (!exception.shift) return null;
    if (exception.locationId !== input.locationId) return null;
    return exception.shift;
  }
  const weekday = weekdayMonday0(input.date);
  const entry = input.weekly.find(
    (w) => w.weekday === weekday && w.locationId === input.locationId,
  );
  return entry ? entry.shift : null;
}
