import { withTenant } from '@/lib/db';
import { isId } from '@/lib/ids';
import { resolveTenantByHost } from '@/lib/tenant';
import { addDays } from '@/lib/availability/time';
import { getOpenDates } from '@/lib/availability/load';

export const dynamic = 'force-dynamic';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_SPAN_DAYS = 62;

/**
 * GET /api/availability/dates?locationId=&serviceId=&from=&to=[&staffId=]
 * Datumi sa bar jednim slobodnim slotom. Salon iz Host headera.
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
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';

  if (!isId(locationId) || !isId(serviceId) || (staffId !== null && !isId(staffId))) {
    return Response.json({ error: 'invalid_id' }, { status: 400 });
  }
  if (!DATE.test(from) || !DATE.test(to) || to < from) {
    return Response.json({ error: 'invalid_date' }, { status: 400 });
  }
  if (to > addDays(from, MAX_SPAN_DAYS)) {
    return Response.json({ error: 'range_too_long' }, { status: 400 });
  }

  const result = await withTenant(tenant.id, (client) =>
    getOpenDates(client, {
      organizationId: tenant.id,
      locationId,
      serviceId,
      staffId,
      from,
      to,
      nowMs: Date.now(),
    }),
  );
  if (!result) return Response.json({ error: 'not_found' }, { status: 404 });
  return Response.json(result);
}
