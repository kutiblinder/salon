import type { ClientBase } from 'pg';
import { getPool } from '../db';
import { can, type Actor, type Membership, type Permission, type PermissionRules, type Resource } from './permissions';
import { getCurrentSession, type CurrentSession } from './session';

/** Clanstva i profili zaposlenog za prijavljeni nalog. */
export async function loadActor(client: ClientBase, session: CurrentSession): Promise<Actor> {
  const memberships = await client.query<Membership>(
    `SELECT role, scope, organization_id AS "organizationId", location_id AS "locationId"
       FROM memberships WHERE user_id = $1`,
    [session.user.id],
  );
  const staff = await client.query<{ id: string }>(
    `SELECT id FROM staff WHERE user_id = $1 AND is_active`,
    [session.user.id],
  );
  return {
    userId: session.user.id,
    organizationId: session.user.organizationId,
    activeOrganizationId: session.user.organizationId === null ? session.activeOrganizationId : null,
    memberships: memberships.rows,
    staffIds: staff.rows.map((r) => r.id),
  };
}

export async function loadPermissionRules(client: ClientBase, organizationId: string): Promise<PermissionRules> {
  const defaults = await client.query<PermissionRules['defaults'][number]>(
    `SELECT role, permission, own_only AS "ownOnly" FROM role_permissions`,
  );
  const overrides = await client.query<PermissionRules['overrides'][number]>(
    `SELECT role, permission, granted FROM organization_permission_overrides WHERE organization_id = $1`,
    [organizationId],
  );
  return { defaults: defaults.rows, overrides: overrides.rows };
}

export type AuthorizeResult =
  | { ok: true; session: CurrentSession; actor: Actor }
  | { ok: false; status: 401 | 403 };

/**
 * Provera za route handlere: prijavljen korisnik + can(). Za objekte "samo svoje"
 * prosledi resource sa staffId/locationId konkretnog objekta (ucitanog iz baze, ne iz zahteva).
 */
export async function authorize(headers: Headers, permission: Permission, resource: Resource): Promise<AuthorizeResult> {
  const session = await getCurrentSession(headers);
  if (!session) return { ok: false, status: 401 };
  const client = await getPool().connect();
  try {
    const actor = await loadActor(client, session);
    const rules = await loadPermissionRules(client, resource.organizationId);
    return can(actor, permission, resource, rules) ? { ok: true, session, actor } : { ok: false, status: 403 };
  } finally {
    client.release();
  }
}

export function isPlatformAdmin(actor: Actor): boolean {
  return actor.organizationId === null && actor.memberships.some((m) => m.scope === 'platform' && m.role === 'admin');
}
