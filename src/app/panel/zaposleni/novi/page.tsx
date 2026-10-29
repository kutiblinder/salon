import Link from 'next/link';
import { redirect } from 'next/navigation';
import { panelQuery, requirePanel } from '@/lib/panel/context';
import { loadOrgServices } from '@/lib/panel/staff';
import { createStaffAction, updateStaffAction } from '../actions';
import { StaffForm } from '../staff-form';

export const metadata = { title: 'Novi zaposleni' };

export default async function NewStaffPage() {
  const ctx = await requirePanel();
  const locations = ctx.locationsFor('staff.manage');
  if (locations.length === 0) redirect('/panel');
  const services = await panelQuery(ctx, (client) => loadOrgServices(client, ctx.organizationId));

  return (
    <main>
      <p className="text-sm">
        <Link href="/panel/zaposleni" className="text-neutral-600 underline">
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
          afterCreatePath="/panel/zaposleni"
        />
      </div>
    </main>
  );
}
