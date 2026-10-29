import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireAdminSalon } from '@/lib/admin/context';
import { LocationForm } from '../location-form';

export const metadata = { title: 'Novi objekat' };

export default async function NewLocationPage() {
  const ctx = await requireAdminSalon();
  if (!ctx.can('locations.manage')) redirect('/admin');

  return (
    <main>
      <p className="text-sm">
        <Link href="/admin/objekti" className="text-neutral-600 underline">
          Objekti
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-semibold">Novi objekat</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Cene se kopiraju sa postojećeg objekta ako postoje. Zaposlene dodelite u Zaposleni, smene u panelu salona.
      </p>
      <div className="mt-6">
        <LocationForm />
      </div>
    </main>
  );
}
