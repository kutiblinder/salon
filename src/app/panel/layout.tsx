import Link from 'next/link';
import { requirePanel } from '@/lib/panel/context';
import { PanelNav, type NavItem } from './panel-nav';

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requirePanel();

  const items: NavItem[] = [{ href: '/panel', label: 'Pregled' }];
  if (ctx.locationsFor('appointments.manage').length > 0) items.push({ href: '/panel/termini', label: 'Termini' });
  if (ctx.locationsFor('schedule.manage').length > 0) {
    items.push({ href: '/panel/smene', label: 'Smene' });
    items.push({ href: '/panel/odsustva', label: 'Odsustva' });
  }

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
