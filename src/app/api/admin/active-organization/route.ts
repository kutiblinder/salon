import { getPool } from '@/lib/db';
import { writeAudit } from '@/lib/audit';
import { isPlatformAdmin, loadActor } from '@/lib/auth/actor';
import { getCurrentSession } from '@/lib/auth/session';
import { isId } from '@/lib/ids';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/active-organization { organizationId | null }
 * Admin platforme eksplicitno ulazi u salon (ili izlazi sa null). Pamti se u sesiji.
 */
export async function POST(request: Request) {
  const session = await getCurrentSession(request.headers);
  if (!session || session.realm.kind !== 'platform') return Response.json({ error: 'unauthorized' }, { status: 401 });

  let organizationId: unknown;
  try {
    organizationId = ((await request.json()) as { organizationId?: unknown })?.organizationId;
  } catch {
    return Response.json({ error: 'invalid_body' }, { status: 400 });
  }
  if (organizationId !== null && (typeof organizationId !== 'string' || !isId(organizationId))) {
    return Response.json({ error: 'invalid_id' }, { status: 400 });
  }

  const client = await getPool().connect();
  try {
    if (!isPlatformAdmin(await loadActor(client, session))) {
      return Response.json({ error: 'forbidden' }, { status: 403 });
    }
    await client.query('BEGIN');
    if (organizationId !== null) {
      const org = await client.query('SELECT 1 FROM organizations WHERE id = $1', [organizationId]);
      if (!org.rowCount) {
        await client.query('ROLLBACK');
        return Response.json({ error: 'not_found' }, { status: 404 });
      }
    }
    await client.query(
      `UPDATE sessions SET active_organization_id = $1, updated_at = now()
        WHERE id = $2 AND organization_id IS NULL`,
      [organizationId, session.sessionId],
    );
    await writeAudit(client, {
      organizationId: (organizationId as string | null) ?? session.activeOrganizationId,
      userId: session.user.id,
      action: organizationId ? 'admin.enter_organization' : 'admin.leave_organization',
      objectType: 'organization',
      objectId: (organizationId as string | null) ?? session.activeOrganizationId,
    });
    await client.query('COMMIT');
    return Response.json({ ok: true, activeOrganizationId: organizationId });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
