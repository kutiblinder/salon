'use client';

import { useState } from 'react';
import type { SiteOffer } from '@/lib/site/types';
import { formatPrice } from '@/lib/panel/format';

export function PriceTabs({
  locations,
  offers,
}: {
  locations: { id: string; name: string }[];
  offers: SiteOffer[];
}) {
  const [id, setId] = useState(locations[0]?.id ?? '');
  const rows = offers.filter((o) => o.locationId === id);
  return (
    <div>
      <div className="flex gap-1 overflow-x-auto pb-2">
        {locations.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => setId(l.id)}
            className={`min-h-10 whitespace-nowrap rounded-md px-3 text-sm font-medium ${
              l.id === id ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-800'
            }`}
          >
            {l.name}
          </button>
        ))}
      </div>
      <ul className="mt-2 divide-y divide-neutral-200 rounded-lg border border-neutral-200">
        {rows.map((o) => (
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
    </div>
  );
}
