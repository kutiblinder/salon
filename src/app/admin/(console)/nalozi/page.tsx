import { adminQuery, requireAdminSalon } from '@/lib/admin/context';
import { listSalonAccounts } from '@/lib/admin/accounts';
import { ROLE_LABELS } from '@/lib/admin/accounts-types';
import { AccountForm } from './account-form';

export const metadata = { title: 'Nalozi salona' };

export default async function AdminAccountsPage() {
  const ctx = await requireAdminSalon();
  const accounts = await adminQuery(ctx, (client) => listSalonAccounts(client, ctx));

  return (
    <main>
      <h1 className="text-2xl font-semibold">Nalozi</h1>
      <p className="mt-1 text-neutral-600">
        Vlasnik, menadžer ili zaposleni ovog salona. Klijenti (bez uloge) nisu ovde.
      </p>

      <div className="mt-6">
        <AccountForm />
      </div>

      {accounts.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-600">Još nema naloga sa ulogom u ovom salonu.</p>
      ) : (
        <ul className="mt-6 divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
          {accounts.map((a) => (
            <li key={a.userId} className="flex flex-wrap items-baseline justify-between gap-2 p-3">
              <span>
                <span className="font-medium">{a.name}</span>{' '}
                <span className="text-sm text-neutral-500">{a.email}</span>
              </span>
              <span className="text-sm text-neutral-700">
                {a.roles.map((r) => ROLE_LABELS[r]).join(', ')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
