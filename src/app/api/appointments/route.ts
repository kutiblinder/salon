import { withTenant } from '@/lib/db';
import { resolveTenantByHost } from '@/lib/tenant';
import { getCurrentSession } from '@/lib/auth/session';
import { PENDING_TTL_MIN, createClientAppointment, createGuestAppointment } from '@/lib/appointments/create';
import { parseClientBooking, parseGuestBooking } from '@/lib/appointments/validate';
import { sendGuestBookingEmail } from '@/lib/notify';
import { clientKey, rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const MESSAGES = {
  slot_taken: 'Termin je upravo zauzet. Izaberite drugi termin.',
  slot_unavailable: 'Ovaj termin više nije dostupan. Izaberite drugi termin.',
};

/**
 * POST /api/appointments: gost ili ulogovani klijent. Salon iz Host headera.
 */
export async function POST(request: Request) {
  if (!rateLimit(`book:${clientKey(request)}`, 10, 60 * 60 * 1000)) {
    return Response.json({ error: 'rate_limited', message: 'Previše zahteva. Sačekajte pa pokušajte ponovo.' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid_body' }, { status: 400 });
  }

  const host = request.headers.get('host');
  const tenant = await resolveTenantByHost(host);
  if (!tenant) return Response.json({ error: 'tenant_not_found' }, { status: 404 });
  if (tenant.status !== 'published') {
    return Response.json({ error: 'not_published', message: 'Zakazivanje nije dostupno.' }, { status: 403 });
  }

  const session = await getCurrentSession(request.headers);
  const asClient = session?.realm.kind === 'salon';

  const proto = request.headers.get('x-forwarded-proto') ?? new URL(request.url).protocol.replace(':', '');

  if (asClient && session) {
    const parsed = parseClientBooking(body, {
      name: session.user.name,
      phone: session.user.phone,
      email: session.user.email,
    });
    if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
    const result = await withTenant(tenant.id, (client) =>
      createClientAppointment(client, tenant.id, parsed.value, Date.now(), session.user.id),
    );
    if (!result.ok) {
      if (result.error === 'not_found') return Response.json({ error: 'not_found' }, { status: 404 });
      return Response.json({ error: result.error, message: MESSAGES[result.error] }, { status: 409 });
    }
    return Response.json({ appointment: result.appointment }, { status: 201 });
  }

  const parsed = parseGuestBooking(body);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });

  const result = await withTenant(tenant.id, (client) =>
    createGuestAppointment(client, tenant.id, parsed.value, Date.now()),
  );

  if (!result.ok) {
    if (result.error === 'not_found') return Response.json({ error: 'not_found' }, { status: 404 });
    return Response.json({ error: result.error, message: MESSAGES[result.error] }, { status: 409 });
  }

  const manageUrl = `${proto}://${host}/termin/${result.token}`;
  try {
    await sendGuestBookingEmail({
      to: parsed.value.guest.email,
      salonName: tenant.name,
      serviceName: result.appointment.service.name,
      staffName: result.appointment.staff.name,
      startsAt: result.appointment.startsAt,
      timezone: result.appointment.timezone,
      manageUrl,
      pendingTtlMin: PENDING_TTL_MIN,
    });
  } catch (error) {
    console.error('Booking email failed', error);
  }

  return Response.json(
    {
      appointment: result.appointment,
      ...(process.env.NODE_ENV !== 'production' ? { devManageUrl: manageUrl } : {}),
    },
    { status: 201 },
  );
}
