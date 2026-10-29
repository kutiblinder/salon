export const SALON_ROLES = ['owner', 'manager', 'staff'] as const;
export type SalonRole = (typeof SALON_ROLES)[number];

export const ROLE_LABELS: Record<SalonRole, string> = {
  owner: 'Vlasnik',
  manager: 'Menadžer',
  staff: 'Zaposleni',
};

export interface SalonAccount {
  userId: string;
  name: string;
  email: string;
  roles: SalonRole[];
}

export type CreateAccountResult =
  | { kind: 'created'; email: string; password: string; role: SalonRole }
  | { kind: 'linked'; email: string; role: SalonRole };

export function parseSalonRole(raw: unknown): SalonRole | null {
  return typeof raw === 'string' && (SALON_ROLES as readonly string[]).includes(raw) ? (raw as SalonRole) : null;
}

/** Prazno = sistem pravi lozinku; inače 8–128 znakova. */
export function parseOptionalPassword(raw: unknown): string | null | undefined {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string') return undefined;
  if (raw.length === 0) return null;
  if (raw.length < 8 || raw.length > 128) return undefined;
  return raw;
}
