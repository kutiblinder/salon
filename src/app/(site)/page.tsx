import Link from 'next/link';
import { headers } from 'next/headers';
import { withTenant } from '@/lib/db';
import { textOnPrimary } from '@/lib/admin/theme';
import { resolveTenantByHost } from '@/lib/tenant';
import { loadSiteContent, loadSiteOffers, loadSiteSalon } from '@/lib/site/load';
import { formatPrice } from '@/lib/panel/format';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const host = (await headers()).get('host');
  const tenant = await resolveTenantByHost(host);

  if (!tenant) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <h1 className="text-3xl font-semibold">Salon platforma</h1>
        <p className="mt-4 text-neutral-600">
          Nijedan salon nije izabran za ovaj domen. Za razvoj otvori <code>http://demo.localhost:3000</code> (posle{' '}
          <code>npm run db:seed</code>).
        </p>
        <p className="mt-4 text-sm text-neutral-600">
          <Link href="/admin" className="underline">
            Admin
          </Link>
          {' · '}
          <Link href="/privatnost" className="underline">
            Politika privatnosti
          </Link>
        </p>
      </main>
    );
  }

  const { salon, content, offers } = await withTenant(tenant.id, async (client) => ({
    salon: await loadSiteSalon(client, tenant.id),
    content: await loadSiteContent(client, tenant.id),
    offers: await loadSiteOffers(client, tenant.id),
  }));
  if (!salon) return null;

  const primary = salon.primaryColor ?? '#171717';
  const onPrimary = textOnPrimary(primary) === 'white' ? '#ffffff' : '#171717';
  const title = content['home.hero_title'] || salon.name;
  const subtitle = content['home.hero_subtitle'];
  const intro = content['home.intro'];
  const preview = offers.slice(0, 4);

  return (
    <main>
      <h1 className="text-3xl font-semibold">{title}</h1>
      {subtitle && <p className="mt-3 text-lg text-neutral-700">{subtitle}</p>}
      {intro && <p className="mt-4 whitespace-pre-line text-neutral-700">{intro}</p>}
      <p className="mt-6">
        <Link
          href="/zakazivanje"
          className="inline-flex min-h-12 items-center rounded-md px-5 text-base font-medium"
          style={{ background: primary, color: onPrimary }}
        >
          Zakaži termin
        </Link>
      </p>
      {preview.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold">Usluge</h2>
          <ul className="mt-3 divide-y divide-neutral-200 rounded-lg border border-neutral-200">
            {preview.map((o) => (
              <li key={`${o.locationId}-${o.serviceId}`} className="flex items-baseline justify-between gap-3 px-3 py-3">
                <span>{o.name}</span>
                <span className="shrink-0 text-sm text-neutral-600">{formatPrice(o.price, o.currency)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm">
            <Link href="/cenovnik" className="underline">
              Ceo cenovnik
            </Link>
          </p>
        </section>
      )}
    </main>
  );
}
