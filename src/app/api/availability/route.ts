import { withTenant } from '@/lib/db';
import { isId } from '@/lib/ids';
import { resolveTenantByHost } from '@/lib/tenant';
import { getAvailability, isBookableDate } from '@/lib/availability/load';

export const dynamic = 'force-dynamic';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/availability?locationId=...&serviceId=...&date=YYYY-MM-DD[&staffId=...]
 * Salon se odredjuje iz Host headera, ne iz parametara.
 */
export async function GET(request: Request) {
  const tenant = await resolveTenantByHost(request.headers.get('host'));
  if (!tenant || tenant.status === 'inactive') {
    return Response.json({ error: 'tenant_not_found' }, { status: 404 });
  }
  if (tenant.status !== 'published') {
    return Response.json({ error: 'not_published' }, { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const locationId = params.get('locationId') ?? '';
  const serviceId = params.get('serviceId') ?? '';
  const staffId = params.get('staffId');
  const date = params.get('date') ?? '';

  if (!isId(locationId) || !isId(serviceId) || (staffId !== null && !isId(staffId))) {
    return Response.json({ error: 'invalid_id' }, { status: 400 });
  }
  if (!DATE.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    return Response.json({ error: 'invalid_date' }, { status: 400 });
  }

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
  if (!isBookableDate(date, nowMs, result.timezone)) {
    return Response.json({ ...result, slots: [] });
  }
  return Response.json(result);
}
