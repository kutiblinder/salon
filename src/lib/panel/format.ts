import type { AppointmentStatus } from '../appointments/status';

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
