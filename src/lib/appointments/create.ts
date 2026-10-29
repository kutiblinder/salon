import type { PoolClient } from 'pg';
import { getAvailability, isBookableDate } from '../availability/load';
import { pickStaff } from '../availability/slots';
import { addDays, localDateOf, zonedTimeToUtcMs } from '../availability/time';
import { expirePendingAppointments } from './expire';
import { newManageToken } from './token';
import type { GuestBookingInput } from './validate';

/** Koliko dugo gost ima da potvrdi termin pre nego sto se slot oslobodi. */
export const PENDING_TTL_MIN = 15;

export interface CreatedAppointment {
  id: string;
  status: 'pending';
  startsAt: string;
  endsAt: string;
  pendingExpiresAt: string;
  timezone: string;
  service: { id: string; name: string; price: string; currency: string; durationMin: number };
  staff: { id: string; name: string };
}

export type CreateGuestAppointmentResult =
  | { ok: true; appointment: CreatedAppointment; token: string }
  | { ok: false; error: 'not_found' | 'slot_unavailable' | 'slot_taken' };

const EXCLUSION_VIOLATION = '23P01';

/**
 * Zakazuje termin za gosta. Pozivati unutar withTenant() (transakcija).
 * Slot se proverava istim algoritmom kao GET /api/availability; konacnu zastitu od
 * duplog zakazivanja daje constraint no_double_booking u bazi.
 */
export async function createGuestAppointment(
  client: PoolClient,
  organizationId: string,
  input: GuestBookingInput,
  nowMs: number,
): Promise<CreateGuestAppointmentResult> {
  await expirePendingAppointments(client, organizationId);

  const locRes = await client.query<{ timezone: string }>(
    `SELECT timezone FROM locations WHERE id = $1 AND organization_id = $2 AND is_active`,
    [input.locationId, organizationId],
  );
  const timezone = locRes.rows[0]?.timezone;
  if (!timezone) return { ok: false, error: 'not_found' };

  const date = localDateOf(input.startMs, timezone);
  if (!isBookableDate(date, nowMs, timezone)) return { ok: false, error: 'slot_unavailable' };

  const availability = await getAvailability(client, {
    organizationId,
    locationId: input.locationId,
    serviceId: input.serviceId,
    staffId: input.staffId,
    date,
    nowMs,
  });
  if (!availability) return { ok: false, error: 'not_found' };

  const slot = availability.slots.find((s) => Date.parse(s.start) === input.startMs);
  if (!slot) return { ok: false, error: 'slot_unavailable' };

  // Broj termina tog dana po zaposlenom, za ravnomernu raspodelu kod "bilo koji radnik"
  const dayStart = new Date(zonedTimeToUtcMs(date, '00:00', timezone)).toISOString();
  const dayEnd = new Date(zonedTimeToUtcMs(addDays(date, 1), '00:00', timezone)).toISOString();
  const loadRes = await client.query<{ staff_id: string; n: number }>(
    `SELECT staff_id, count(*)::int AS n
       FROM appointments
      WHERE organization_id = $1 AND staff_id = ANY($2::uuid[])
        AND status IN ('pending', 'confirmed')
        AND starts_at >= $3::timestamptz AND starts_at < $4::timestamptz
      GROUP BY staff_id`,
    [organizationId, slot.staffIds, dayStart, dayEnd],
  );
  const load = new Map(loadRes.rows.map((r) => [r.staff_id, r.n]));

  const { service } = availability;
  const { token, hash } = newManageToken();
  let candidates = [...slot.staffIds];

  while (candidates.length > 0) {
    const staffId = pickStaff(candidates, load);
    const staff = availability.staff.find((s) => s.id === staffId);
    if (!staff) throw new Error(`Staff ${staffId} missing from availability result`);
    const endsAtMs = input.startMs + (staff.durationMin + service.bufferMin) * 60_000;

    await client.query('SAVEPOINT booking');
    try {
      const ins = await client.query<{ id: string; pending_expires_at: Date }>(
        `INSERT INTO appointments (
           organization_id, location_id, staff_id, service_id,
           guest_name, guest_phone, guest_email,
           starts_at, ends_at,
           service_name_snapshot, price_snapshot, duration_snapshot_min,
           status, pending_expires_at, client_note, manage_token_hash, privacy_consent_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
                 'pending', now() + make_interval(mins => $13), $14, $15, now())
         RETURNING id, pending_expires_at`,
        [
          organizationId, input.locationId, staffId, input.serviceId,
          input.guest.name, input.guest.phone, input.guest.email,
          new Date(input.startMs).toISOString(), new Date(endsAtMs).toISOString(),
          service.name, service.price, staff.durationMin,
          PENDING_TTL_MIN, input.note, hash,
        ],
      );
      await client.query('RELEASE SAVEPOINT booking');
      const row = ins.rows[0];
      return {
        ok: true,
        token,
        appointment: {
          id: row.id,
          status: 'pending',
          startsAt: new Date(input.startMs).toISOString(),
          endsAt: new Date(endsAtMs).toISOString(),
          pendingExpiresAt: row.pending_expires_at.toISOString(),
          timezone,
          service: {
            id: service.id,
            name: service.name,
            price: service.price,
            currency: service.currency,
            durationMin: staff.durationMin,
          },
          staff: { id: staff.id, name: staff.name },
        },
      };
    } catch (error) {
      if ((error as { code?: string }).code !== EXCLUSION_VIOLATION) throw error;
      // Neko je upravo zauzeo ovog radnika; kod "bilo koji radnik" probaj sledeceg
      await client.query('ROLLBACK TO SAVEPOINT booking');
      candidates = candidates.filter((id) => id !== staffId);
    }
  }
  return { ok: false, error: 'slot_taken' };
}
