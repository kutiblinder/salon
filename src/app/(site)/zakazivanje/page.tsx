import Link from 'next/link';
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
      {session?.realm.kind === 'salon' ? (
        <p className="mt-1 text-neutral-600">Ime i telefon su popunjeni sa vašeg naloga.</p>
      ) : (
        <p className="mt-1 text-neutral-600">
          {salon.guestConfirmEmail
            ? 'Možete zakazati i bez naloga. Na email stiže link: potvrdite u roku od sat vremena ili se termin oslobađa. '
            : 'Možete zakazati i bez naloga: ime, prezime i telefon. Email služi za obaveštenje i otkazivanje. '}
          <Link href="/prijava" className="underline">
            Prijava
          </Link>
          {' · '}
          <Link href="/registracija" className="underline">
            Registracija
          </Link>
        </p>
      )}
      {salon.status === 'inactive' ? (
        <p className="mt-4 text-neutral-600">Ovaj salon trenutno ne prima zakazivanja.</p>
      ) : salon.status !== 'published' ? (
        <p className="mt-4 text-neutral-600">Zakazivanje je dostupno kad salon objavi sajt.</p>
      ) : catalog.locations.length === 0 || catalog.offers.length === 0 ? (
        <p className="mt-4 text-neutral-600">Trenutno nema usluga za zakazivanje.</p>
      ) : (
        <div className="mt-6">
          <BookingForm
            catalog={catalog}
            initialLocationId={q.locationId}
            initialServiceId={q.serviceId}
            guestConfirmEmail={salon.guestConfirmEmail}
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
