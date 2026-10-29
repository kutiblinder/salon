import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { withTenant } from '@/lib/db';
import { resolveTenantByHost } from '@/lib/tenant';
import { loadSiteGallery } from '@/lib/site/load';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Galerija' };

export default async function GalleryPage() {
  const tenant = await resolveTenantByHost((await headers()).get('host'));
  if (!tenant) notFound();
  const items = await withTenant(tenant.id, (client) => loadSiteGallery(client, tenant.id));

  return (
    <main>
      <h1 className="text-2xl font-semibold">Galerija</h1>
      {items.length === 0 ? (
        <p className="mt-4 text-neutral-600">Još nema slika.</p>
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item.mediaId}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/media/${item.mediaId}`}
                alt={item.altText ?? ''}
                className="w-full rounded-lg object-cover"
              />
              {item.caption && <p className="mt-2 text-sm text-neutral-600">{item.caption}</p>}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
