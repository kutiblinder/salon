import { isId } from '../ids';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Pocetak termina tacno kako ga vraca GET /api/availability (ISO, UTC). */
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?Z$/;

export interface GuestBookingInput {
  locationId: string;
  serviceId: string;
  /** null = "bilo koji radnik" */
  staffId: string | null;
  startMs: number;
  guest: { name: string; phone: string; email: string };
  note: string | null;
}

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

/**
 * Srpski brojevi u E.164 obliku (+381...). Prihvata 06x..., 381..., 00381..., +381...
 * i strane brojeve sa +. Vraca null za neispravan broj.
 */
export function normalizePhone(raw: string): string | null {
  const compact = raw.replace(/[\s\-/().]/g, '');
  let digits: string;
  if (compact.startsWith('+')) digits = compact.slice(1);
  else if (compact.startsWith('00')) digits = compact.slice(2);
  else if (compact.startsWith('0')) digits = `381${compact.slice(1)}`;
  else if (compact.startsWith('381')) digits = compact;
  else return null;
  if (!/^\d{8,15}$/.test(digits)) return null;
  if (digits.startsWith('381') && !/^381[1-9]\d{6,9}$/.test(digits)) return null;
  return `+${digits}`;
}

function cleanText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim().replace(/\s+/g, ' ');
  return text.length > 0 && text.length <= maxLength ? text : null;
}


export interface StaffBookingInput extends Omit<GuestBookingInput, 'guest'> {
  guest: { name: string; phone: string; email: string | null };
}

type ParsedEmail = { ok: true; value: string | null } | { ok: false; error: string };

function parseEmail(value: unknown, required: boolean): ParsedEmail {
  if (!required && (value === undefined || value === null || (typeof value === 'string' && value.trim() === ''))) {
    return { ok: true, value: null };
  }
  const email = cleanText(value, 254);
  if (!email || !EMAIL.test(email)) return { ok: false, error: 'invalid_email' };
  return { ok: true, value: email.toLowerCase() };
}

/** Zajednicki deo: lokacija, usluga, radnik, pocetak, (saglasnost), ime, telefon, email, napomena. */
function parseBooking(
  b: Record<string, unknown>,
  g: Record<string, unknown>,
  opts: { consentRequired: boolean; emailRequired: boolean },
): ValidationResult<StaffBookingInput> {
  const staffId = b.staffId ?? null;
  if (
    typeof b.locationId !== 'string' || !isId(b.locationId) ||
    typeof b.serviceId !== 'string' || !isId(b.serviceId) ||
    (staffId !== null && (typeof staffId !== 'string' || !isId(staffId)))
  ) {
    return { ok: false, error: 'invalid_id' };
  }

  if (typeof b.start !== 'string' || !ISO_UTC.test(b.start)) return { ok: false, error: 'invalid_start' };
  const startMs = Date.parse(b.start);
  if (Number.isNaN(startMs)) return { ok: false, error: 'invalid_start' };

  if (opts.consentRequired && b.privacyConsent !== true) return { ok: false, error: 'consent_required' };

  const name = cleanText(g.name, 100);
  if (!name) return { ok: false, error: 'invalid_name' };
  const phone = typeof g.phone === 'string' ? normalizePhone(g.phone) : null;
  if (!phone) return { ok: false, error: 'invalid_phone' };
  const email = parseEmail(g.email, opts.emailRequired);
  if (!email.ok) return email;

  let note: string | null = null;
  if (b.note !== undefined && b.note !== null && b.note !== '') {
    note = cleanText(b.note, 500);
    if (!note) return { ok: false, error: 'invalid_note' };
  }

  return {
    ok: true,
    value: {
      locationId: b.locationId.toLowerCase(),
      serviceId: b.serviceId.toLowerCase(),
      staffId: staffId === null ? null : (staffId as string).toLowerCase(),
      startMs,
      guest: { name, phone, email: email.value },
      note,
    },
  };
}

/** Proverava telo zahteva POST /api/appointments (gost, bez naloga). */
export function parseGuestBooking(body: unknown): ValidationResult<GuestBookingInput> {
  if (typeof body !== 'object' || body === null) return { ok: false, error: 'invalid_body' };
  const b = body as Record<string, unknown>;
  const g = (typeof b.guest === 'object' && b.guest !== null ? b.guest : {}) as Record<string, unknown>;
  return parseBooking(b, g, { consentRequired: true, emailRequired: true }) as ValidationResult<GuestBookingInput>;
}

/**
 * Termin koji unosi salon iz panela (polja forme). Email je opcion, saglasnost se ne trazi
 * (podatke unosi salon); prazan staffId = "bilo koji radnik".
 */
export function parseStaffBooking(fields: Record<string, unknown>): ValidationResult<StaffBookingInput> {
  const b = { ...fields, staffId: fields.staffId === '' || fields.staffId === undefined ? null : fields.staffId };
  return parseBooking(b, fields, { consentRequired: false, emailRequired: false });
}

/** Ulogovani klijent: isti slot kao gost. Ime i telefon sa forme, ili sa naloga. */
export function parseClientBooking(
  body: unknown,
  account: { name: string; phone: string | null; email: string },
): ValidationResult<StaffBookingInput> {
  if (typeof body !== 'object' || body === null) return { ok: false, error: 'invalid_body' };
  const raw = body as Record<string, unknown>;
  const g = (typeof raw.guest === 'object' && raw.guest !== null ? raw.guest : {}) as Record<string, unknown>;
  const b = { ...raw, staffId: raw.staffId ?? null };
  return parseBooking(
    b,
    {
      name: typeof g.name === 'string' && g.name.trim() ? g.name : account.name,
      phone: typeof g.phone === 'string' && g.phone.trim() ? g.phone : (account.phone ?? ''),
      email: account.email,
    },
    { consentRequired: false, emailRequired: false },
  );
}