import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { withTenant } from '@/lib/db';
import { getCurrentSession } from '@/lib/auth/session';
import { resolveTenantByHost } from '@/lib/tenant';
import { loadBookingCatalog, loadSiteSalon } from '@/lib/site/load';
import { BookingForm } from './booking-form';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Zakazivanje' };

export default async function BookingPage({
  searchParams,
}: {
  searchParams: Promise<{ locationId?: string; serviceId?: string }>;
}) {
  const tenant = await resolveTenantByHost((await headers()).get('host'));
  if (!tenant) notFound();
  const session = await getCurrentSession(await headers());
  const q = await searchParams;
  const { salon, catalog } = await withTenant(tenant.id, async (client) => ({
    salon: await loadSiteSalon(client, tenant.id),
    catalog: await loadBookingCatalog(client, tenant.id),
  }));
  if (!salon) notFound();

  return (
    <main>
      <h1 className="text-2xl font-semibold">Zakazivanje</h1>
      {salon.status !== 'published' ? (
        <p className="mt-4 text-neutral-600">Zakazivanje je dostupno kad salon objavi sajt.</p>
      ) : catalog.locations.length === 0 || catalog.offers.length === 0 ? (
        <p className="mt-4 text-neutral-600">Trenutno nema usluga za zakazivanje.</p>
      ) : (
        <div className="mt-6">
          <BookingForm
            catalog={catalog}
            initialLocationId={q.locationId}
            initialServiceId={q.serviceId}
            client={
              session?.realm.kind === 'salon'
                ? { name: session.user.name, email: session.user.email, phone: session.user.phone }
                : null
            }
          />
        </div>
      )}
    </main>
  );
}
