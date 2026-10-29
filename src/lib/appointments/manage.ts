import type { PoolClient } from 'pg';
import { hashManageToken } from './token';

export interface ManagedAppointment {
  id: string;
  status: string;
  startsAt: string;
  endsAt: string;
  pendingExpiresAt: string | null;
  timezone: string;
  serviceName: string;
  price: string;
  currency: string;
  staffName: string;
  locationName: string;
  locationAddress: string | null;
  guestName: string | null;
  canConfirm: boolean;
  canCancel: boolean;
}

interface ManagedRow {
  id: string;
  status: string;
  starts_at: Date;
  ends_at: Date;
  pending_expires_at: Date | null;
  timezone: string;
  service_name_snapshot: string;
  price_snapshot: string;
  currency: string;
  staff_name: string;
  location_name: string;
  location_address: string | null;
  guest_name: string | null;
  can_confirm: boolean;
  can_cancel: boolean;
}

const CAN_CONFIRM = `a.status = 'pending' AND a.pending_expires_at > now()`;
const CAN_CANCEL = `a.status IN ('pending', 'confirmed') AND a.starts_at > now()`;

/** Termin po tokenu iz linka (bez logovanja). Pozivati unutar withTenant(). */
export async function getAppointmentByToken(
  client: PoolClient,
  organizationId: string,
  token: string,
): Promise<ManagedAppointment | null> {
  const res = await client.query<ManagedRow>(
    `SELECT a.id, a.status, a.starts_at, a.ends_at, a.pending_expires_at, l.timezone,
            a.service_name_snapshot, a.price_snapshot::text AS price_snapshot,
            COALESCE(ls.currency, 'RSD') AS currency,
            st.display_name AS staff_name, l.name AS location_name, l.address AS location_address,
            a.guest_name,
            (${CAN_CONFIRM}) AS can_confirm, (${CAN_CANCEL}) AS can_cancel
       FROM appointments a
       JOIN locations l ON l.id = a.location_id
       JOIN staff st ON st.id = a.staff_id
       LEFT JOIN location_services ls ON ls.location_id = a.location_id AND ls.service_id = a.service_id
      WHERE a.manage_token_hash = $1 AND a.organization_id = $2`,
    [hashManageToken(token), organizationId],
  );
  const r = res.rows[0];
  if (!r) return null;
  return {
    id: r.id,
    status: r.status,
    startsAt: r.starts_at.toISOString(),
    endsAt: r.ends_at.toISOString(),
    pendingExpiresAt: r.pending_expires_at?.toISOString() ?? null,
    timezone: r.timezone,
    serviceName: r.service_name_snapshot,
    price: r.price_snapshot,
    currency: r.currency,
    staffName: r.staff_name,
    locationName: r.location_name,
    locationAddress: r.location_address,
    guestName: r.guest_name,
    canConfirm: r.can_confirm,
    canCancel: r.can_cancel,
  };
}

export type ManageResult = { ok: true } | { ok: false; error: 'not_found' | 'not_allowed' };

/** Gost potvrdjuje termin linkom iz emaila (samo dok 'pending' nije istekao). */
export async function confirmByToken(
  client: PoolClient,
  organizationId: string,
  token: string,
): Promise<ManageResult> {
  const res = await client.query(
    `UPDATE appointments a
        SET status = 'confirmed', confirmed_at = now(), pending_expires_at = NULL
      WHERE a.manage_token_hash = $1 AND a.organization_id = $2 AND ${CAN_CONFIRM}`,
    [hashManageToken(token), organizationId],
  );
  if (res.rowCount) return { ok: true };
  return (await exists(client, organizationId, token)) ? { ok: false, error: 'not_allowed' } : { ok: false, error: 'not_found' };
}

/** Gost otkazuje termin linkom (do pocetka termina). */
export async function cancelByToken(
  client: PoolClient,
  organizationId: string,
  token: string,
): Promise<ManageResult> {
  const res = await client.query(
    `UPDATE appointments a
        SET status = 'cancelled_by_client', cancelled_at = now(), pending_expires_at = NULL
      WHERE a.manage_token_hash = $1 AND a.organization_id = $2 AND ${CAN_CANCEL}`,
    [hashManageToken(token), organizationId],
  );
  if (res.rowCount) return { ok: true };
  return (await exists(client, organizationId, token)) ? { ok: false, error: 'not_allowed' } : { ok: false, error: 'not_found' };
}

async function exists(client: PoolClient, organizationId: string, token: string): Promise<boolean> {
  const res = await client.query(
    `SELECT 1 FROM appointments WHERE manage_token_hash = $1 AND organization_id = $2`,
    [hashManageToken(token), organizationId],
  );
  return (res.rowCount ?? 0) > 0;
}
