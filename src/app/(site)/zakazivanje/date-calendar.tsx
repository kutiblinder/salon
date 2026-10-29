'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { addDays, weekdayMonday0 } from '@/lib/availability/time';

const WEEKDAYS = ['P', 'U', 'S', 'Č', 'P', 'S', 'N'];
const MONTHS = [
  'januar',
  'februar',
  'mart',
  'april',
  'maj',
  'jun',
  'jul',
  'avgust',
  'septembar',
  'oktobar',
  'novembar',
  'decembar',
];

function yearMonth(date: string): string {
  return date.slice(0, 7);
}

function monthStart(ym: string): string {
  return `${ym}-01`;
}

function monthEnd(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  return addDays(next, -1);
}

function gridRange(ym: string): { from: string; to: string; cells: string[] } {
  const first = monthStart(ym);
  const last = monthEnd(ym);
  const from = addDays(first, -weekdayMonday0(first));
  const to = addDays(last, 6 - weekdayMonday0(last));
  const cells: string[] = [];
  let d = from;
  while (d <= to) {
    cells.push(d);
    d = addDays(d, 1);
  }
  return { from, to, cells };
}

export function DateCalendar({
  locationId,
  serviceId,
  staffId,
  value,
  onChange,
}: {
  locationId: string;
  serviceId: string;
  staffId: string;
  value: string;
  onChange: (date: string) => void;
}) {
  const [month, setMonth] = useState(() => yearMonth(value || new Date().toISOString().slice(0, 10)));
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);
  onChangeRef.current = onChange;
  valueRef.current = value;

  const { from, to, cells } = useMemo(() => gridRange(month), [month]);
  const [y, m] = month.split('-').map(Number);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ locationId, serviceId, from, to });
    if (staffId) params.set('staffId', staffId);
    fetch(`/api/availability/dates?${params}`)
      .then((r) => r.json())
      .then((data: { dates?: string[] }) => {
        if (cancelled) return;
        const next = new Set(data.dates ?? []);
        setOpen(next);
        const selected = valueRef.current;
        if (selected && selected >= from && selected <= to && !next.has(selected)) onChangeRef.current('');
      })
      .catch(() => {
        if (!cancelled) setOpen(new Set());
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [locationId, serviceId, staffId, from, to]);

  const prevMonth = yearMonth(addDays(monthStart(month), -1));
  const nextMonth = yearMonth(addDays(monthEnd(month), 1));
  const today = new Date().toISOString().slice(0, 10);
  const canPrev = monthEnd(prevMonth) >= today;
  const canNext = monthStart(nextMonth) <= addDays(today, 90);

  return (
    <fieldset>
      <legend className="text-sm font-medium">Datum</legend>
      <div className="mt-2 max-w-sm rounded-lg border border-neutral-200 p-3">
        <div className="mb-2 flex items-center justify-between">
          <button type="button" className="min-h-10 px-2 text-sm disabled:opacity-30" disabled={!canPrev} onClick={() => setMonth(prevMonth)}>
            ←
          </button>
          <p className="text-sm font-medium capitalize">
            {MONTHS[m - 1]} {y}
          </p>
          <button type="button" className="min-h-10 px-2 text-sm disabled:opacity-30" disabled={!canNext} onClick={() => setMonth(nextMonth)}>
            →
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-neutral-500">
          {WEEKDAYS.map((d, i) => (
            <span key={`${d}-${i}`}>{d}</span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((d) => {
            const inMonth = yearMonth(d) === month;
            const available = open.has(d);
            const selected = value === d;
            return (
              <button
                key={d}
                type="button"
                disabled={!available}
                onClick={() => onChange(d)}
                className={`min-h-10 rounded-md text-sm ${
                  selected
                    ? 'bg-neutral-900 text-white'
                    : available
                      ? 'hover:bg-neutral-100'
                      : 'cursor-not-allowed text-neutral-300'
                } ${inMonth ? '' : 'opacity-50'}`}
              >
                {Number(d.slice(8))}
              </button>
            );
          })}
        </div>
        {loading && <p className="mt-2 text-sm text-neutral-600">Učitavanje dana…</p>}
        {!loading && open.size === 0 && (
          <p className="mt-2 text-sm text-neutral-600">Nema slobodnih dana u ovom mesecu.</p>
        )}
      </div>
    </fieldset>
  );
}
