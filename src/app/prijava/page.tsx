import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { resolveRealmByHost } from '@/lib/auth/realm';
import { getCurrentSession } from '@/lib/auth/session';
import { SignInForm } from '../_auth/auth-forms';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Prijava' };

export default async function SignInPage() {
  const h = await headers();
  const realm = await resolveRealmByHost(h.get('host'));
  if (!realm) redirect('/');
  if (realm.kind === 'platform') redirect('/admin/prijava');
  if (await getCurrentSession(h)) redirect('/nalog');

  return (
    <main className="mx-auto max-w-md p-6">
      <p className="text-sm text-neutral-500">{realm.tenant.name}</p>
      <h1 className="mt-1 text-2xl font-semibold">Prijava</h1>
      <SignInForm redirectTo="/nalog" />
      <p className="mt-6 text-sm text-neutral-600">
        Nemate nalog?{' '}
        <Link href="/registracija" className="font-medium underline">
          Registrujte se
        </Link>
      </p>
    </main>
  );
}
