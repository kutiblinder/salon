import type { ClientBase } from 'pg';

/**
 * Nepotvrdjene gost-termine kojima je istekao rok prebacuje u otkazane (oslobadja slot,
 * jer exclusion constraint racuna i 'pending'). organizationId null = svi saloni (pozadinski posao).
 */
export async function expirePendingAppointments(
  client: ClientBase,
  organizationId: string | null,
): Promise<number> {
  const res = await client.query(
    `UPDATE appointments
        SET status = 'cancelled_by_client', cancelled_at = now()
      WHERE status = 'pending' AND pending_expires_at < now()
        AND ($1::uuid IS NULL OR organization_id = $1::uuid)`,
    [organizationId],
  );
  return res.rowCount ?? 0;
}
