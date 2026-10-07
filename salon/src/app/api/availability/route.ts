import { withTenant } from '@/lib/db';
import { resolveTenantByHost } from '@/lib/tenant';
import { MAX_DAYS_AHEAD, getAvailability } from '@/lib/availability/load';
import { addDays, localDateOf } from '@/lib/availability/time';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/availability?locationId=...&serviceId=...&date=YYYY-MM-DD[&staffId=...]
 * Salon se odredjuje iz Host headera, ne iz parametara.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const locationId = params.get('locationId') ?? '';
  const serviceId = params.get('serviceId') ?? '';
  const staffId = params.get('staffId');
  const date = params.get('date') ?? '';

  if (!UUID.test(locationId) || !UUID.test(serviceId) || (staffId !== null && !UUID.test(staffId))) {
    return Response.json({ error: 'invalid_id' }, { status: 400 });
  }
  if (!DATE.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    return Response.json({ error: 'invalid_date' }, { status: 400 });
  }

  const tenant = await resolveTenantByHost(request.headers.get('host'));
  if (!tenant) return Response.json({ error: 'tenant_not_found' }, { status: 404 });

  const nowMs = Date.now();
  const result = await withTenant(tenant.id, async (client) => {
    const found = await getAvailability(client, {
      organizationId: tenant.id,
      locationId,
      serviceId,
      staffId,
      date,
      nowMs,
    });
    return found;
  });

  if (!result) return Response.json({ error: 'not_found' }, { status: 404 });

  // Datum u proslosti ili predaleko unapred: prazna lista (bez greske)
  const today = localDateOf(nowMs, result.timezone);
  if (date < today || date > addDays(today, MAX_DAYS_AHEAD)) {
    return Response.json({ ...result, slots: [] });
  }
  return Response.json(result);
}
