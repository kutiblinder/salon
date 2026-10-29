import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { withTenant } from '@/lib/db';
import { resolveTenantByHost } from '@/lib/tenant';
import { loadSiteOffers } from '@/lib/site/load';
import { formatPrice } from '@/lib/panel/format';
import { PriceTabs } from './price-tabs';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Cenovnik' };

export default async function PricesPage() {
  const tenant = await resolveTenantByHost((await headers()).get('host'));
  if (!tenant) notFound();
  const offers = await withTenant(tenant.id, (client) => loadSiteOffers(client, tenant.id));
  const locations = [...new Map(offers.map((o) => [o.locationId, o.locationName])).entries()].map(([id, name]) => ({
    id,
    name,
  }));

  return (
    <main>
      <h1 className="text-2xl font-semibold">Cenovnik</h1>
      {offers.length === 0 ? (
        <p className="mt-4 text-neutral-600">Cenovnik još nije unešen.</p>
      ) : locations.length === 1 ? (
        <ul className="mt-6 divide-y divide-neutral-200 rounded-lg border border-neutral-200">
          {offers.map((o) => (
            <li key={o.serviceId} className="px-3 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-medium">{o.name}</p>
                <p className="shrink-0">{formatPrice(o.price, o.currency)}</p>
              </div>
              <p className="mt-0.5 text-sm text-neutral-600">{o.durationMin} min</p>
              {o.description && <p className="mt-1 text-sm text-neutral-600">{o.description}</p>}
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-6">
          <PriceTabs locations={locations} offers={offers} />
        </div>
      )}
    </main>
  );
}
