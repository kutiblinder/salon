import type { PoolClient } from 'pg';
import { isUuid } from '../panel/schedule';
import { cancelOwnAppointment } from '../appointments/manage';

export interface AccountAppointment {
  id: string;
  status: string;
  startsAt: string;
  timezone: string;
  serviceName: string;
  price: string;
  staffName: string;
  locationName: string;
  locationId: string;
  serviceId: string;
  canCancel: boolean;
}

export async function listClientAppointments(
  client: PoolClient,
  organizationId: string,
  userId: string,
): Promise<AccountAppointment[]> {
  const res = await client.query<{
    id: string;
    status: string;
    starts_at: Date;
    timezone: string;
    service_name: string;
    price: string;
    staff_name: string;
    location_name: string;
    location_id: string;
    service_id: string;
    can_cancel: boolean;
  }>(
    `SELECT a.id, a.status, a.starts_at, l.timezone, a.service_name_snapshot AS service_name,
            a.price_snapshot::text AS price, st.display_name AS staff_name, l.name AS location_name,
            a.location_id, a.service_id,
            (a.status IN ('pending', 'confirmed') AND a.starts_at > now()) AS can_cancel
       FROM appointments a
       JOIN locations l ON l.id = a.location_id
       JOIN staff st ON st.id = a.staff_id
      WHERE a.organization_id = $1 AND a.client_user_id = $2
      ORDER BY a.starts_at DESC
      LIMIT 50`,
    [organizationId, userId],
  );
  return res.rows.map((r) => ({
    id: r.id,
    status: r.status,
    startsAt: r.starts_at.toISOString(),
    timezone: r.timezone,
    serviceName: r.service_name,
    price: r.price,
    staffName: r.staff_name,
    locationName: r.location_name,
    locationId: r.location_id,
    serviceId: r.service_id,
    canCancel: r.can_cancel,
  }));
}

export async function cancelClientAppointment(
  client: PoolClient,
  organizationId: string,
  userId: string,
  appointmentId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isUuid(appointmentId)) return { ok: false, error: 'Neispravan zahtev.' };
  const result = await cancelOwnAppointment(client, organizationId, userId, appointmentId);
  if (result.ok) return { ok: true };
  if (result.error === 'not_found') return { ok: false, error: 'Termin nije pronađen.' };
  return { ok: false, error: 'Ovaj termin se više ne može otkazati.' };
}
