export interface LocationHour {
  weekday: number;
  opens: string;
  closes: string;
}

export interface AdminLocationDetail {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  timezone: string;
  slotStepMin: number;
  isActive: boolean;
  sortOrder: number;
  hours: LocationHour[];
}

export interface AdminLocationListItem {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  isActive: boolean;
}

const TIME = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseLocationName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw.trim().replace(/\s+/g, ' ');
  return name.length >= 2 && name.length <= 80 ? name : null;
}

export function parseOptionalLine(raw: unknown, maxLength: number): string | null | undefined {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string') return undefined;
  const text = raw.trim().replace(/\s+/g, ' ');
  if (text.length === 0) return null;
  if (text.length > maxLength) return undefined;
  return text;
}

export function parseOptionalEmail(raw: unknown): string | null | undefined {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string') return undefined;
  const email = raw.trim().toLowerCase();
  if (email.length === 0) return null;
  if (!EMAIL.test(email) || email.length > 254) return undefined;
  return email;
}

export function parseSlotStep(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === '') return 15;
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isInteger(n) || n < 5 || n > 60) return null;
  return n;
}

export function parseSortOrder(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === '') return 0;
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isInteger(n) || n < 0 || n > 10_000) return null;
  return n;
}

function parseTimeHm(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const m = TIME.exec(raw.trim());
  return m ? `${m[1]}:${m[2]}` : null;
}

function hmToMinutes(hm: string): number {
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + m;
}

/** Otvoreni dani iz forme (`open_0` + `opens_0` / `closes_0`). */
export function parseHoursForm(formData: FormData): LocationHour[] | { error: string } {
  const hours: LocationHour[] = [];
  for (let weekday = 0; weekday <= 6; weekday += 1) {
    if (formData.get(`open_${weekday}`) !== 'on') continue;
    const opens = parseTimeHm(formData.get(`opens_${weekday}`));
    const closes = parseTimeHm(formData.get(`closes_${weekday}`));
    if (!opens || !closes || hmToMinutes(opens) >= hmToMinutes(closes)) {
      return { error: 'Za svaki otvoren dan unesite vreme od–do (npr. 09:00–17:00).' };
    }
    hours.push({ weekday, opens, closes });
  }
  return hours;
}
