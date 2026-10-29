'use client';

import { startTransition, useActionState, useState } from 'react';
import type { ShiftTemplate } from '@/lib/panel/schedule-types';
import { removeTemplate, saveTemplate, type FormState } from './actions';

const inputClass = 'mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-base';

export function TemplatesEditor({ locationId, templates }: { locationId: string; templates: ShiftTemplate[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(saveTemplate, null);
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4">
      <h2 className="font-medium">Šabloni smena</h2>
      <p className="mt-1 text-sm text-neutral-600">Npr. „Prva 08–15“. Raspored radnika bira šablon, ne upisuje sate ručno.</p>

      {templates.length > 0 && (
        <ul className="mt-4 space-y-3">
          {templates.map((t) => (
            <li key={t.id}>
              <TemplateRow template={t} locationId={locationId} onError={setError} />
            </li>
          ))}
        </ul>
      )}

      <form
        className="mt-4 grid gap-3 sm:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(() => formAction(new FormData(e.currentTarget)));
        }}
      >
        <input type="hidden" name="locationId" value={locationId} />
        <label className="block text-sm font-medium sm:col-span-2">
          Novi šablon
          <input name="name" className={inputClass} maxLength={80} required placeholder="Prva smena" />
        </label>
        <label className="block text-sm font-medium">
          Od
          <input name="startsAt" type="time" className={inputClass} required />
        </label>
        <label className="block text-sm font-medium">
          Do
          <input name="endsAt" type="time" className={inputClass} required />
        </label>
        <div className="sm:col-span-4">
          <button
            type="submit"
            disabled={pending}
            className="min-h-11 rounded-md bg-neutral-900 px-4 font-medium text-white disabled:opacity-50"
          >
            {pending ? 'Dodavanje…' : 'Dodaj šablon'}
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

function TemplateRow({
  template: t,
  locationId,
  onError,
}: {
  template: ShiftTemplate;
  locationId: string;
  onError: (msg: string | null) => void;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(saveTemplate, null);
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        onError(null);
        startTransition(() => formAction(new FormData(e.currentTarget)));
      }}
    >
      <input type="hidden" name="locationId" value={locationId} />
      <input type="hidden" name="templateId" value={t.id} />
      <label className="block text-sm">
        <span className="sr-only">Naziv</span>
        <input name="name" defaultValue={t.name} className={inputClass} maxLength={80} required />
      </label>
      <input name="startsAt" type="time" defaultValue={t.startsAt} className={inputClass} required />
      <input name="endsAt" type="time" defaultValue={t.endsAt} className={inputClass} required />
      <div className="flex gap-2">
        <button type="submit" disabled={pending || busy} className="min-h-10 rounded-md border border-neutral-300 px-3 text-sm">
          Sačuvaj
        </button>
        <button
          type="button"
          disabled={pending || busy}
          className="min-h-10 rounded-md border border-rose-300 px-3 text-sm text-rose-800"
          onClick={() => {
            if (!window.confirm(`Obrisati šablon „${t.name}”?`)) return;
            setBusy(true);
            onError(null);
            startTransition(async () => {
              const result = await removeTemplate(t.id);
              setBusy(false);
              if (!result.ok) onError(result.error);
            });
          }}
        >
          Obriši
        </button>
      </div>
      {state && !state.ok && <p className="text-sm text-rose-700 sm:col-span-4">{state.error}</p>}
    </form>
  );
}
