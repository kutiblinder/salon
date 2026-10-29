import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { panelQuery, requirePanel } from '@/lib/panel/context';
import { isUuid } from '@/lib/panel/schedule';
import { getStaff, loadOrgServices } from '@/lib/panel/staff';
import { ConfirmDelete } from '@/app/_ui/confirm-delete';
import { LoginForm } from '../login-form';
import { StaffForm } from '../staff-form';
import { createLoginAction, createStaffAction, deleteStaffAction, updateStaffAction } from '../actions';

export const metadata = { title: 'Zaposleni' };

export default async function StaffEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const ctx = await requirePanel();
  const locations = ctx.locationsFor('staff.manage');
  if (locations.length === 0) redirect('/panel');

  const { staff, services } = await panelQuery(ctx, async (client) => ({
    staff: await getStaff(client, ctx, id),
    services: await loadOrgServices(client, ctx.organizationId),
  }));
  if (!staff) notFound();

  return (
    <main>
      <p className="text-sm">
        <Link href="/panel/zaposleni" className="text-neutral-600 underline">
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
          afterCreatePath="/panel/zaposleni"
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
