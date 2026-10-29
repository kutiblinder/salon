import { getCurrentSession } from '@/lib/auth/session';
import { getPool, withTenant } from '@/lib/db';
import { isUuid } from '@/lib/panel/schedule';
import { getObject } from '@/lib/storage';
import { resolveTenantByHost } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

/**
 * GET /api/media/:id — slika salona. Dozvoljeno sa domena tog salona
 * ili adminu platforme koji je usao u taj salon.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return new Response(null, { status: 404 });

  const row = await getPool().query<{ organization_id: string; storage_key: string; mime_type: string }>(
    `SELECT organization_id, storage_key, mime_type FROM media WHERE id = $1`,
    [id],
  );
  const media = row.rows[0];
  if (!media) return new Response(null, { status: 404 });

  const host = request.headers.get('host');
  const tenant = await resolveTenantByHost(host);
  const session = await getCurrentSession(request.headers);
  const fromSalon = tenant?.id === media.organization_id && tenant.status !== 'inactive';
  const fromAdmin =
    session?.realm.kind === 'platform' && session.activeOrganizationId === media.organization_id;
  if (!fromSalon && !fromAdmin) return new Response(null, { status: 404 });

  const body = await withTenant(media.organization_id, async () => getObject(media.storage_key));
  if (!body) return new Response(null, { status: 404 });

  return new Response(Uint8Array.from(body), {
    headers: {
      'Content-Type': media.mime_type,
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
