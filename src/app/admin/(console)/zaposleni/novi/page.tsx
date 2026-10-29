import Link from 'next/link';
import { redirect } from 'next/navigation';
import { adminQuery, requireAdminSalon } from '@/lib/admin/context';
import { loadStaffLocations } from '@/lib/admin/staff';
import { loadOrgServices } from '@/lib/panel/staff';
import { StaffForm } from '@/app/panel/zaposleni/staff-form';
import { createStaffAction, updateStaffAction } from '../actions';

export const metadata = { title: 'Novi zaposleni' };

export default async function AdminNewStaffPage() {
  const ctx = await requireAdminSalon();
  if (!ctx.can('staff.manage')) redirect('/admin');
  const { locations, services } = await adminQuery(ctx, async (client) => ({
    locations: await loadStaffLocations(client, ctx),
    services: await loadOrgServices(client, ctx.organizationId),
  }));
  if (locations.length === 0) redirect('/admin/objekti');

  return (
    <main>
      <p className="text-sm">
        <Link href="/admin/zaposleni" className="text-neutral-600 underline">
          Zaposleni
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-semibold">Novi zaposleni</h1>
      <p className="mt-1 text-neutral-600">Nalog za prijavu dodajete posle, na stranici profila.</p>
      <div className="mt-6">
        <StaffForm
          locations={locations}
          services={services}
          createAction={createStaffAction}
          updateAction={updateStaffAction}
          afterCreatePath="/admin/zaposleni"
        />
      </div>
    </main>
  );
}
