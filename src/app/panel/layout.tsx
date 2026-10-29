import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { isSalonUnavailable } from '@/lib/auth/access';
import { requirePanel } from '@/lib/panel/context';
import { resolveTenantByHost } from '@/lib/tenant';
import { SalonUnavailable } from '@/lib/site/unavailable';
import { PanelNav, type NavItem } from './panel-nav';

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await resolveTenantByHost((await headers()).get('host'));
  if (tenant && isSalonUnavailable(tenant.status)) {
    return { title: { absolute: 'Sajt nije dostupan' }, robots: { index: false, follow: false } };
  }
  return { title: 'Panel salona' };
}

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const tenant = await resolveTenantByHost((await headers()).get('host'));
  if (tenant && isSalonUnavailable(tenant.status)) {
    return <SalonUnavailable />;
  }

  const ctx = await requirePanel();

  const items: NavItem[] = [];
  if (ctx.locationsFor('appointments.manage').length > 0) items.push({ href: '/panel/termini', label: 'Termini' });
  else items.push({ href: '/panel', label: 'Pregled' });
  if (ctx.locationsFor('schedule.manage').length > 0) {
    items.push({ href: '/panel/smene', label: 'Smene' });
    items.push({ href: '/panel/odsustva', label: 'Odsustva' });
  }
  if (ctx.locationsFor('staff.manage').length > 0) items.push({ href: '/panel/zaposleni', label: 'Zaposleni' });

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 pt-4">
          <div className="flex items-baseline justify-between gap-4">
            <p className="font-semibold">{ctx.organizationName}</p>
            <Link href="/nalog" className="text-sm text-neutral-600 underline">
              {ctx.session.user.name}
            </Link>
          </div>
          <div className="mt-3">
            <PanelNav items={items} />
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-4xl px-4 py-6">{children}</div>
    </div>
  );
}
