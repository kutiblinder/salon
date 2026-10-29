import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ConfirmDelete } from '@/app/_ui/confirm-delete';
import { LoginForm } from '@/app/panel/zaposleni/login-form';
import { StaffForm } from '@/app/panel/zaposleni/staff-form';
import { adminQuery, requireAdminSalon } from '@/lib/admin/context';
import { loadStaffLocations, staffAccess } from '@/lib/admin/staff';
import { isId } from '@/lib/ids';
import { getStaff, loadOrgServices } from '@/lib/panel/staff';
import { createLoginAction, createStaffAction, deleteStaffAction, updateStaffAction } from '../actions';

export const metadata = { title: 'Zaposleni' };

export default async function AdminStaffEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isId(id)) notFound();
  const ctx = await requireAdminSalon();
  if (!ctx.can('staff.manage')) redirect('/admin');

  const { staff, services, locations } = await adminQuery(ctx, async (client) => {
    const locations = await loadStaffLocations(client, ctx);
    if (locations.length === 0) return { locations, staff: null, services: [] };
    return {
      locations,
      staff: await getStaff(client, staffAccess(ctx, locations), id),
      services: await loadOrgServices(client, ctx.organizationId),
    };
  });
  if (locations.length === 0) redirect('/admin/objekti');
  if (!staff) notFound();

  return (
    <main>
      <p className="text-sm">
        <Link href="/admin/zaposleni" className="text-neutral-600 underline">
          Zaposleni
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-semibold">{staff.name}</h1>
      <div className="mt-6 space-y-6">
        <StaffForm
          locations={locations}
          services={services}
          staff={staff}
          createAction={createStaffAction}
          updateAction={updateStaffAction}
          afterCreatePath="/admin/zaposleni"
        />
        {staff.email ? (
          <section className="rounded-lg border border-neutral-200 bg-white p-4">
            <h2 className="font-medium">Nalog za prijavu</h2>
            <p className="mt-1 text-sm text-neutral-700">{staff.email}</p>
          </section>
        ) : (
          <LoginForm staffId={staff.id} action={createLoginAction} />
        )}
        <section className="rounded-lg border border-rose-200 bg-white p-4">
          <h2 className="font-medium">Brisanje</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Ne može se obrisati ako ima zakazane termine. Profil i nalog za prijavu se uklanjaju.
          </p>
          <div className="mt-3">
            <ConfirmDelete
              action={deleteStaffAction}
              label="Obriši zaposlenog"
              message={`Obrisati zaposlenog „${staff.name}“?`}
            >
              <input type="hidden" name="staffId" value={staff.id} />
            </ConfirmDelete>
          </div>
        </section>
      </div>
    </main>
  );
}
