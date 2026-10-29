'use client';

import { useEffect, useState, useTransition } from 'react';
import { WEEKDAYS, type ShiftTemplate, type StaffWeekly } from '@/lib/panel/schedule-types';
import { saveWeeklyDay } from './actions';

export function WeeklyEditor({
  locationId,
  templates,
  weekly,
}: {
  locationId: string;
  templates: ShiftTemplate[];
  weekly: StaffWeekly[];
}) {
  const [error, setError] = useState<string | null>(null);

  if (weekly.length === 0) {
    return (
      <section className="rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="font-medium">Nedeljni raspored</h2>
        <p className="mt-2 text-sm text-neutral-600">Na ovoj lokaciji nema zaposlenih.</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4">
      <h2 className="font-medium">Nedeljni raspored</h2>
      <p className="mt-1 text-sm text-neutral-600">
        Jedna smena dnevno po radniku. Ako radi u drugom objektu tog dana, prebacivanje ovde zamenjuje taj unos.
      </p>
      {error && <p className="mt-2 text-sm text-rose-700">{error}</p>}
      <div className="mt-4 space-y-6">
        {weekly.map((s) => (
          <article key={s.staffId}>
            <h3 className="font-medium">{s.name}</h3>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {s.days.map((day) => (
                <li key={day.weekday} className="flex items-center gap-2">
                  <span className="w-10 shrink-0 text-sm text-neutral-600">
                    {WEEKDAYS.find((w) => w.value === day.weekday)?.short}
                  </span>
                  <DaySelect
                    staffId={s.staffId}
                    locationId={locationId}
                    weekday={day.weekday}
                    templateId={day.templateId}
                    otherLocation={day.otherLocation}
                    templates={templates}
                    onError={setError}
                  />
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}

function DaySelect({
  staffId,
  locationId,
  weekday,
  templateId,
  otherLocation,
  templates,
  onError,
}: {
  staffId: string;
  locationId: string;
  weekday: number;
  templateId: string | null;
  otherLocation: StaffWeekly['days'][number]['otherLocation'];
  templates: ShiftTemplate[];
  onError: (msg: string | null) => void;
}) {
  const [pending, startTransition] = useTransition();
  const current = otherLocation ? '__other__' : (templateId ?? '');
  const [value, setValue] = useState(current);
  useEffect(() => {
    setValue(current);
  }, [current]);

  return (
    <select
      className="min-h-10 w-full rounded-md border border-neutral-300 px-2 text-sm"
      value={value}
      disabled={pending || templates.length === 0}
      onChange={(e) => {
        const next = e.target.value;
        const previous = value;
        setValue(next);
        onError(null);
        startTransition(async () => {
          const result = await saveWeeklyDay(staffId, locationId, weekday, next);
          if (!result.ok) {
            setValue(previous);
            onError(result.error);
          }
        });
      }}
    >
      <option value="">Ne radi</option>
      {otherLocation && (
        <option value="__other__">
          {otherLocation.name}: {otherLocation.templateName}
        </option>
      )}
      {templates.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name} ({t.startsAt}–{t.endsAt})
        </option>
      ))}
    </select>
  );
}
