import { getPool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin/context';
import { SignOutButton } from '../../_auth/auth-forms';
import { AdminNav, type NavItem } from './admin-nav';

export const dynamic = 'force-dynamic';

export default async function AdminConsoleLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();
  const items: NavItem[] = [{ href: '/admin', label: 'Saloni' }];
  let salonName: string | null = null;
  if (session.activeOrganizationId) {
    items.push({ href: '/admin/sadrzaj', label: 'Sadržaj' });
    items.push({ href: '/admin/cene', label: 'Cene' });
    items.push({ href: '/admin/galerija', label: 'Galerija' });
    const org = await getPool().query<{ name: string }>(`SELECT name FROM organizations WHERE id = $1`, [
      session.activeOrganizationId,
    ]);
    salonName = org.rows[0]?.name ?? null;
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 pt-4">
          <div className="flex items-baseline justify-between gap-4">
            <p className="font-semibold">Admin{salonName ? ` · ${salonName}` : ''}</p>
            <div className="flex items-center gap-3">
              <span className="text-sm text-neutral-600">{session.user.email}</span>
              <SignOutButton redirectTo="/admin/prijava" />
            </div>
          </div>
          <div className="mt-3">
            <AdminNav items={items} />
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-4xl px-4 py-6">{children}</div>
    </div>
  );
}
