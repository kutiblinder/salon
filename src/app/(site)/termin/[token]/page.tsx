import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { withTenant } from '@/lib/db';
import { resolveTenantByHost } from '@/lib/tenant';
import { getAppointmentByToken } from '@/lib/appointments/manage';
import { isWellFormedToken } from '@/lib/appointments/token';
import { formatLocalDateTime } from '@/lib/notify';
import { ManageActions } from './manage-actions';

export const dynamic = 'force-dynamic';

// Token je u adresi: ne indeksirati i ne slati ga drugim sajtovima kroz Referer
export const metadata: Metadata = {
  title: 'Vaš termin',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Čeka potvrdu',
  confirmed: 'Potvrđen',
  cancelled_by_client: 'Otkazan',
  cancelled_by_salon: 'Otkazao salon',
  completed: 'Završen',
  no_show: 'Niste došli',
};

export default async function AppointmentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const tenant = await resolveTenantByHost((await headers()).get('host'));
  const appointment =
    tenant && isWellFormedToken(token)
      ? await withTenant(tenant.id, (client) => getAppointmentByToken(client, tenant.id, token))
      : null;

  if (!tenant || !appointment) {
    return (
      <main className="mx-auto max-w-md p-6">
        <h1 className="text-2xl font-semibold">Termin nije pronađen</h1>
        <p className="mt-3 text-neutral-600">Link je neispravan ili je istekao.</p>
      </main>
    );
  }

  const expired = appointment.status === 'pending' && !appointment.canConfirm;

  return (
    <main className="mx-auto max-w-md p-6">
      <p className="text-sm text-neutral-500">{tenant.name}</p>
      <h1 className="mt-1 text-2xl font-semibold">Vaš termin</h1>

      <dl className="mt-6 space-y-3 rounded-lg border border-neutral-200 p-4">
        <Row label="Usluga" value={appointment.serviceName} />
        <Row label="Vreme" value={formatLocalDateTime(appointment.startsAt, appointment.timezone)} />
        <Row label="Radnik" value={appointment.staffName} />
        <Row
          label="Lokacija"
          value={[appointment.locationName, appointment.locationAddress].filter(Boolean).join(', ')}
        />
        <Row label="Cena" value={`${appointment.price} ${appointment.currency}`} />
        <Row label="Status" value={expired ? 'Istekao (nije potvrđen na vreme)' : STATUS_LABELS[appointment.status] ?? appointment.status} />
      </dl>

      <ManageActions token={token} canConfirm={appointment.canConfirm} canCancel={appointment.canCancel} />
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
