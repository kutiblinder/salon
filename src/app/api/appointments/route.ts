import { withTenant } from '@/lib/db';
import { resolveTenantByHost } from '@/lib/tenant';
import { PENDING_TTL_MIN, createGuestAppointment } from '@/lib/appointments/create';
import { parseGuestBooking } from '@/lib/appointments/validate';
import { sendGuestBookingEmail } from '@/lib/notify';

export const dynamic = 'force-dynamic';

const MESSAGES = {
  slot_taken: 'Termin je upravo zauzet. Izaberite drugi termin.',
  slot_unavailable: 'Ovaj termin više nije dostupan. Izaberite drugi termin.',
};

/**
 * POST /api/appointments: gost zakazuje termin (bez naloga).
 * Telo: { locationId, serviceId, staffId?, start (ISO iz /api/availability),
 *         guest: { name, phone, email }, note?, privacyConsent: true }
 * Salon se odredjuje iz Host headera.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid_body' }, { status: 400 });
  }
  const parsed = parseGuestBooking(body);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });

  const host = request.headers.get('host');
  const tenant = await resolveTenantByHost(host);
  if (!tenant) return Response.json({ error: 'tenant_not_found' }, { status: 404 });

  const result = await withTenant(tenant.id, (client) =>
    createGuestAppointment(client, tenant.id, parsed.value, Date.now()),
  );

  if (!result.ok) {
    if (result.error === 'not_found') return Response.json({ error: 'not_found' }, { status: 404 });
    return Response.json({ error: result.error, message: MESSAGES[result.error] }, { status: 409 });
  }

  const proto = request.headers.get('x-forwarded-proto') ?? new URL(request.url).protocol.replace(':', '');
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
    // Termin je vec upisan; bez emaila istice sam posle PENDING_TTL_MIN
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
