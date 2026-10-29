'use client';

import { startTransition, useActionState, useMemo, useState } from 'react';
import { CONTENT_FIELDS, fieldId, type SalonSettings } from '@/lib/admin/content-types';
import { parseHexColor, textOnPrimary, whiteTextContrast } from '@/lib/admin/theme';
import { saveContentAction, type FormState } from './actions';

const inputClass = 'mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-base';

export function ContentForm({ salon, values }: { salon: SalonSettings; values: Record<string, string> }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(saveContentAction, null);
  const [color, setColor] = useState(salon.primaryColor ?? '#171717');
  const parsed = parseHexColor(color);
  const preview = useMemo(() => {
    if (!parsed) return null;
    return {
      text: textOnPrimary(parsed),
      weak: whiteTextContrast(parsed) < 4.5,
    };
  }, [parsed]);

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(() => formAction(new FormData(e.currentTarget)));
      }}
    >
      <section className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="font-medium">Salon</h2>
        <label className="block text-sm font-medium">
          Naziv
          <input name="name" defaultValue={salon.name} className={inputClass} maxLength={80} required />
        </label>
        <label className="block text-sm font-medium">
          Status sajta
          <select name="status" defaultValue={salon.status} className={inputClass}>
            <option value="draft">Nacrt (nije javan)</option>
            <option value="published">Objavljen</option>
            <option value="inactive">Neaktivan (sajt ugašen)</option>
          </select>
          <p className="mt-1 text-sm font-normal text-neutral-600">
            Nacrt: sajt se vidi, zakazivanje je ugašeno. Neaktivan: sajt je ugašen (nema prijave ni
            panela), dok ga ponovo ne objavite.
          </p>
        </label>
        <label className="block text-sm font-medium">
          Primarna boja
          <span className="mt-1 flex items-center gap-3">
            <input
              type="color"
              value={parsed ?? '#171717'}
              onChange={(e) => setColor(e.target.value)}
              className="h-11 w-14 cursor-pointer rounded border border-neutral-300 bg-white p-1"
              aria-label="Izbor boje"
            />
            <input
              name="primaryColor"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className={`${inputClass} mt-0 font-mono`}
              placeholder="#171717"
            />
          </span>
        </label>
        {parsed && preview && (
          <p
            className="rounded-md px-3 py-2 text-sm"
            style={{ backgroundColor: parsed, color: preview.text === 'white' ? '#fff' : '#111' }}
          >
            Primer dugmeta na ovoj boji
            {preview.weak ? ' · beli tekst ima slab kontrast, koristiće se crni' : ''}
          </p>
        )}
        <label className="block text-sm font-medium">
          Poddomen
          <input
            name="slug"
            defaultValue={salon.slug}
            className={`${inputClass} font-mono`}
            maxLength={50}
            required
            pattern="[a-z0-9]([a-z0-9-]*[a-z0-9])?"
            title="Mala slova, brojevi i crtica"
          />
          <span className="mt-1 block font-normal text-neutral-600">
            Adresa sajta: {salon.slug}.localhost (lokalno) ili slug.tvojsajt.rs. Custom domen je u meniju Domeni.
          </span>
        </label>
        <label className="flex items-start gap-3 text-sm font-medium">
          <input
            type="checkbox"
            name="guestConfirmEmail"
            value="1"
            defaultChecked={salon.guestConfirmEmail}
            className="mt-1 size-4"
          />
          <span>
            Gost mora da potvrdi termin linkom iz emaila
            <span className="mt-1 block font-normal text-neutral-600">
              Ako ne potvrdi u roku od sat vremena, termin se oslobađa. Isključeno: termin je odmah
              potvrđen, ostaje samo otkazivanje.
            </span>
          </span>
        </label>
      </section>

      <section className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="font-medium">Tekstovi sajta</h2>
        {CONTENT_FIELDS.map((field) => {
          const id = fieldId(field);
          return (
            <label key={id} className="block text-sm font-medium">
              {field.label}
              {field.hint ? <span className="block font-normal text-neutral-600">{field.hint}</span> : null}
              {field.type === 'textarea' ? (
                <textarea
                  name={id}
                  defaultValue={values[id] ?? ''}
                  className={inputClass}
                  rows={5}
                  maxLength={field.maxLength}
                />
              ) : (
                <input name={id} defaultValue={values[id] ?? ''} className={inputClass} maxLength={field.maxLength} />
              )}
            </label>
          );
        })}
      </section>

      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded-md bg-neutral-900 px-4 font-medium text-white disabled:opacity-50"
      >
        {pending ? 'Čuvanje…' : 'Sačuvaj'}
      </button>
      {state && !state.ok && <p className="text-sm text-rose-700">{state.error}</p>}
      {state?.ok && <p className="text-sm text-emerald-700">{state.data.message}</p>}
    </form>
  );
}
