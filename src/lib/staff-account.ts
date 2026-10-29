import type { PoolClient } from 'pg';

export async function dropUserSessions(client: PoolClient, userId: string): Promise<void> {
  await client.query(`DELETE FROM sessions WHERE user_id = $1`, [userId]);
}

export async function dropOrganizationSessions(client: PoolClient, organizationId: string): Promise<void> {
  await client.query(`DELETE FROM sessions WHERE organization_id = $1`, [organizationId]);
}

/**
 * Posle brisanja staff profila: skida ulogu staff. Ako nalog nije vlasnik/menadžer,
 * briše nalog (sesije i lozinka idu sa njim) da se više ne može prijaviti.
 */
export async function removeStaffLogin(
  client: PoolClient,
  organizationId: string,
  userId: string,
): Promise<void> {
  await client.query(
    `DELETE FROM memberships WHERE user_id = $1 AND organization_id = $2 AND role = 'staff'`,
    [userId, organizationId],
  );
  const keep = await client.query(
    `SELECT 1 FROM memberships
      WHERE user_id = $1 AND organization_id = $2 AND role IN ('owner', 'manager')`,
    [userId, organizationId],
  );
  if (keep.rows[0]) return;

  await client.query(`UPDATE appointments SET created_by_user_id = NULL WHERE created_by_user_id = $1`, [userId]);
  await dropUserSessions(client, userId);
  await client.query(`DELETE FROM users WHERE id = $1 AND organization_id = $2`, [userId, organizationId]);
}
