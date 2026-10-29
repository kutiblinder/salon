import { redirect } from 'next/navigation';
import { adminQuery, requireAdminSalon } from '@/lib/admin/context';
import { listDomains } from '@/lib/admin/domains';
import { DomainsManager } from './domains-form';

export const metadata = { title: 'Domeni' };

export default async function AdminDomainsPage() {
  const ctx = await requireAdminSalon();
  if (!ctx.can('content.edit')) redirect('/admin');
  const items = await adminQuery(ctx, (client) => listDomains(client, ctx));

  return (
    <main>
      <h1 className="text-2xl font-semibold">Domeni</h1>
      <p className="mt-1 text-neutral-600">
        Svaki salon otvara se na svom domenu (npr. localhost.rs, sajt2.rs). Poddomen{' '}
        <code className="rounded bg-neutral-100 px-1">{ctx.salon.slug}</code> i dalje radi. Lokalno:{' '}
        <code className="rounded bg-neutral-100 px-1">npm run hosts:dev</code>, zatim http://domen.rs:3000.
      </p>
      <div className="mt-6">
        <DomainsManager items={items} />
      </div>
    </main>
  );
}
