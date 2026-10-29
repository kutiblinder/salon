import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { withTenant } from '@/lib/db';
import { resolveTenantByHost } from '@/lib/tenant';
import { loadSiteContent, loadSiteStaff } from '@/lib/site/load';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'O nama' };

export default async function AboutPage() {
  const tenant = await resolveTenantByHost((await headers()).get('host'));
  if (!tenant) notFound();
  const { content, staff } = await withTenant(tenant.id, async (client) => ({
    content: await loadSiteContent(client, tenant.id),
    staff: await loadSiteStaff(client, tenant.id),
  }));
  const title = content['about.title'] || 'O nama';
  const body = content['about.body'];

  return (
    <main>
      <h1 className="text-2xl font-semibold">{title}</h1>
      {body ? (
        <p className="mt-4 whitespace-pre-line text-neutral-700">{body}</p>
      ) : (
        <p className="mt-4 text-neutral-600">Tekst o salonu još nije unešen.</p>
      )}
      {staff.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold">Tim</h2>
          <ul className="mt-4 space-y-4">
            {staff.map((s) => (
              <li key={s.id} className="rounded-lg border border-neutral-200 p-4">
                <p className="font-medium">{s.name}</p>
                {s.title && <p className="text-sm text-neutral-600">{s.title}</p>}
                {s.bio && <p className="mt-2 text-sm text-neutral-700">{s.bio}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
