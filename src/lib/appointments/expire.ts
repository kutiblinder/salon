import type { ClientBase } from 'pg';

/**
 * Pending gost-termine kojima je istekao rok (60 min kad salon trazi potvrdu) prebacuje
 * u otkazane i oslobadja slot. organizationId null = svi saloni (pozadinski posao).
 */
export async function expirePendingAppointments(
  client: ClientBase,
  organizationId: string | null,
): Promise<number> {
  const res = await client.query(
    `UPDATE appointments
        SET status = 'cancelled_by_client', cancelled_at = now()
      WHERE status = 'pending' AND pending_expires_at < now()
        AND ($1::bigint IS NULL OR organization_id = $1::bigint)`,
    [organizationId],
  );
  return res.rowCount ?? 0;
}
