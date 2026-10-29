import { randomBytes } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import type { PoolClient } from 'pg';
import { writeAudit } from '../audit';
import { parseEmail, parseStaffName } from '../panel/staff';
import {
  SALON_ROLES,
  type CreateAccountResult,
  type SalonAccount,
  type SalonRole,
} from './accounts-types';
import { AdminError, type AdminContext } from './core';

export type { CreateAccountResult, SalonAccount, SalonRole } from './accounts-types';
export {
  parseOptionalPassword,
  parseSalonRole,
  ROLE_LABELS,
  SALON_ROLES,
} from './accounts-types';
export { parseEmail, parseStaffName };

const UNIQUE_VIOLATION = '23505';

export async function listSalonAccounts(client: PoolClient, ctx: AdminContext): Promise<SalonAccount[]> {
  const res = await client.query<{
    user_id: string;
    name: string;
    email: string;
    roles: string[];
  }>(
    `SELECT u.id AS user_id, u.full_name AS name, u.email::text AS email,
            array_agg(m.role::text ORDER BY m.role) AS roles
       FROM users u
       JOIN memberships m ON m.user_id = u.id AND m.organization_id = u.organization_id
      WHERE u.organization_id = $1 AND m.scope IN ('organization', 'location')
      GROUP BY u.id, u.full_name, u.email
      ORDER BY u.full_name, u.email`,
    [ctx.organizationId],
  );
  return res.rows.map((r) => ({
    userId: r.user_id,
    name: r.name,
    email: r.email,
    roles: r.roles.filter((role): role is SalonRole => (SALON_ROLES as readonly string[]).includes(role)),
  }));
}

/**
 * Nalog u izabranom salonu: vlasnik, menadžer ili zaposleni.
 * Lozinka se vraca samo kad je nalog nov; nikad ne ide u audit log.
 * Uloga staff pravi i profil zaposlenog (da moze da prima termine).
 */
export async function createSalonAccount(
  client: PoolClient,
  ctx: AdminContext,
  input: { name: string; email: string; role: SalonRole; password: string | null },
): Promise<CreateAccountResult> {
  const existing = await client.query<{ id: string }>(
    `SELECT id FROM users WHERE email = $1 AND organization_id = $2`,
    [input.email, ctx.organizationId],
  );
  let userId = existing.rows[0]?.id ?? null;
  let generated: string | null = null;

  if (userId) {
    const sameRole = await client.query(
      `SELECT 1 FROM memberships
        WHERE user_id = $1 AND role = $2 AND scope = 'organization' AND organization_id = $3`,
      [userId, input.role, ctx.organizationId],
    );
    if ((sameRole.rowCount ?? 0) > 0) {
      throw new AdminError('Taj nalog već ima tu ulogu u ovom salonu.');
    }
  } else {
    generated = input.password ?? randomBytes(12).toString('base64url');
    try {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO users (organization_id, email, full_name, email_verified) VALUES ($1, $2, $3, true) RETURNING id`,
        [ctx.organizationId, input.email, input.name],
      );
      userId = inserted.rows[0].id;
      await client.query(
        `INSERT INTO accounts (account_id, provider_id, user_id, organization_id, password)
         VALUES ($1::text, 'credential', $1::bigint, $2, $3)`,
        [userId, ctx.organizationId, await hashPassword(generated)],
      );
    } catch (error) {
      if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
        throw new AdminError('Taj email već postoji u ovom salonu.');
      }
      throw error;
    }
  }

  await client.query(
    `INSERT INTO memberships (user_id, role, scope, organization_id)
     VALUES ($1, $2, 'organization', $3) ON CONFLICT DO NOTHING`,
    [userId, input.role, ctx.organizationId],
  );

  if (input.role === 'staff') {
    await ensureStaffProfile(client, ctx, { userId, name: input.name });
  }

  await writeAudit(client, {
    organizationId: ctx.organizationId,
    userId: ctx.actor.userId,
    action: 'user.create',
    objectType: 'user',
    objectId: userId,
    newValue: { email: input.email, role: input.role, linkedExisting: generated === null },
  });

  return generated
    ? { kind: 'created', email: input.email, password: generated, role: input.role }
    : { kind: 'linked', email: input.email, role: input.role };
}

async function ensureStaffProfile(
  client: PoolClient,
  ctx: AdminContext,
  input: { userId: string; name: string },
): Promise<void> {
  const linked = await client.query<{ id: string }>(`SELECT id FROM staff WHERE user_id = $1`, [input.userId]);
  if (linked.rows[0]) return;

  const locations = await client.query<{ id: string }>(
    `SELECT id FROM locations WHERE organization_id = $1 AND is_active ORDER BY sort_order, name, id`,
    [ctx.organizationId],
  );
  if (locations.rows.length === 0) {
    throw new AdminError('Salon nema objekat. Prvo dodajte lokaciju.');
  }

  const staff = await client.query<{ id: string }>(
    `INSERT INTO staff (organization_id, user_id, display_name) VALUES ($1, $2, $3) RETURNING id`,
    [ctx.organizationId, input.userId, input.name],
  );
  for (const location of locations.rows) {
    await client.query(`INSERT INTO staff_locations (staff_id, location_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [
      staff.rows[0].id,
      location.id,
    ]);
  }
}
