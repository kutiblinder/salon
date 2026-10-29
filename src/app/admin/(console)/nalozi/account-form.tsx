'use client';

import { startTransition, useActionState } from 'react';
import { ROLE_LABELS, type SalonRole } from '@/lib/admin/accounts-types';
import { createAccountAction, type AccountFormState } from './actions';

const inputClass = 'mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-base';
const ROLES = Object.entries(ROLE_LABELS) as [SalonRole, string][];

export function AccountForm() {
  const [state, formAction, pending] = useActionState<AccountFormState, FormData>(createAccountAction, null);

  return (
    <div className="space-y-4">
      {state?.ok && state.data.kind === 'created' && (
        <section className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <h2 className="font-medium">Nalog je napravljen</h2>
          <p className="mt-1 text-sm">
            {ROLE_LABELS[state.data.role]} · <span className="font-medium">{state.data.email}</span>
          </p>
          <p className="mt-2 text-sm">
            Lozinka (sačuvajte je, više se ne prikazuje):{' '}
            <code className="rounded bg-white px-1.5 py-0.5 font-mono text-sm">{state.data.password}</code>
          </p>
        </section>
      )}
      {state?.ok && state.data.kind === 'linked' && (
        <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <h2 className="font-medium">Uloga je dodata postojećem nalogu</h2>
          <p className="mt-1 text-sm">
            {ROLE_LABELS[state.data.role]} · <span className="font-medium">{state.data.email}</span>. Lozinka nije
            menjana.
          </p>
        </section>
      )}
    <form
      className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(() => formAction(new FormData(e.currentTarget)));
      }}
    >
      <h2 className="font-medium">Novi nalog</h2>
      <p className="text-sm text-neutral-600">
        Prijava je na sajtu tog salona (npr. ateljekosic.rs/prijava). Ako email već postoji u salonu, dodaće se uloga, a
        lozinka ostaje ista. Ostavite lozinku praznu da je sistem napravi.
      </p>
      <label className="block text-sm font-medium">
        Ime
        <input name="name" className={inputClass} maxLength={80} required autoComplete="off" />
      </label>
      <label className="block text-sm font-medium">
        Email
        <input name="email" type="email" className={inputClass} required autoComplete="off" />
      </label>
      <fieldset>
        <legend className="text-sm font-medium">Uloga</legend>
        <div className="mt-2 flex flex-col gap-2">
          {ROLES.map(([value, label]) => (
            <label key={value} className="flex min-h-11 items-center gap-2 text-sm">
              <input type="radio" name="role" value={value} defaultChecked={value === 'staff'} required />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block text-sm font-medium">
        Lozinka (opciono)
        <input name="password" type="password" className={inputClass} minLength={8} autoComplete="new-password" />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded-md bg-neutral-900 px-4 font-medium text-white disabled:opacity-50"
      >
        {pending ? 'Čuvanje…' : 'Dodaj nalog'}
      </button>
      {state && !state.ok && <p className="text-sm text-rose-700">{state.error}</p>}
    </form>
    </div>
  );
}
