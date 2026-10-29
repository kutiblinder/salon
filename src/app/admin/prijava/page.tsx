import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { resolveRealmByHost } from '@/lib/auth/realm';
import { getCurrentSession } from '@/lib/auth/session';
import { SignInForm } from '../../_auth/auth-forms';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin prijava', robots: { index: false, follow: false } };

export default async function AdminSignInPage() {
  const h = await headers();
  const realm = await resolveRealmByHost(h.get('host'));
  // Admin postoji samo na domenu platforme
  if (realm?.kind !== 'platform') redirect('/prijava');
  if (await getCurrentSession(h)) redirect('/admin');

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-semibold">Admin platforme</h1>
      <SignInForm redirectTo="/admin" />
    </main>
  );
}
