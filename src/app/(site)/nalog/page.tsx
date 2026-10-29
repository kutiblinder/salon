import Link from 'next/link';
import { withTenant } from '@/lib/db';
import { requireSalonSession } from '@/lib/auth/guards';
import { SignOutButton } from '../../_auth/auth-forms';
import { listClientAppointments } from '@/lib/site/account';
import { formatLocalDateTime } from '@/lib/notify';
import { formatPrice, STATUS_LABELS } from '@/lib/panel/format';
import { cancelMyAppointment } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Moj nalog' };

export default async function AccountPage() {
  const session = await requireSalonSession();
  const orgId = session.realm.organizationId;
  const { memberships, appointments } = await withTenant(orgId, async (client) => {
    const m = await client.query('SELECT 1 FROM memberships WHERE user_id = $1 LIMIT 1', [session.user.id]);
    return {
      memberships: m.rowCount ?? 0,
      appointments: await listClientAppointments(client, orgId, session.user.id),
    };
  });

  return (
    <main>
      <h1 className="text-2xl font-semibold">Moj nalog</h1>
      <dl className="mt-6 space-y-3 rounded-lg border border-neutral-200 p-4">
        <div className="flex justify-between gap-4">
          <dt className="text-neutral-500">Ime</dt>
          <dd className="text-right font-medium">{session.user.name}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-neutral-500">Email</dt>
          <dd className="text-right font-medium">{session.user.email}</dd>
        </div>
        {session.user.phone && (
          <div className="flex justify-between gap-4">
            <dt className="text-neutral-500">Telefon</dt>
            <dd className="text-right font-medium">{session.user.phone}</dd>
          </div>
        )}
      </dl>

      <h2 className="mt-10 text-xl font-semibold">Termini</h2>
      {appointments.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-600">Još nemate zakazanih termina.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {appointments.map((a) => (
            <li key={a.id} className="rounded-lg border border-neutral-200 p-4">
              <p className="font-medium">{a.serviceName}</p>
              <p className="mt-1 text-sm text-neutral-600">
                {formatLocalDateTime(a.startsAt, a.timezone)} · {a.staffName} · {a.locationName}
              </p>
              <p className="mt-1 text-sm">
                {STATUS_LABELS[a.status as keyof typeof STATUS_LABELS] ?? a.status}
                {' · '}
                {formatPrice(a.price)}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={`/zakazivanje?locationId=${a.locationId}&serviceId=${a.serviceId}`}
                  className="inline-flex min-h-10 items-center rounded-md border border-neutral-300 px-3 text-sm"
                >
                  Zakaži isto
                </Link>
                {a.canCancel && (
                  <form action={cancelMyAppointment}>
                    <input type="hidden" name="id" value={a.id} />
                    <button type="submit" className="min-h-10 rounded-md border border-rose-300 px-3 text-sm text-rose-800">
                      Otkaži
                    </button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-3">
        {memberships > 0 && (
          <Link href="/panel" className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white">
            Panel salona
          </Link>
        )}
        <SignOutButton redirectTo="/prijava" />
      </div>
    </main>
  );
}
