/**
 * Pomocne funkcije za datume i vremenske zone, bez spoljnih biblioteka.
 * Datum se prenosi kao 'YYYY-MM-DD' (lokalni datum lokacije), vreme kao 'HH:MM'.
 * Trenuci se prenose kao milisekunde od epohe (UTC).
 */

const dtfCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = dtfCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    dtfCache.set(timeZone, f);
  }
  return f;
}

/** Pomeraj zone od UTC u milisekundama u datom trenutku (npr. +2h leti u Beogradu). */
export function tzOffsetMs(timeZone: string, utcMs: number): number {
  const parts = getFormatter(timeZone).formatToParts(new Date(utcMs));
  const get = (type: string): number => {
    const part = parts.find((p) => p.type === type);
    if (!part) throw new Error(`Missing date part: ${type}`);
    return Number(part.value);
  };
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** Lokalni datum + vreme u datoj zoni -> UTC milisekunde. */
export function zonedTimeToUtcMs(date: string, time: string, timeZone: string): number {
  const [y, m, d] = parseDate(date);
  const [hh, mm] = time.split(':').map(Number);
  const localAsUtc = Date.UTC(y, m - 1, d, hh, mm);
  const firstGuess = localAsUtc - tzOffsetMs(timeZone, localAsUtc);
  // Drugi prolaz ispravlja rezultat kad je pomeraj drugaciji u trenutku pogotka (letnje vreme).
  return localAsUtc - tzOffsetMs(timeZone, firstGuess);
}

export function parseDate(date: string): [number, number, number] {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error(`Invalid date: ${date}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** Dodaje dane na 'YYYY-MM-DD' datum. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = parseDate(date);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** Dan u nedelji: 0 = ponedeljak ... 6 = nedelja (isto kao u bazi). */
export function weekdayMonday0(date: string): number {
  const [y, m, d] = parseDate(date);
  const sundayFirst = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return (sundayFirst + 6) % 7;
}

/** 'HH:MM' -> minuti od ponoci. */
export function hmToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** Lokalni datum u zoni za dati trenutak. */
export function localDateOf(utcMs: number, timeZone: string): string {
  const shifted = new Date(utcMs + tzOffsetMs(timeZone, utcMs));
  return shifted.toISOString().slice(0, 10);
}
