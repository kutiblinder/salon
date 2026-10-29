import type { PoolClient } from 'pg';
import { loadActor, loadPermissionRules } from '../auth/actor';
import { can, type Actor, type Permission, type PermissionRules, type Resource } from '../auth/permissions';
import type { CurrentSession } from '../auth/session';
import { UserFacingError } from '../user-error';

export interface PanelLocation {
  id: string;
  name: string;
  timezone: string;
}

export interface PanelContext {
  session: CurrentSession;
  organizationId: string;
  organizationName: string;
  actor: Actor;
  rules: PermissionRules;
  /** Aktivne lokacije salona */
  locations: PanelLocation[];
  can(permission: Permission, resource?: Omit<Resource, 'organizationId'>): boolean;
  /** Dozvola nad svim objektima lokacije (ne samo svojim) */
  canAll(permission: Permission, locationId: string): boolean;
  /** Lokacije na kojima nalog ima dozvolu bar za svoje objekte */
  locationsFor(permission: Permission): PanelLocation[];
  /** Baca PanelError ako dozvola ne postoji. Resource ucitaj iz baze, ne iz zahteva. */
  require(permission: Permission, resource?: Omit<Resource, 'organizationId'>): void;
}

/** Greska sa porukom za korisnika; prekida transakciju akcije. */
export class PanelError extends UserFacingError {}

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export type SalonSession = CurrentSession & { realm: { kind: 'salon' } };

export async function loadPanelContext(client: PoolClient, session: SalonSession): Promise<PanelContext> {
  const organizationId = session.realm.organizationId;
  const actor = await loadActor(client, session);
  const rules = await loadPermissionRules(client, organizationId);
  const locations = (
    await client.query<PanelLocation>(
      `SELECT id, name, timezone FROM locations
        WHERE organization_id = $1 AND is_active ORDER BY sort_order, name`,
      [organizationId],
    )
  ).rows;

  const check = (permission: Permission, resource: Omit<Resource, 'organizationId'> = {}) =>
    can(actor, permission, { organizationId, ...resource }, rules);

  return {
    session,
    organizationId,
    organizationName: session.realm.tenant.name,
    actor,
    rules,
    locations,
    can: check,
    canAll: (permission, locationId) => check(permission, { locationId, staffId: null }),
    locationsFor: (permission) =>
      locations.filter((l) =>
        [null, ...actor.staffIds].some((staffId) => check(permission, { locationId: l.id, staffId })),
      ),
    require(permission, resource = {}) {
      if (!check(permission, resource)) throw new PanelError('Nemate dozvolu za ovu radnju.');
    },
  };
}
