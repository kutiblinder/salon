'use client';

import { useRouter } from 'next/navigation';
import { startTransition, useActionState, useEffect } from 'react';
import type { OrgService, StaffDetail } from '@/lib/panel/staff-types';

const inputClass = 'mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-base';

type StaffFormState = { ok: true; data: { message: string; id?: string } } | { ok: false; error: string } | null;
type StaffFormAction = (prev: StaffFormState, formData: FormData) => Promise<StaffFormState>;

export function StaffForm({
  locations,
  services,
  staff,
  createAction,
  updateAction,
  afterCreatePath,
}: {
  locations: { id: string; name: string }[];
  services: OrgService[];
  staff?: StaffDetail;
  createAction: StaffFormAction;
  updateAction: StaffFormAction;
  afterCreatePath: string;
}) {
  const router = useRouter();
  const action = staff ? updateAction : createAction;
  const [state, formAction, pending] = useActionState<StaffFormState, FormData>(action, null);
  const assignedLocations = new Set(staff?.locationIds ?? (locations.length === 1 ? locations.map((l) => l.id) : []));

  useEffect(() => {
    if (!staff && state?.ok && state.data.id) {
      router.push(`${afterCreatePath}/${state.data.id}`);
    }
  }, [staff, state, router, afterCreatePath]);
  const assignedServices = new Map((staff?.services ?? []).map((s) => [s.serviceId, s.durationOverrideMin]));

  return (
    <form
      className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(() => formAction(new FormData(e.currentTarget)));
      }}
    >
      {staff && <input type="hidden" name="staffId" value={staff.id} />}
      <label className="block text-sm font-medium">
        Ime
        <input name="name" defaultValue={staff?.name ?? ''} className={inputClass} maxLength={80} required />
      </label>
      <label className="block text-sm font-medium">
        Titula
        <input
          name="title"
          defaultValue={staff?.title ?? ''}
          className={inputClass}
          maxLength={80}
          placeholder="Barber, frizerka…"
        />
      </label>
      <label className="block text-sm font-medium">
        Opis
        <textarea name="bio" defaultValue={staff?.bio ?? ''} className={inputClass} rows={3} maxLength={500} />
      </label>
      <label className="block text-sm font-medium">
        Redosled
        <input name="sortOrder" type="number" min={0} defaultValue={staff?.sortOrder ?? 0} className={inputClass} />
      </label>
      {staff && (
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" name="isActive" defaultChecked={staff.isActive} className="size-4" />
          Aktivan (vidi se na sajtu, prima termine i može da se prijavi)
        </label>
      )}

      <fieldset>
        <legend className="text-sm font-medium">Objekti</legend>
        <ul className="mt-2 space-y-2">
          {locations.map((l) => (
            <li key={l.id}>
              <label className="flex min-h-10 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="locationId"
                  value={l.id}
                  defaultChecked={assignedLocations.has(l.id)}
                  className="size-4"
                />
                {l.name}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium">Usluge</legend>
        <p className="mt-1 text-sm text-neutral-600">
          Trajanje ostavite prazno da važi ono sa cenovnika lokacije.
        </p>
        {services.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-600">Još nema usluga u katalogu.</p>
        ) : (
          <ul className="mt-2 space-y-3">
            {services.map((s) => {
              const assigned = assignedServices.has(s.id);
              const override = assignedServices.get(s.id);
              return (
                <li key={s.id} className="grid gap-2 sm:grid-cols-[1fr_8rem] sm:items-center">
                  <label className="flex min-h-10 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="serviceId"
                      value={s.id}
                      defaultChecked={assigned}
                      className="size-4"
                    />
                    {s.name}
                  </label>
                  <input
                    name={`duration_${s.id}`}
                    type="number"
                    min={1}
                    placeholder="min"
                    defaultValue={override ?? ''}
                    className={inputClass}
                    aria-label={`Trajanje za ${s.name} (minuti)`}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </fieldset>

      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded-md bg-neutral-900 px-4 font-medium text-white disabled:opacity-50"
      >
        {pending ? 'Čuvanje…' : staff ? 'Sačuvaj' : 'Dodaj zaposlenog'}
      </button>
      {state && !state.ok && <p className="text-sm text-rose-700">{state.error}</p>}
      {state?.ok && <p className="text-sm text-emerald-700">{state.data.message}</p>}
    </form>
  );
}
