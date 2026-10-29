import Link from 'next/link';
import { redirect } from 'next/navigation';
import { adminQuery, requireAdminSalon } from '@/lib/admin/context';
import { listAdminStaff } from '@/lib/admin/staff';
import { ConfirmDelete } from '../confirm-delete';
import { deleteStaffAction } from './actions';
import { StaffActiveForm } from './staff-active-form';

export const metadata = { title: 'Zaposleni' };

export default async function AdminStaffPage() {
  const ctx = await requireAdminSalon();
  if (!ctx.can('staff.manage')) redirect('/admin');
  const staff = await adminQuery(ctx, (client) => listAdminStaff(client, ctx));

  return (
    <main>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Zaposleni</h1>
          <p className="mt-1 text-neutral-600">
            Uredi: ime, objekti, usluge i nalog. Deaktivacija: podaci ostaju, nema prijave. Brisanje skida i nalog.
          </p>
        </div>
        <Link
          href="/admin/zaposleni/novi"
          className="inline-flex min-h-11 items-center rounded-md bg-neutral-900 px-4 font-medium text-white"
        >
          Novi zaposleni
        </Link>
      </div>

      {staff.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-600">Nema zaposlenih u ovom salonu.</p>
      ) : (
        <ul className="mt-6 divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
          {staff.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {s.name}
                  {!s.isActive && <span className="ml-2 text-sm font-normal text-neutral-500">neaktivan</span>}
                </p>
                <p className="text-sm text-neutral-600">
                  {s.title ? `${s.title} · ` : ''}
                  {s.locationNames.length > 0 ? s.locationNames.join(', ') : 'bez objekta'}
                  {s.email ? ` · ${s.email}` : ' · nema nalog'}
                </p>
              </div>
              <span className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/admin/zaposleni/${s.id}`}
                  className="inline-flex min-h-10 items-center rounded-md bg-neutral-900 px-3 text-sm font-medium text-white"
                >
                  Uredi
                </Link>
                <StaffActiveForm staffId={s.id} isActive={s.isActive} name={s.name} />
                <ConfirmDelete
                  action={deleteStaffAction}
                  label="Obriši"
                  message={`Obrisati zaposlenog „${s.name}“? Profil i nalog za prijavu se uklanjaju.`}
                >
                  <input type="hidden" name="staffId" value={s.id} />
                </ConfirmDelete>
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
