import Link from 'next/link';
import { redirect } from 'next/navigation';
import { adminQuery, requireAdminSalon } from '@/lib/admin/context';
import { loadAdminLocations } from '@/lib/admin/prices';
import { ServiceForm } from '../service-form';

export const metadata = { title: 'Nova usluga' };

export default async function NewServicePage() {
  const ctx = await requireAdminSalon();
  if (!ctx.can('prices.edit') || !ctx.can('services.edit')) redirect('/admin');
  const locations = await adminQuery(ctx, (client) => loadAdminLocations(client, ctx.organizationId));

  return (
    <main>
      <p className="text-sm">
        <Link href="/admin/cene" className="text-neutral-600 underline">
          Cenovnik
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-semibold">Nova usluga</h1>
      <div className="mt-6">
        <ServiceForm locations={locations} />
      </div>
    </main>
  );
}
