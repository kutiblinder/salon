import { withTenant } from '../db';
import { resolveTenantByHost } from '../tenant';
import type { PoolClient } from 'pg';
import type { ManageResult } from './manage';
import { isWellFormedToken } from './token';

/** Zajednicki tok za POST /api/appointments/confirm i /cancel (telo: { token }). */
export async function handleTokenAction(
  request: Request,
  action: (client: PoolClient, organizationId: string, token: string) => Promise<ManageResult>,
): Promise<Response> {
  let token: unknown;
  try {
    token = ((await request.json()) as { token?: unknown })?.token;
  } catch {
    return Response.json({ error: 'invalid_body' }, { status: 400 });
  }
  if (typeof token !== 'string' || !isWellFormedToken(token)) {
    return Response.json({ error: 'not_found' }, { status: 404 });
  }

  const tenant = await resolveTenantByHost(request.headers.get('host'));
  if (!tenant) return Response.json({ error: 'tenant_not_found' }, { status: 404 });

  const result = await withTenant(tenant.id, (client) => action(client, tenant.id, token));
  if (result.ok) return Response.json({ ok: true });
  return Response.json({ error: result.error }, { status: result.error === 'not_found' ? 404 : 409 });
}
