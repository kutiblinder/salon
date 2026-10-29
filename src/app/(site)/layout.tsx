import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { getPool, withTenant } from '@/lib/db';
import { getCurrentSession } from '@/lib/auth/session';
import { textOnPrimary } from '@/lib/admin/theme';
import { resolveTenantByHost } from '@/lib/tenant';
import { loadSiteLocations, loadSiteSalon } from '@/lib/site/load';

export const dynamic = 'force-dynamic';

const NAV = [
  { href: '/', label: 'Početna' },
  { href: '/o-nama', label: 'O nama' },
  { href: '/cenovnik', label: 'Cenovnik' },
  { href: '/galerija', label: 'Galerija' },
  { href: '/kontakt', label: 'Kontakt' },
];

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await resolveTenantByHost((await headers()).get('host'));
  if (!tenant) return { title: 'Salon platforma' };
  const loc = await getPool().query<{ city: string | null }>(
    `SELECT city FROM locations WHERE organization_id = $1 AND is_active ORDER BY sort_order LIMIT 1`,
    [tenant.id],
  );
  const city = loc.rows[0]?.city;
  const description = city ? `Zakazivanje termina — ${tenant.name}, ${city}` : `Zakazivanje termina — ${tenant.name}`;
  return {
    title: { default: tenant.name, template: `%s · ${tenant.name}` },
    description,
  };
}

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const tenant = await resolveTenantByHost(h.get('host'));
  if (!tenant) return children;

  const session = await getCurrentSession(h);
  const { salon, locations } = await withTenant(tenant.id, async (client) => ({
    salon: await loadSiteSalon(client, tenant.id),
    locations: await loadSiteLocations(client, tenant.id),
  }));
  if (!salon) return children;

  const primary = salon.primaryColor ?? '#171717';
  const onPrimary = textOnPrimary(primary) === 'white' ? '#ffffff' : '#171717';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'HairSalon',
    name: salon.name,
    url: `${process.env.NODE_ENV === 'production' ? 'https' : 'http'}://${h.get('host')}`,
    address: locations[0]
      ? {
          '@type': 'PostalAddress',
          streetAddress: locations[0].address ?? undefined,
          addressLocality: locations[0].city ?? undefined,
          addressCountry: 'RS',
        }
      : undefined,
    telephone: locations[0]?.phone ?? undefined,
  };

  return (
    <div style={{ ['--salon-primary' as string]: primary, ['--salon-on-primary' as string]: onPrimary }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {salon.status === 'draft' && (
        <p className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-950">Ovaj sajt još nije objavljen.</p>
      )}
      <header className="border-b border-neutral-200">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="text-lg font-semibold">
            {salon.name}
          </Link>
          <div className="flex items-center gap-3 text-sm">
            {session ? (
              <Link href="/nalog" className="text-neutral-700 underline">
                Moj nalog
              </Link>
            ) : (
              <Link href="/prijava" className="text-neutral-700 underline">
                Prijava
              </Link>
            )}
            <Link
              href="/zakazivanje"
              className="inline-flex min-h-10 items-center rounded-md px-3 font-medium"
              style={{ background: primary, color: onPrimary }}
            >
              Zakaži
            </Link>
          </div>
        </div>
        <nav className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-4 pb-2">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-md px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <div className="mx-auto max-w-3xl px-4 py-6">{children}</div>
      <footer className="mx-auto max-w-3xl px-4 py-8 text-sm text-neutral-500">
        {salon.name}
        {locations[0]?.city ? ` · ${locations[0].city}` : ''}
        {' · '}
        <Link href="/privatnost" className="underline">
          Privatnost
        </Link>
      </footer>
    </div>
  );
}
