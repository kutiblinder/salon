import Link from 'next/link';
import { redirect } from 'next/navigation';
import { adminQuery, requireAdminSalon } from '@/lib/admin/context';
import { listLocations } from '@/lib/admin/locations';

export const metadata = { title: 'Objekti' };

export default async function AdminLocationsPage() {
  const ctx = await requireAdminSalon();
  if (!ctx.can('locations.manage')) redirect('/admin');
  const locations = await adminQuery(ctx, (client) => listLocations(client, ctx));

  return (
    <main>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Objekti</h1>
          <p className="mt-1 text-neutral-600">
            Adresa i radno vreme za kontakt. Ako ima više objekata, mušterija bira pri zakazivanju.
          </p>
        </div>
        <Link
          href="/admin/objekti/novi"
          className="inline-flex min-h-11 items-center rounded-md bg-neutral-900 px-4 font-medium text-white"
        >
          Novi objekat
        </Link>
      </div>

      {locations.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-600">Još nema objekata.</p>
      ) : (
        <ul className="mt-6 divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
          {locations.map((l) => (
            <li key={l.id}>
              <Link href={`/admin/objekti/${l.id}`} className="block px-3 py-3 hover:bg-neutral-50">
                <p className="font-medium">
                  {l.name}
                  {!l.isActive && <span className="ml-2 text-sm font-normal text-neutral-500">neaktivan</span>}
                </p>
                {(l.address || l.city) && (
                  <p className="mt-0.5 text-sm text-neutral-600">{[l.address, l.city].filter(Boolean).join(', ')}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
