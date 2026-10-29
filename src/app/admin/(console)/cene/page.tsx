import Link from 'next/link';
import { redirect } from 'next/navigation';
import { adminQuery, requireAdminSalon } from '@/lib/admin/context';
import { listServices } from '@/lib/admin/prices';
import { formatPrice } from '@/lib/panel/format';

export const metadata = { title: 'Cenovnik' };

export default async function AdminPricesPage() {
  const ctx = await requireAdminSalon();
  if (!ctx.can('prices.edit')) redirect('/admin');
  const services = await adminQuery(ctx, (client) => listServices(client, ctx));

  return (
    <main>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Cenovnik</h1>
          <p className="mt-1 text-neutral-600">Usluge i cene po objektu. Važe za nove termine; stari zadržavaju snimak.</p>
        </div>
        <Link
          href="/admin/cene/nova"
          className="inline-flex min-h-11 items-center rounded-md bg-neutral-900 px-4 font-medium text-white"
        >
          Nova usluga
        </Link>
      </div>

      {services.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-600">Još nema usluga.</p>
      ) : (
        <ul className="mt-6 space-y-2">
          {services.map((s) => (
            <li key={s.id}>
              <Link
                href={`/admin/cene/${s.id}`}
                className="block rounded-lg border border-neutral-200 bg-white px-3 py-3 hover:border-neutral-400"
              >
                <p className="font-medium">
                  {s.name}
                  {!s.isActive && <span className="ml-2 text-sm font-normal text-neutral-500">neaktivna</span>}
                </p>
                <p className="mt-0.5 text-sm text-neutral-600">
                  {s.locationCount === 0
                    ? 'nije na nijednom objektu'
                    : `${s.locationCount} ${s.locationCount === 1 ? 'objekat' : 'objekta'}`}
                  {s.minPrice ? ` · od ${formatPrice(s.minPrice)}` : ''}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
