import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { withTenant } from '@/lib/db';
import { resolveTenantByHost } from '@/lib/tenant';
import { loadSiteContent, loadSiteLocations } from '@/lib/site/load';
import { WEEKDAYS } from '@/lib/panel/schedule-types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Kontakt' };

export default async function ContactPage() {
  const tenant = await resolveTenantByHost((await headers()).get('host'));
  if (!tenant) notFound();
  const { content, locations } = await withTenant(tenant.id, async (client) => ({
    content: await loadSiteContent(client, tenant.id),
    locations: await loadSiteLocations(client, tenant.id),
  }));
  const note = content['contact.note'];

  return (
    <main>
      <h1 className="text-2xl font-semibold">Kontakt</h1>
      {note && <p className="mt-4 whitespace-pre-line text-neutral-700">{note}</p>}
      {locations.length === 0 ? (
        <p className="mt-4 text-neutral-600">Nema unetih objekata.</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {locations.map((l) => (
            <li key={l.id} className="rounded-lg border border-neutral-200 p-4">
              <h2 className="font-medium">{l.name}</h2>
              {(l.address || l.city) && (
                <p className="mt-1 text-neutral-700">
                  {[l.address, l.city].filter(Boolean).join(', ')}
                </p>
              )}
              {l.phone && (
                <p className="mt-1">
                  <a href={`tel:${l.phone.replace(/\s/g, '')}`} className="underline">
                    {l.phone}
                  </a>
                </p>
              )}
              {l.email && (
                <p className="mt-1">
                  <a href={`mailto:${l.email}`} className="underline">
                    {l.email}
                  </a>
                </p>
              )}
              {l.hours.length > 0 && (
                <ul className="mt-3 text-sm text-neutral-600">
                  {WEEKDAYS.map((d) => {
                    const h = l.hours.find((x) => x.weekday === d.value);
                    return (
                      <li key={d.value} className="flex justify-between gap-4">
                        <span>{d.label}</span>
                        <span>{h ? `${h.opens}–${h.closes}` : 'zatvoreno'}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
