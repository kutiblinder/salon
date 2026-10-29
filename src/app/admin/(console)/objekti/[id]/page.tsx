import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { adminQuery, requireAdminSalon } from '@/lib/admin/context';
import { getLocation } from '@/lib/admin/locations';
import { isId } from '@/lib/ids';
import { LocationForm } from '../location-form';

export const metadata = { title: 'Objekat' };

export default async function EditLocationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isId(id)) notFound();
  const ctx = await requireAdminSalon();
  if (!ctx.can('locations.manage')) redirect('/admin');
  const location = await adminQuery(ctx, (client) => getLocation(client, ctx, id));
  if (!location) notFound();

  return (
    <main>
      <p className="text-sm">
        <Link href="/admin/objekti" className="text-neutral-600 underline">
          Objekti
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-semibold">{location.name}</h1>
      <div className="mt-6">
        <LocationForm location={location} />
      </div>
    </main>
  );
}
