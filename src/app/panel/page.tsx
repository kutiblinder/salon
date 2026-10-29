import { redirect } from 'next/navigation';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { requirePanel } from '@/lib/panel/context';

export const metadata = { title: 'Panel salona' };

const ROLE_LABELS: Record<string, string> = { owner: 'Vlasnik', manager: 'Menadžer', staff: 'Zaposleni' };

/** Pregled: uloge i dozvole prijavljenog naloga. */
export default async function PanelPage() {
  const ctx = await requirePanel();
  if (ctx.locationsFor('appointments.manage').length > 0) redirect('/panel/termini');
  const { actor, locations } = ctx;

  const locationName = (id: string | null) => locations.find((l) => l.id === id)?.name ?? '';
  const granted = PERMISSIONS.filter((p) => ctx.locationsFor(p).length > 0);

  return (
    <main>
      <h1 className="text-2xl font-semibold">Panel salona</h1>
      <section className="mt-6 rounded-lg border border-neutral-200 bg-white p-4">
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
    </main>
  );
}
