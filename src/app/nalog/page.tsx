import Link from 'next/link';
import { getPool } from '@/lib/db';
import { requireSalonSession } from '@/lib/auth/guards';
import { SignOutButton } from '../_auth/auth-forms';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Moj nalog' };

export default async function AccountPage() {
  const session = await requireSalonSession();
  const memberships = await getPool().query('SELECT 1 FROM memberships WHERE user_id = $1 LIMIT 1', [session.user.id]);

  return (
    <main className="mx-auto max-w-md p-6">
      <p className="text-sm text-neutral-500">{session.realm.tenant.name}</p>
      <h1 className="mt-1 text-2xl font-semibold">Moj nalog</h1>

      <dl className="mt-6 space-y-3 rounded-lg border border-neutral-200 p-4">
        <div className="flex justify-between gap-4">
          <dt className="text-neutral-500">Ime</dt>
          <dd className="text-right font-medium">{session.user.name}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-neutral-500">Email</dt>
          <dd className="text-right font-medium">{session.user.email}</dd>
        </div>
        {session.user.phone && (
          <div className="flex justify-between gap-4">
            <dt className="text-neutral-500">Telefon</dt>
            <dd className="text-right font-medium">{session.user.phone}</dd>
          </div>
        )}
      </dl>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {(memberships.rowCount ?? 0) > 0 && (
          <Link href="/panel" className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white">
            Panel salona
          </Link>
        )}
        <SignOutButton redirectTo="/prijava" />
      </div>
    </main>
  );
}
