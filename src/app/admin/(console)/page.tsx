import { getPool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin/context';
import { EnterOrganizationButton } from '../../_auth/auth-forms';

export const metadata = { title: 'Admin', robots: { index: false, follow: false } };

/** Izbor salona u koji admin ulazi. Salon se pamti u sesiji, ne u URL-u. */
export default async function AdminPage() {
  const session = await requireAdmin();
  const orgs = (
    await getPool().query<{ id: string; name: string; slug: string; status: string }>(
      'SELECT id, name, slug, status FROM organizations ORDER BY name',
    )
  ).rows;
  const active = orgs.find((o) => o.id === session.activeOrganizationId);

  return (
    <main>
      <h1 className="text-2xl font-semibold">Saloni</h1>
      <p className="mt-1 text-neutral-600">Uđite u salon da uredite sadržaj. Saloni vas ne vide kao korisnika.</p>

      <section className="mt-6 rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="font-medium">Trenutno radite u salonu</h2>
        {active ? (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
            <span>
              {active.name} <span className="text-neutral-500">({active.slug})</span>
            </span>
            <EnterOrganizationButton organizationId={null} label="Izađi iz salona" />
          </div>
        ) : (
          <p className="mt-2 text-neutral-600">Nijedan. Izaberite salon ispod.</p>
        )}
      </section>

      <section className="mt-6">
        <h2 className="font-medium">Svi saloni</h2>
        {orgs.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-600">Još nema salona.</p>
        ) : (
          <ul className="mt-2 divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
            {orgs.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-4 p-3">
                <span>
                  {o.name}{' '}
                  <span className="text-sm text-neutral-500">
                    {o.slug} · {o.status === 'published' ? 'objavljen' : 'nacrt'}
                  </span>
                </span>
                {o.id !== active?.id && <EnterOrganizationButton organizationId={o.id} label="Uđi" />}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
