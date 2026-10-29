import { getPool } from '@/lib/db';
import { requirePlatformAdmin } from '@/lib/auth/guards';
import { EnterOrganizationButton, SignOutButton } from '../_auth/auth-forms';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin', robots: { index: false, follow: false } };

/** Admin panel (korak 5). Za sada: izbor salona u koji admin ulazi. */
export default async function AdminPage() {
  const { session } = await requirePlatformAdmin();
  const orgs = (
    await getPool().query<{ id: string; name: string; slug: string; status: string }>(
      'SELECT id, name, slug, status FROM organizations ORDER BY name',
    )
  ).rows;
  const active = orgs.find((o) => o.id === session.activeOrganizationId);

  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Admin platforme</h1>
        <SignOutButton redirectTo="/admin/prijava" />
      </div>
      <p className="mt-2 text-neutral-600">{session.user.email}</p>

      <section className="mt-6 rounded-lg border border-neutral-200 p-4">
        <h2 className="font-medium">Trenutno radite u salonu</h2>
        {active ? (
          <div className="mt-2 flex items-center justify-between gap-4">
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
        <h2 className="font-medium">Saloni</h2>
        <ul className="mt-2 divide-y divide-neutral-200 rounded-lg border border-neutral-200">
          {orgs.map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-4 p-3">
              <span>
                {o.name} <span className="text-sm text-neutral-500">{o.slug} · {o.status}</span>
              </span>
              {o.id !== active?.id && <EnterOrganizationButton organizationId={o.id} label="Uđi" />}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
