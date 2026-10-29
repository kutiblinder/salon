'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent, type ReactNode } from 'react';

const inputClass = 'mt-1 w-full rounded-lg border border-neutral-300 px-3 py-3 text-base';
const buttonClass = 'w-full rounded-lg bg-neutral-900 px-4 py-3 font-medium text-white disabled:opacity-50';

const ERRORS: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: 'Pogrešan email ili lozinka.',
  USER_ALREADY_EXISTS: 'Nalog sa ovim emailom već postoji. Prijavite se.',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'Nalog sa ovim emailom već postoji. Prijavite se.',
  PASSWORD_TOO_SHORT: 'Lozinka mora imati najmanje 8 znakova.',
  INVALID_EMAIL: 'Neispravna email adresa.',
  CONSENT_REQUIRED: 'Potrebna je saglasnost sa politikom privatnosti.',
  INVALID_PHONE: 'Neispravan broj telefona.',
};

async function postAuth(path: string, body: unknown): Promise<string | null> {
  try {
    const res = await fetch(`/api/auth/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) return null;
    const data = (await res.json().catch(() => ({}))) as { code?: string; message?: string };
    if (res.status === 429) return 'Previše pokušaja. Sačekajte malo pa pokušajte ponovo.';
    return ERRORS[data.code ?? ''] ?? data.message ?? 'Došlo je do greške. Pokušajte ponovo.';
  } catch {
    return 'Nema veze sa serverom. Pokušajte ponovo.';
  }
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm text-neutral-700">{label}</span>
      {children}
    </label>
  );
}

export function SignInForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    const err = await postAuth('sign-in/email', { email: form.get('email'), password: form.get('password') });
    setBusy(false);
    if (err) return setError(err);
    router.replace(redirectTo);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <Field label="Email">
        <input name="email" type="email" autoComplete="email" required className={inputClass} />
      </Field>
      <Field label="Lozinka">
        <input name="password" type="password" autoComplete="current-password" required className={inputClass} />
      </Field>
      {error && <p className="text-red-700">{error}</p>}
      <button type="submit" disabled={busy} className={buttonClass}>
        Prijavi se
      </button>
    </form>
  );
}

export function SignUpForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    const err = await postAuth('sign-up/email', {
      name: form.get('name'),
      email: form.get('email'),
      phone: form.get('phone'),
      password: form.get('password'),
      privacyConsent: form.get('privacyConsent') === 'on',
    });
    setBusy(false);
    if (err) return setError(err);
    router.replace(redirectTo);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <Field label="Ime i prezime">
        <input name="name" autoComplete="name" required maxLength={100} className={inputClass} />
      </Field>
      <Field label="Email">
        <input name="email" type="email" autoComplete="email" required className={inputClass} />
      </Field>
      <Field label="Telefon">
        <input name="phone" type="tel" autoComplete="tel" required className={inputClass} />
      </Field>
      <Field label="Lozinka (najmanje 8 znakova)">
        <input name="password" type="password" autoComplete="new-password" minLength={8} required className={inputClass} />
      </Field>
      <label className="flex items-start gap-3 text-sm">
        <input name="privacyConsent" type="checkbox" required className="mt-1 h-5 w-5" />
        <span>Saglasan/na sam da salon čuva moje ime, email i telefon radi zakazivanja termina.</span>
      </label>
      {error && <p className="text-red-700">{error}</p>}
      <button type="submit" disabled={busy} className={buttonClass}>
        Napravi nalog
      </button>
    </form>
  );
}

export function SignOutButton({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await postAuth('sign-out', {});
        router.replace(redirectTo);
        router.refresh();
      }}
      className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium"
    >
      Odjavi se
    </button>
  );
}

export function EnterOrganizationButton({ organizationId, label }: { organizationId: string | null; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch('/api/admin/active-organization', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organizationId }),
        });
        setBusy(false);
        router.refresh();
      }}
      className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium disabled:opacity-50"
    >
      {label}
    </button>
  );
}
