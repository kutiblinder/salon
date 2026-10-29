import { redirect } from 'next/navigation';
import { adminQuery, requireAdminSalon } from '@/lib/admin/context';
import { loadContent } from '@/lib/admin/content';
import { ContentForm } from './content-form';

export const metadata = { title: 'Sadržaj salona' };

export default async function AdminContentPage() {
  const ctx = await requireAdminSalon();
  if (!ctx.can('content.edit')) redirect('/admin');
  const bundle = await adminQuery(ctx, (client) => loadContent(client, ctx));

  return (
    <main>
      <h1 className="text-2xl font-semibold">Sadržaj</h1>
      <p className="mt-1 text-neutral-600">Tekstovi i izgled sajta. Cenovnik i galerija su posebne stavke.</p>
      <div className="mt-6">
        <ContentForm salon={bundle.salon} values={bundle.values} />
      </div>
    </main>
  );
}
