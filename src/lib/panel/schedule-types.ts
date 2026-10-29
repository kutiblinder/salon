export const WEEKDAYS = [
  { value: 0, label: 'Ponedeljak', short: 'Pon' },
  { value: 1, label: 'Utorak', short: 'Uto' },
  { value: 2, label: 'Sreda', short: 'Sre' },
  { value: 3, label: 'Četvrtak', short: 'Čet' },
  { value: 4, label: 'Petak', short: 'Pet' },
  { value: 5, label: 'Subota', short: 'Sub' },
  { value: 6, label: 'Nedelja', short: 'Ned' },
] as const;

export interface ShiftTemplate {
  id: string;
  locationId: string;
  name: string;
  startsAt: string;
  endsAt: string;
}

export interface WeeklyDay {
  weekday: number;
  /** Smena na ovoj lokaciji; null = ne radi ovde tog dana */
  templateId: string | null;
  /** Ako radi na drugoj lokaciji tog dana */
  otherLocation: { id: string; name: string; templateName: string } | null;
}

export interface StaffWeekly {
  staffId: string;
  name: string;
  days: WeeklyDay[];
}

export interface ScheduleExceptionRow {
  staffId: string;
  staffName: string;
  date: string;
  locationId: string | null;
  locationName: string | null;
  templateId: string | null;
  templateName: string | null;
  startsAt: string | null;
  endsAt: string | null;
}
