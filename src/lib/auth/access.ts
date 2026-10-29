import type { PoolClient } from 'pg';

/** Neaktivan salon: nema sajta, prijave ni panela (npr. neplaćena usluga). */
export function isSalonUnavailable(status: string): boolean {
  return status === 'inactive';
}

/**
 * Zašto ovaj nalog ne sme da se prijavi. null = sme.
 * Vlasnik/menadžer sme i kad mu je staff profil neaktivan.
 */
export async function loginDeniedReason(
  client: PoolClient,
  input: { organizationId: string; userId?: string; email?: string },
): Promise<string | null> {
  const org = await client.query<{ status: string }>(`SELECT status FROM organizations WHERE id = $1`, [
    input.organizationId,
  ]);
  if (!org.rows[0] || org.rows[0].status === 'inactive') return 'Sajt nije dostupan.';

  if (!input.userId && !input.email) return null;

  const staff = await client.query<{ is_active: boolean; user_id: string }>(
    `SELECT s.is_active, s.user_id
       FROM staff s
       JOIN users u ON u.id = s.user_id AND u.organization_id = s.organization_id
      WHERE s.organization_id = $1
        AND (($2::bigint IS NOT NULL AND s.user_id = $2) OR ($3::citext IS NOT NULL AND u.email = $3))`,
    [input.organizationId, input.userId ?? null, input.email ?? null],
  );
  const row = staff.rows[0];
  if (!row || row.is_active) return null;

  const privileged = await client.query(
    `SELECT 1 FROM memberships
      WHERE user_id = $1 AND organization_id = $2 AND role IN ('owner', 'manager')`,
    [row.user_id, input.organizationId],
  );
  if (privileged.rows[0]) return null;
  return 'Ovaj nalog je deaktiviran.';
}
