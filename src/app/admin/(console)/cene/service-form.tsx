'use client';

import { useRouter } from 'next/navigation';
import { startTransition, useActionState, useEffect, useState } from 'react';
import type { AdminLocation, ServiceDetail } from '@/lib/admin/prices-types';
import { createServiceAction, updateServiceAction, type FormState } from './actions';

const inputClass = 'mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-base';

function displayPrice(value: string | undefined): string {
  if (!value) return '';
  const n = Number(value);
  return Number.isInteger(n) ? String(n) : value;
}

export function ServiceForm({
  locations,
  service,
}: {
  locations: AdminLocation[];
  service?: ServiceDetail;
}) {
  const router = useRouter();
  const action = service ? updateServiceAction : createServiceAction;
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, null);
  const [offered, setOffered] = useState<Set<string>>(
    () => new Set(service?.offers.map((o) => o.locationId) ?? (locations.length === 1 ? [locations[0].id] : [])),
  );

  useEffect(() => {
    if (!service && state?.ok && state.data.id) router.push(`/admin/cene/${state.data.id}`);
  }, [service, state, router]);

  const offerByLocation = new Map((service?.offers ?? []).map((o) => [o.locationId, o]));

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(() => formAction(new FormData(e.currentTarget)));
      }}
    >
      {service && <input type="hidden" name="serviceId" value={service.id} />}
      <section className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="font-medium">Usluga</h2>
        <label className="block text-sm font-medium">
          Naziv
          <input name="name" defaultValue={service?.name ?? ''} className={inputClass} maxLength={80} required />
        </label>
        <label className="block text-sm font-medium">
          Opis
          <textarea name="description" defaultValue={service?.description ?? ''} className={inputClass} rows={2} maxLength={500} />
        </label>
        <label className="block text-sm font-medium">
          Redosled
          <input name="sortOrder" type="number" min={0} defaultValue={service?.sortOrder ?? 0} className={inputClass} />
        </label>
        {service && (
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" name="isActive" defaultChecked={service.isActive} className="size-4" />
            Aktivna (vidi se na cenovniku i pri zakazivanju)
          </label>
        )}
      </section>

      <section className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="font-medium">Cena po objektu</h2>
        <p className="text-sm text-neutral-600">Trajanje je u minutama. Pauza je čišćenje posle usluge (može 0).</p>
        {locations.length === 0 ? (
          <p className="text-sm text-neutral-600">Nema aktivnih objekata.</p>
        ) : (
          <ul className="space-y-4">
            {locations.map((l) => {
              const checked = offered.has(l.id);
              const offer = offerByLocation.get(l.id);
              return (
                <li key={l.id} className="rounded-md border border-neutral-200 p-3">
                  <label className="flex min-h-10 items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      name="locationId"
                      value={l.id}
                      checked={checked}
                      onChange={(e) => {
                        setOffered((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(l.id);
                          else next.delete(l.id);
                          return next;
                        });
                      }}
                      className="size-4"
                    />
                    {l.name}
                  </label>
                  {checked && (
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <label className="block text-sm">
                        Cena (din)
                        <input
                          name={`price_${l.id}`}
                          inputMode="decimal"
                          defaultValue={displayPrice(offer?.price)}
                          className={inputClass}
                          required
                        />
                      </label>
                      <label className="block text-sm">
                        Trajanje
                        <input
                          name={`duration_${l.id}`}
                          type="number"
                          min={1}
                          defaultValue={offer?.durationMin ?? ''}
                          className={inputClass}
                          required
                        />
                      </label>
                      <label className="block text-sm">
                        Pauza
                        <input
                          name={`buffer_${l.id}`}
                          type="number"
                          min={0}
                          defaultValue={offer?.bufferMin ?? 0}
                          className={inputClass}
                        />
                      </label>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded-md bg-neutral-900 px-4 font-medium text-white disabled:opacity-50"
      >
        {pending ? 'Čuvanje…' : service ? 'Sačuvaj' : 'Dodaj uslugu'}
      </button>
      {state && !state.ok && <p className="text-sm text-rose-700">{state.error}</p>}
      {state?.ok && <p className="text-sm text-emerald-700">{state.data.message}</p>}
    </form>
  );
}
