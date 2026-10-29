import type { AppointmentStatus } from '../appointments/status';
import { addDays, localDateOf } from '../availability/time';

const LOCALE = 'sr-Latn-RS';

/** "09:30" u vremenskoj zoni lokacije. */
export function formatTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat(LOCALE, { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
}

/** "ponedeljak, 2. novembar 2026." za lokalni datum 'YYYY-MM-DD'. */
export function formatDayLabel(date: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${date}T12:00:00Z`));
}

/**
 * Prikaz intervala odsustva. Celi dani (ponoc do ponoci) bez sati;
 * ista kalendarska noc za pauzu: datum + "12:00–13:00".
 */
export function formatTimeOffRange(start: Date, end: Date, timeZone: string): string {
  const startMs = start.getTime();
  const endMs = end.getTime();
  const startDate = localDateOf(startMs, timeZone);
  const endDate = localDateOf(endMs, timeZone);
  const startT = formatTime(start, timeZone);
  const endT = formatTime(end, timeZone);
  if (startT === '00:00' && endT === '00:00') {
    const last = addDays(endDate, -1);
    return startDate === last ? formatDayLabel(startDate) : `${formatDayLabel(startDate)} – ${formatDayLabel(last)}`;
  }
  if (startDate === endDate) return `${formatDayLabel(startDate)} ${startT}–${endT}`;
  return `${formatDayLabel(startDate)} ${startT} – ${formatDayLabel(endDate)} ${endT}`;
}

export function formatPrice(price: string, currency = 'RSD'): string {
  const amount = Number(price);
  const text = Number.isInteger(amount) ? amount.toLocaleString(LOCALE) : amount.toLocaleString(LOCALE, { minimumFractionDigits: 2 });
  return `${text} ${currency === 'RSD' ? 'din' : currency}`;
}

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending: 'Čeka potvrdu',
  confirmed: 'Potvrđen',
  cancelled_by_client: 'Otkazao klijent',
  cancelled_by_salon: 'Otkazao salon',
  completed: 'Završen',
  no_show: 'Nije došao',
};

export const STATUS_STYLES: Record<AppointmentStatus, string> = {
  pending: 'bg-amber-100 text-amber-900',
  confirmed: 'bg-emerald-100 text-emerald-900',
  cancelled_by_client: 'bg-neutral-200 text-neutral-700',
  cancelled_by_salon: 'bg-neutral-200 text-neutral-700',
  completed: 'bg-sky-100 text-sky-900',
  no_show: 'bg-rose-100 text-rose-900',
};
