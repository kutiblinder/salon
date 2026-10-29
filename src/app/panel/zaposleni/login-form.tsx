'use client';

import { startTransition, useActionState } from 'react';
const inputClass = 'mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-base';

type LoginFormState =
  | { ok: true; data: { kind: 'created'; email: string; password: string } | { kind: 'linked'; email: string } }
  | { ok: false; error: string }
  | null;
type LoginAction = (prev: LoginFormState, formData: FormData) => Promise<LoginFormState>;

export function LoginForm({ staffId, action }: { staffId: string; action: LoginAction }) {
  const [state, formAction, pending] = useActionState<LoginFormState, FormData>(action, null);

  if (state?.ok && state.data.kind === 'created') {
    return (
      <section className="rounded-lg border border-amber-300 bg-amber-50 p-4">
        <h2 className="font-medium">Nalog je napravljen</h2>
        <p className="mt-1 text-sm">
          Email: <span className="font-medium">{state.data.email}</span>
        </p>
        <p className="mt-2 text-sm">
          Lozinka (sačuvajte je, više se ne prikazuje):{' '}
          <code className="rounded bg-white px-1.5 py-0.5 font-mono text-sm">{state.data.password}</code>
        </p>
      </section>
    );
  }

  if (state?.ok && state.data.kind === 'linked') {
    return (
      <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
        <h2 className="font-medium">Nalog je povezan</h2>
        <p className="mt-1 text-sm">
          Postojeći nalog <span className="font-medium">{state.data.email}</span> sada može da se prijavi u panel.
          Lozinka nije menjana.
        </p>
      </section>
    );
  }

  return (
    <form
      className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(() => formAction(new FormData(e.currentTarget)));
      }}
    >
      <h2 className="font-medium">Nalog za prijavu</h2>
      <p className="text-sm text-neutral-600">
        Ako email već postoji u ovom salonu, vezaće se postojeći nalog (lozinka se ne menja). Inače se pravi novi.
        Ostavite lozinku praznu da je sistem napravi.
      </p>
      <input type="hidden" name="staffId" value={staffId} />
      <label className="block text-sm font-medium">
        Email
        <input name="email" type="email" className={inputClass} required autoComplete="off" />
      </label>
      <label className="block text-sm font-medium">
        Lozinka (opciono)
        <input name="password" type="password" className={inputClass} minLength={8} autoComplete="new-password" />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded-md bg-neutral-900 px-4 font-medium text-white disabled:opacity-50"
      >
        {pending ? 'Čuvanje…' : 'Napravi ili poveži nalog'}
      </button>
      {state && !state.ok && <p className="text-sm text-rose-700">{state.error}</p>}
    </form>
  );
}
