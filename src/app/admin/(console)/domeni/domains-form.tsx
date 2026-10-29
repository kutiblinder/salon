'use client';

import { startTransition, useActionState } from 'react';
import type { OrgDomain } from '@/lib/admin/domains';
import { addDomainAction, deleteDomainAction, verifyDomainAction, type FormState } from './actions';

const inputClass = 'mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-base';

export function DomainsManager({ items }: { items: OrgDomain[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(addDomainAction, null);

  return (
    <div className="space-y-6">
      <form
        className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(() => formAction(new FormData(e.currentTarget)));
        }}
      >
        <h2 className="font-medium">Novi domen</h2>
        <label className="block text-sm font-medium">
          Domen
          <input name="domain" className={inputClass} placeholder="frizer-ana.rs" required />
        </label>
        <p className="text-sm text-neutral-600">
          DNS A/AAAA (i www CNAME) na IP servera. Sertifikat izdaje Caddy kad je domen označen kao proveren.
        </p>
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded-md bg-neutral-900 px-4 font-medium text-white disabled:opacity-50"
        >
          {pending ? 'Dodavanje…' : 'Dodaj domen'}
        </button>
        {state && !state.ok && <p className="text-sm text-rose-700">{state.error}</p>}
        {state?.ok && <p className="text-sm text-green-800">{state.data.message}</p>}
      </form>

      {items.length === 0 ? (
        <p className="text-neutral-600">Nema custom domena. Salon je i dalje na poddomenu platforme.</p>
      ) : (
        <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
          {items.map((item) => (
            <li key={item.domain} className="flex flex-wrap items-center justify-between gap-3 p-3">
              <div>
                <p className="font-medium">{item.domain}</p>
                <p className="text-sm text-neutral-600">{item.verifiedAt ? 'Proveren' : 'Čeka DNS'}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <form action={verifyDomainAction}>
                  <input type="hidden" name="domain" value={item.domain} />
                  <input type="hidden" name="verified" value={item.verifiedAt ? '0' : '1'} />
                  <button type="submit" className="min-h-10 rounded-md border border-neutral-300 px-3 text-sm">
                    {item.verifiedAt ? 'Skini proveru' : 'Označi kao proveren'}
                  </button>
                </form>
                <form action={deleteDomainAction}>
                  <input type="hidden" name="domain" value={item.domain} />
                  <button type="submit" className="min-h-10 rounded-md border border-rose-300 px-3 text-sm text-rose-800">
                    Ukloni
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
