import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getPool } from '@/lib/db';
import { loadActor, loadPermissionRules } from '@/lib/auth/actor';
import { requireSalonSession } from '@/lib/auth/guards';
import { PERMISSIONS, can } from '@/lib/auth/permissions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Panel salona' };

const ROLE_LABELS: Record<string, string> = { owner: 'Vlasnik', manager: 'Menadžer', staff: 'Zaposleni' };

/** Panel vlasnika i zaposlenih (korak 4). Za sada: uloge i dozvole prijavljenog naloga. */
export default async function PanelPage() {
  const session = await requireSalonSession();
  const organizationId = session.realm.organizationId;

  const client = await getPool().connect();
  let actor, rules, locations;
  try {
    actor = await loadActor(client, session);
    rules = await loadPermissionRules(client, organizationId);
    locations = (
      await client.query<{ id: string; name: string }>(
        'SELECT id, name FROM locations WHERE organization_id = $1 ORDER BY sort_order, name',
        [organizationId],
      )
    ).rows;
  } finally {
    client.release();
  }
  if (actor.memberships.length === 0) redirect('/nalog');

  const locationName = (id: string | null) => locations.find((l) => l.id === id)?.name ?? '';
  // Dozvole po lokaciji (clanstvo moze biti vezano za jednu lokaciju)
  const granted = PERMISSIONS.filter((p) =>
    locations.some((l) => can(actor, p, { organizationId, locationId: l.id, staffId: actor.staffIds[0] ?? null }, rules)),
  );

  return (
    <main className="mx-auto max-w-2xl p-6">
      <p className="text-sm text-neutral-500">{session.realm.tenant.name}</p>
      <h1 className="mt-1 text-2xl font-semibold">Panel salona</h1>

      <section className="mt-6 rounded-lg border border-neutral-200 p-4">
        <h2 className="font-medium">Vaše uloge</h2>
        <ul className="mt-2 list-inside list-disc text-neutral-700">
          {actor.memberships.map((m, i) => (
            <li key={i}>
              {ROLE_LABELS[m.role] ?? m.role}
              {m.scope === 'location' ? ` (${locationName(m.locationId)})` : ' (svi objekti)'}
            </li>
          ))}
        </ul>
        <h2 className="mt-4 font-medium">Dozvole</h2>
        <p className="mt-1 text-sm text-neutral-600">{granted.join(', ') || 'nema'}</p>
      </section>

      <p className="mt-6 text-neutral-600">Kalendar, termini, zaposleni, smene i odsustva dolaze u sledećem koraku.</p>
      <Link href="/nalog" className="mt-4 inline-block text-sm underline">
        Moj nalog
      </Link>
    </main>
  );
}
