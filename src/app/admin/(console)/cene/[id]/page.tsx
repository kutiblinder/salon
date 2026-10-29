import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { adminQuery, requireAdminSalon } from '@/lib/admin/context';
import { getService, loadAdminLocations } from '@/lib/admin/prices';
import { isUuid } from '@/lib/panel/schedule';
import { ServiceForm } from '../service-form';

export const metadata = { title: 'Usluga' };

export default async function EditServicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const ctx = await requireAdminSalon();
  if (!ctx.can('prices.edit')) redirect('/admin');

  const { service, locations } = await adminQuery(ctx, async (client) => ({
    service: await getService(client, ctx, id),
    locations: await loadAdminLocations(client, ctx.organizationId),
  }));
  if (!service) notFound();

  return (
    <main>
      <p className="text-sm">
        <Link href="/admin/cene" className="text-neutral-600 underline">
          Cenovnik
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-semibold">{service.name}</h1>
      <div className="mt-6">
        <ServiceForm locations={locations} service={service} />
      </div>
    </main>
  );
}
