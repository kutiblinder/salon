export const TIME_OFF_KINDS = ['break', 'vacation', 'sick', 'other'] as const;
export type TimeOffKind = (typeof TIME_OFF_KINDS)[number];

export const TIME_OFF_LABELS: Record<TimeOffKind, string> = {
  break: 'Pauza',
  vacation: 'Godišnji',
  sick: 'Bolovanje',
  other: 'Drugo',
};

export function isTimeOffKind(value: unknown): value is TimeOffKind {
  return typeof value === 'string' && (TIME_OFF_KINDS as readonly string[]).includes(value);
}

export interface TimeOffStaff {
  id: string;
  name: string;
  locationIds: string[];
}

export interface TimeOffRow {
  id: string;
  staffId: string;
  staffName: string;
  kind: TimeOffKind;
  /** ISO UTC */
  startsAt: string;
  endsAt: string;
  note: string | null;
}
