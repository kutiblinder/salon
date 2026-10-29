export const PERMISSIONS = [
  'content.edit',
  'gallery.edit',
  'prices.edit',
  'services.edit',
  'locations.manage',
  'staff.manage',
  'schedule.manage',
  'appointments.manage',
  'clients.view',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export type Role = 'admin' | 'owner' | 'manager' | 'staff';
export type MembershipScope = 'platform' | 'organization' | 'location';

export interface Membership {
  role: Role;
  scope: MembershipScope;
  organizationId: string | null;
  locationId: string | null;
}

export interface Actor {
  userId: string;
  /** Prostor naloga: null = nalog platforme */
  organizationId: string | null;
  /** Samo nalog platforme: salon u koji je admin eksplicitno usao */
  activeOrganizationId: string | null;
  memberships: Membership[];
  /** Profili zaposlenog vezani za nalog (za dozvole "samo svoje") */
  staffIds: string[];
}

/** Objekat nad kojim se radi. locationId/staffId navedi kad postoje (lokacija, smena, termin). */
export interface Resource {
  organizationId: string;
  locationId?: string | null;
  staffId?: string | null;
}

/** role_permissions + organization_permission_overrides za salon iz Resource-a. */
export interface PermissionRules {
  defaults: { role: Role; permission: string; ownOnly: boolean }[];
  overrides: { role: Role; permission: string; granted: boolean }[];
}

/**
 * Centralna provera dozvola. Cista funkcija: pravila i clanstva ucitava actor.ts.
 *
 * - Admin platforme ima dozvole uloge 'admin', ali samo u salonu u koji je usao.
 * - Ostali: nalog mora biti iz istog salona; clanstvo na nivou lokacije vazi samo za tu lokaciju.
 * - Izuzetak po salonu (override) ima prednost nad podrazumevanom dozvolom uloge.
 * - "Samo svoje" (own_only): objekat mora pripadati profilu zaposlenog ovog naloga.
 */
export function can(actor: Actor, permission: Permission, resource: Resource, rules: PermissionRules): boolean {
  const defaultFor = (role: Role) => rules.defaults.find((d) => d.role === role && d.permission === permission);

  if (actor.organizationId === null) {
    const isAdmin = actor.memberships.some((m) => m.scope === 'platform' && m.role === 'admin');
    return isAdmin && actor.activeOrganizationId === resource.organizationId && defaultFor('admin') !== undefined;
  }

  if (actor.organizationId !== resource.organizationId) return false;

  return actor.memberships.some((m) => {
    if (m.scope === 'platform' || m.role === 'admin') return false;
    if (m.organizationId !== resource.organizationId) return false;
    if (m.scope === 'location' && (!resource.locationId || m.locationId !== resource.locationId)) return false;

    const fallback = defaultFor(m.role);
    const override = rules.overrides.find((o) => o.role === m.role && o.permission === permission);
    const granted = override ? override.granted : fallback !== undefined;
    if (!granted) return false;

    if (fallback?.ownOnly) {
      return resource.staffId != null && actor.staffIds.includes(resource.staffId);
    }
    return true;
  });
}
