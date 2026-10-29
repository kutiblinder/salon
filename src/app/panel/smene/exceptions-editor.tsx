'use client';

import { startTransition, useActionState, useState } from 'react';
import { formatDayLabel } from '@/lib/panel/format';
import type { LocationStaff } from '@/lib/panel/appointments';
import type { ScheduleExceptionRow, ShiftTemplate } from '@/lib/panel/schedule-types';
import { removeException, saveException, type FormState } from './actions';

const inputClass = 'mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-base';

export function ExceptionsEditor({
  locationId,
  staff,
  templates,
  exceptions,
  today,
}: {
  locationId: string;
  staff: LocationStaff[];
  templates: ShiftTemplate[];
  exceptions: (ScheduleExceptionRow & { canDelete: boolean })[];
  today: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(saveException, null);
  const [kind, setKind] = useState<'off' | 'shift'>('off');
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4">
      <h2 className="font-medium">Izuzeci za konkretan dan</h2>
      <p className="mt-1 text-sm text-neutral-600">
        Ima prednost nad nedeljnim rasporedom. Slobodan dan važi u svim objektima.
      </p>

      {exceptions.length > 0 && (
        <ul className="mt-4 space-y-2">
          {exceptions.map((ex) => (
            <li key={`${ex.staffId}-${ex.date}`} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-neutral-200 px-3 py-2">
              <p className="text-sm">
                <span className="font-medium">{ex.staffName}</span>
                {' · '}
                {formatDayLabel(ex.date)}
                {' · '}
                {ex.templateId
                  ? `${ex.locationName ?? ''} ${ex.templateName} (${ex.startsAt}–${ex.endsAt})`
                  : 'Slobodan dan'}
              </p>
              {ex.canDelete && (
                <button
                  type="button"
                  className="min-h-10 rounded-md border border-neutral-300 px-3 text-sm"
                  onClick={() => {
                    setError(null);
                    startTransition(async () => {
                      const result = await removeException(ex.staffId, ex.date, locationId);
                      if (!result.ok) setError(result.error);
                    });
                  }}
                >
                  Vrati na nedeljni
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <form
        className="mt-4 grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          startTransition(() => formAction(new FormData(e.currentTarget)));
        }}
      >
        <input type="hidden" name="locationId" value={locationId} />
        <label className="block text-sm font-medium">
          Radnik
          <select name="staffId" className={inputClass} required>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium">
          Datum
          <input name="date" type="date" min={today} className={inputClass} required />
        </label>
        <label className="block text-sm font-medium">
          Vrsta
          <select
            name="kind"
            className={inputClass}
            value={kind}
            onChange={(e) => setKind(e.target.value as 'off' | 'shift')}
          >
            <option value="off">Slobodan dan</option>
            <option value="shift">Smena (umesto nedeljne)</option>
          </select>
        </label>
        {kind === 'shift' && (
          <label className="block text-sm font-medium">
            Šablon
            <select name="templateId" className={inputClass} required>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.startsAt}–{t.endsAt})
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={pending || staff.length === 0}
            className="min-h-11 rounded-md bg-neutral-900 px-4 font-medium text-white disabled:opacity-50"
          >
            {pending ? 'Čuvanje…' : 'Sačuvaj izuzetak'}
          </button>
        </div>
      </form>
      {(error || (state && !state.ok)) && (
        <p className="mt-2 text-sm text-rose-700">{error ?? (state && !state.ok ? state.error : null)}</p>
      )}
      {state?.ok && <p className="mt-2 text-sm text-emerald-700">{state.data.message}</p>}
    </section>
  );
}
