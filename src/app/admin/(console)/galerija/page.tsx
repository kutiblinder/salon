import { redirect } from 'next/navigation';
import { adminQuery, requireAdminSalon } from '@/lib/admin/context';
import { listGallery, loadAdminLocations } from '@/lib/admin/gallery';
import { GalleryManager } from './gallery-form';

export const metadata = { title: 'Galerija' };

export default async function AdminGalleryPage() {
  const ctx = await requireAdminSalon();
  if (!ctx.can('gallery.edit')) redirect('/admin');
  const { items, locations } = await adminQuery(ctx, async (client) => ({
    items: await listGallery(client, ctx),
    locations: await loadAdminLocations(client, ctx.organizationId),
  }));

  return (
    <main>
      <h1 className="text-2xl font-semibold">Galerija</h1>
      <p className="mt-1 text-neutral-600">Slike se kompresuju u WebP. Alt tekst ide na javni sajt (SEO i pristupačnost).</p>
      <div className="mt-6">
        <GalleryManager items={items} locations={locations} />
      </div>
    </main>
  );
}
