const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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

/** Proverava telo zahteva POST /api/appointments (gost, bez naloga). */
export function parseGuestBooking(body: unknown): ValidationResult<GuestBookingInput> {
  if (typeof body !== 'object' || body === null) return { ok: false, error: 'invalid_body' };
  const b = body as Record<string, unknown>;

  const staffId = b.staffId ?? null;
  if (
    typeof b.locationId !== 'string' || !UUID.test(b.locationId) ||
    typeof b.serviceId !== 'string' || !UUID.test(b.serviceId) ||
    (staffId !== null && (typeof staffId !== 'string' || !UUID.test(staffId)))
  ) {
    return { ok: false, error: 'invalid_id' };
  }

  if (typeof b.start !== 'string' || !ISO_UTC.test(b.start)) return { ok: false, error: 'invalid_start' };
  const startMs = Date.parse(b.start);
  if (Number.isNaN(startMs)) return { ok: false, error: 'invalid_start' };

  if (b.privacyConsent !== true) return { ok: false, error: 'consent_required' };

  const g = (typeof b.guest === 'object' && b.guest !== null ? b.guest : {}) as Record<string, unknown>;
  const name = cleanText(g.name, 100);
  if (!name) return { ok: false, error: 'invalid_name' };
  const phone = typeof g.phone === 'string' ? normalizePhone(g.phone) : null;
  if (!phone) return { ok: false, error: 'invalid_phone' };
  const email = cleanText(g.email, 254);
  if (!email || !EMAIL.test(email)) return { ok: false, error: 'invalid_email' };

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
      guest: { name, phone, email: email.toLowerCase() },
      note,
    },
  };
}
