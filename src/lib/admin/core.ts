import type { PoolClient } from 'pg';
import { isPlatformAdmin, loadActor, loadPermissionRules } from '../auth/actor';
import type { CurrentSession } from '../auth/session';
import { can, type Actor, type Permission, type PermissionRules } from '../auth/permissions';
import type { SalonSettings } from './content-types';
import { UserFacingError } from '../user-error';
import { parseHexColor } from './theme';

export class AdminError extends UserFacingError {}

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export type PlatformSession = CurrentSession & { realm: { kind: 'platform' } };

export interface AdminContext {
  session: PlatformSession;
  organizationId: string;
  salon: SalonSettings;
  actor: Actor;
  rules: PermissionRules;
  can(permission: Permission): boolean;
  require(permission: Permission): void;
}

function themeColor(theme: unknown): string | null {
  if (!theme || typeof theme !== 'object' || Array.isArray(theme)) return null;
  return parseHexColor((theme as { primaryColor?: unknown }).primaryColor);
}

export async function loadAdminContext(client: PoolClient, session: PlatformSession): Promise<AdminContext | null> {
  const actor = await loadActor(client, session);
  if (!isPlatformAdmin(actor)) throw new AdminError('Nemate pristup admin panelu.');
  const organizationId = session.activeOrganizationId;
  if (!organizationId) return null;

  const res = await client.query<{
    id: string;
    name: string;
    slug: string;
    status: 'draft' | 'published' | 'inactive';
    theme: unknown;
    guest_confirm_email: boolean;
  }>(`SELECT id, name, slug, status, theme, guest_confirm_email FROM organizations WHERE id = $1`, [organizationId]);
  const row = res.rows[0];
  if (!row) return null;

  const rules = await loadPermissionRules(client, organizationId);
  const check = (permission: Permission) => can(actor, permission, { organizationId }, rules);

  return {
    session,
    organizationId,
    salon: {
      id: row.id,
      name: row.name,
      slug: row.slug,
      status: row.status,
      primaryColor: themeColor(row.theme),
      guestConfirmEmail: row.guest_confirm_email,
    },
    actor,
    rules,
    can: check,
    require(permission) {
      if (!check(permission)) throw new AdminError('Nemate dozvolu za ovu radnju.');
    },
  };
}
