import Link from 'next/link';
import { redirect } from 'next/navigation';
import { panelQuery, requirePanel } from '@/lib/panel/context';
import { listStaff } from '@/lib/panel/staff';

export const metadata = { title: 'Zaposleni' };

export default async function StaffListPage() {
  const ctx = await requirePanel();
  if (ctx.locationsFor('staff.manage').length === 0) redirect('/panel');

  const staff = await panelQuery(ctx, (client) => listStaff(client, ctx));

  return (
    <main>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Zaposleni</h1>
          <p className="mt-1 text-neutral-600">Profil, objekti, usluge i nalog za prijavu.</p>
        </div>
        <Link
          href="/panel/zaposleni/novi"
          className="inline-flex min-h-11 items-center rounded-md bg-neutral-900 px-4 font-medium text-white"
        >
          Novi zaposleni
        </Link>
      </div>

      {staff.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-600">Još nema zaposlenih.</p>
      ) : (
        <ul className="mt-6 space-y-2">
          {staff.map((s) => (
            <li key={s.id}>
              <Link
                href={`/panel/zaposleni/${s.id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-3 hover:border-neutral-400"
              >
                <div>
                  <p className="font-medium">
                    {s.name}
                    {s.title ? <span className="font-normal text-neutral-600"> · {s.title}</span> : null}
                    {!s.isActive && <span className="ml-2 text-sm font-normal text-neutral-500">neaktivan</span>}
                  </p>
                  <p className="mt-0.5 text-sm text-neutral-600">
                    {s.locationNames.join(', ') || 'bez objekta'}
                    {s.email ? ` · ${s.email}` : ' · nema nalog'}
                  </p>
                </div>
                <span className="text-sm font-medium text-neutral-700 underline">Uredi</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
