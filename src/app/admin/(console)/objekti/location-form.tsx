'use client';

import { useRouter } from 'next/navigation';
import { startTransition, useActionState, useEffect } from 'react';
import { WEEKDAYS } from '@/lib/panel/schedule-types';
import type { AdminLocationDetail } from '@/lib/admin/locations-types';
import { ConfirmDelete } from '../confirm-delete';
import { createLocationAction, deleteLocationAction, updateLocationAction, type FormState } from './actions';

const inputClass = 'mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-base';

const DEFAULT_OPEN = new Set([0, 1, 2, 3, 4]);

export function LocationForm({ location }: { location?: AdminLocationDetail }) {
  const router = useRouter();
  const action = location ? updateLocationAction : createLocationAction;
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, null);

  useEffect(() => {
    if (!location && state?.ok && state.data.id) router.push(`/admin/objekti/${state.data.id}`);
  }, [location, state, router]);

  const hoursByDay = new Map((location?.hours ?? []).map((h) => [h.weekday, h]));

  return (
    <div className="space-y-8">
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(() => formAction(new FormData(e.currentTarget)));
      }}
    >
      {location && <input type="hidden" name="locationId" value={location.id} />}
      <section className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="font-medium">Objekat</h2>
        <label className="block text-sm font-medium">
          Naziv
          <input name="name" defaultValue={location?.name ?? ''} className={inputClass} maxLength={80} required />
        </label>
        <label className="block text-sm font-medium">
          Adresa
          <input name="address" defaultValue={location?.address ?? ''} className={inputClass} maxLength={120} />
        </label>
        <label className="block text-sm font-medium">
          Grad
          <input name="city" defaultValue={location?.city ?? ''} className={inputClass} maxLength={80} />
        </label>
        <label className="block text-sm font-medium">
          Telefon
          <input name="phone" defaultValue={location?.phone ?? ''} className={inputClass} maxLength={40} />
        </label>
        <label className="block text-sm font-medium">
          Email
          <input name="email" type="email" defaultValue={location?.email ?? ''} className={inputClass} />
        </label>
        <label className="block text-sm font-medium">
          Korak termina (min)
          <input
            name="slotStepMin"
            type="number"
            min={5}
            max={60}
            defaultValue={location?.slotStepMin ?? 15}
            className={inputClass}
          />
        </label>
        <label className="block text-sm font-medium">
          Redosled
          <input name="sortOrder" type="number" min={0} defaultValue={location?.sortOrder ?? 0} className={inputClass} />
        </label>
        {location && (
          <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
            <input type="checkbox" name="isActive" defaultChecked={location.isActive} className="size-4" />
            Aktivan (vidi se na kontaktu, cenovniku i zakazivanju)
          </label>
        )}
      </section>

      <section className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="font-medium">Radno vreme</h2>
        <p className="text-sm text-neutral-600">Prikazuje se na stranici Kontakt. Prazan dan = zatvoreno.</p>
        <ul className="space-y-2">
          {WEEKDAYS.map((d) => {
            const existing = hoursByDay.get(d.value);
            const open = location ? Boolean(existing) : DEFAULT_OPEN.has(d.value);
            return (
              <li key={d.value} className="grid grid-cols-[auto_1fr_1fr] items-center gap-2 sm:grid-cols-[8rem_1fr_1fr]">
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" name={`open_${d.value}`} defaultChecked={open} className="size-4" />
                  {d.short}
                </label>
                <input
                  name={`opens_${d.value}`}
                  type="time"
                  defaultValue={existing?.opens ?? '09:00'}
                  className={inputClass}
                />
                <input
                  name={`closes_${d.value}`}
                  type="time"
                  defaultValue={existing?.closes ?? '17:00'}
                  className={inputClass}
                />
              </li>
            );
          })}
        </ul>
      </section>

      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded-md bg-neutral-900 px-4 font-medium text-white disabled:opacity-50"
      >
        {pending ? 'Čuvanje…' : location ? 'Sačuvaj' : 'Dodaj objekat'}
      </button>
      {state && !state.ok && <p className="text-sm text-rose-700">{state.error}</p>}
      {state?.ok && <p className="text-sm text-green-800">{state.data.message}</p>}
    </form>
      {location && (
        <section className="rounded-lg border border-rose-200 bg-white p-4">
          <h2 className="font-medium">Brisanje</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Ne može se obrisati poslednji objekat ni objekat sa zakazanim terminima.
          </p>
          <div className="mt-3">
            <ConfirmDelete
              action={deleteLocationAction}
              label="Obriši objekat"
              message={`Obrisati objekat „${location.name}“? Prošli termini na njemu se brišu.`}
            >
              <input type="hidden" name="locationId" value={location.id} />
            </ConfirmDelete>
          </div>
        </section>
      )}
    </div>
  );
}
