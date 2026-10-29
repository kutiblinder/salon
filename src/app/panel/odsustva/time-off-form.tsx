'use client';

import { startTransition, useActionState, useState } from 'react';
import { formatTimeOffRange } from '@/lib/panel/format';
import { TIME_OFF_LABELS, type TimeOffKind, type TimeOffRow, type TimeOffStaff } from '@/lib/panel/time-off-types';
import { removeTimeOff, saveTimeOff, type FormState } from './actions';

const inputClass = 'mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-base';

export function TimeOffForm({
  staff,
  entries,
  timezone,
}: {
  staff: TimeOffStaff[];
  entries: TimeOffRow[];
  timezone: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(saveTimeOff, null);
  const [kind, setKind] = useState<TimeOffKind>('vacation');
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {entries.length > 0 && (
        <ul className="space-y-2">
          {entries.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-3"
            >
              <p className="text-sm">
                <span className="font-medium">{row.staffName}</span>
                {' · '}
                {TIME_OFF_LABELS[row.kind]}
                {' · '}
                {formatTimeOffRange(new Date(row.startsAt), new Date(row.endsAt), timezone)}
                {row.note ? ` · ${row.note}` : ''}
              </p>
              <button
                type="button"
                className="min-h-10 rounded-md border border-neutral-300 px-3 text-sm"
                onClick={() => {
                  if (!window.confirm('Obrisati ovo odsustvo?')) return;
                  setError(null);
                  startTransition(async () => {
                    const result = await removeTimeOff(row.id);
                    if (!result.ok) setError(result.error);
                  });
                }}
              >
                Obriši
              </button>
            </li>
          ))}
        </ul>
      )}

      <section className="rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="font-medium">Novo odsustvo</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Pauza je u jednom danu. Godišnji i bolovanje su celi dani (uključujući oba datuma) i važe u svim objektima.
        </p>
        <form
          className="mt-4 grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            startTransition(() => formAction(new FormData(e.currentTarget)));
          }}
        >
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
            Vrsta
            <select
              name="kind"
              className={inputClass}
              value={kind}
              onChange={(e) => setKind(e.target.value as TimeOffKind)}
            >
              <option value="vacation">{TIME_OFF_LABELS.vacation}</option>
              <option value="sick">{TIME_OFF_LABELS.sick}</option>
              <option value="break">{TIME_OFF_LABELS.break}</option>
              <option value="other">{TIME_OFF_LABELS.other}</option>
            </select>
          </label>
          {kind === 'break' ? (
            <>
              <label className="block text-sm font-medium">
                Datum
                <input name="date" type="date" className={inputClass} required />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium">
                  Od
                  <input name="startsAt" type="time" className={inputClass} required />
                </label>
                <label className="block text-sm font-medium">
                  Do
                  <input name="endsAt" type="time" className={inputClass} required />
                </label>
              </div>
            </>
          ) : (
            <>
              <label className="block text-sm font-medium">
                Od datuma
                <input name="fromDate" type="date" className={inputClass} required />
              </label>
              <label className="block text-sm font-medium">
                Do datuma (uključujući)
                <input name="toDate" type="date" className={inputClass} required />
              </label>
            </>
          )}
          <label className="block text-sm font-medium sm:col-span-2">
            Napomena (opciono)
            <input name="note" className={inputClass} maxLength={500} autoComplete="off" />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={pending || staff.length === 0}
              className="min-h-11 rounded-md bg-neutral-900 px-4 font-medium text-white disabled:opacity-50"
            >
              {pending ? 'Čuvanje…' : 'Sačuvaj odsustvo'}
            </button>
          </div>
        </form>
        {(error || (state && !state.ok)) && (
          <p className="mt-2 text-sm text-rose-700">{error ?? (state && !state.ok ? state.error : null)}</p>
        )}
        {state?.ok && <p className="mt-2 text-sm text-emerald-700">{state.data.message}</p>}
      </section>
    </div>
  );
}
