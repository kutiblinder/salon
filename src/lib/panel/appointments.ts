import type { PoolClient } from 'pg';
import { writeAudit } from '../audit';
import { addDays, zonedTimeToUtcMs } from '../availability/time';
import { createAppointment, type BookingInput } from '../appointments/create';
import { expirePendingAppointments } from '../appointments/expire';
import { canTransition, type AppointmentStatus, type PanelStatusAction } from '../appointments/status';
import { PanelError, type PanelContext, type PanelLocation } from './core';

export interface DayAppointment {
  id: string;
  staffId: string;
  startsAt: Date;
  endsAt: Date;
  status: AppointmentStatus;
  serviceName: string;
  durationMin: number;
  price: string;
  clientName: string;
  clientPhone: string | null;
  clientEmail: string | null;
  clientNote: string | null;
  /** Uneo ga je salon (telefonom/licno), a ne klijent sa sajta */
  enteredBySalon: boolean;
}

export interface LocationStaff {
  id: string;
  name: string;
}

export interface LocationService {
  id: string;
  name: string;
  durationMin: number;
  price: string;
  currency: string;
}

/** Zaposleni koji rade na lokaciji (aktivni). */
export async function loadLocationStaff(client: PoolClient, organizationId: string, locationId: string) {
  const res = await client.query<LocationStaff>(
    `SELECT s.id, s.display_name AS name
       FROM staff s JOIN staff_locations sl ON sl.staff_id = s.id
      WHERE s.organization_id = $1 AND sl.location_id = $2 AND s.is_active
      ORDER BY s.sort_order, s.display_name`,
    [organizationId, locationId],
  );
  return res.rows;
}

/** Aktivne usluge lokacije sa cenom i trajanjem. */
export async function loadLocationServices(client: PoolClient, organizationId: string, locationId: string) {
  const res = await client.query<LocationService>(
    `SELECT s.id, s.name, ls.duration_min AS "durationMin", ls.price::text AS price, ls.currency
       FROM services s JOIN location_services ls ON ls.service_id = s.id
      WHERE s.organization_id = $1 AND ls.location_id = $2 AND s.is_active AND ls.is_active
      ORDER BY s.sort_order, s.name`,
    [organizationId, locationId],
  );
  return res.rows;
}

/**
 * Termini lokacije za lokalni datum, samo oni koje nalog sme da vidi
 * (zaposleni sa "samo svoje" vidi samo svoje). Telefon i email samo uz clients.view.
 */
export async function loadDayAppointments(
  client: PoolClient,
  ctx: PanelContext,
  location: PanelLocation,
  date: string,
): Promise<DayAppointment[]> {
  await expirePendingAppointments(client, ctx.organizationId);
  const from = new Date(zonedTimeToUtcMs(date, '00:00', location.timezone)).toISOString();
  const to = new Date(zonedTimeToUtcMs(addDays(date, 1), '00:00', location.timezone)).toISOString();

  const res = await client.query<{
    id: string;
    staff_id: string;
    starts_at: Date;
    ends_at: Date;
    status: AppointmentStatus;
    service_name_snapshot: string;
    duration_snapshot_min: number;
    price: string;
    client_name: string;
    client_phone: string | null;
    client_email: string | null;
    client_note: string | null;
    created_by_user_id: string | null;
  }>(
    `SELECT a.id, a.staff_id, a.starts_at, a.ends_at, a.status, a.service_name_snapshot,
            a.duration_snapshot_min, a.price_snapshot::text AS price,
            coalesce(u.full_name, a.guest_name) AS client_name,
            coalesce(u.phone, a.guest_phone) AS client_phone,
            coalesce(u.email, a.guest_email)::text AS client_email,
            a.client_note, a.created_by_user_id
       FROM appointments a
       LEFT JOIN users u ON u.id = a.client_user_id AND u.organization_id = a.organization_id
      WHERE a.organization_id = $1 AND a.location_id = $2
        AND a.starts_at >= $3::timestamptz AND a.starts_at < $4::timestamptz
      ORDER BY a.starts_at, a.created_at`,
    [ctx.organizationId, location.id, from, to],
  );

  return res.rows
    .filter((r) => ctx.can('appointments.manage', { locationId: location.id, staffId: r.staff_id }))
    .map((r) => {
      const showContact = ctx.can('clients.view', { locationId: location.id, staffId: r.staff_id });
      return {
        id: r.id,
        staffId: r.staff_id,
        startsAt: r.starts_at,
        endsAt: r.ends_at,
        status: r.status,
        serviceName: r.service_name_snapshot,
        durationMin: r.duration_snapshot_min,
        price: r.price,
        clientName: r.client_name,
        clientPhone: showContact ? r.client_phone : null,
        clientEmail: showContact ? r.client_email : null,
        clientNote: r.client_note,
        enteredBySalon: r.created_by_user_id !== null,
      };
    });
}

/** Promena statusa iz panela: dozvola nad konkretnim terminom, prelaz, audit u istoj transakciji. */
export async function setAppointmentStatus(
  client: PoolClient,
  ctx: PanelContext,
  appointmentId: string,
  to: PanelStatusAction,
  nowMs: number,
): Promise<void> {
  await expirePendingAppointments(client, ctx.organizationId);
  const res = await client.query<{ location_id: string; staff_id: string; status: AppointmentStatus; starts_at: Date }>(
    `SELECT location_id, staff_id, status, starts_at FROM appointments
      WHERE id = $1 AND organization_id = $2 FOR UPDATE`,
    [appointmentId, ctx.organizationId],
  );
  const row = res.rows[0];
  if (!row) throw new PanelError('Termin ne postoji.');
  ctx.require('appointments.manage', { locationId: row.location_id, staffId: row.staff_id });
  if (!canTransition(row.status, to, row.starts_at.getTime(), nowMs)) {
    throw new PanelError('Termin je u međuvremenu promenjen. Osvežite stranicu.');
  }

  await client.query(
    `UPDATE appointments
        SET status = $2::appointment_status,
            confirmed_at = CASE WHEN $2 = 'confirmed' THEN now() ELSE confirmed_at END,
            pending_expires_at = CASE WHEN $2 = 'confirmed' THEN NULL ELSE pending_expires_at END,
            cancelled_at = CASE WHEN $2 = 'cancelled_by_salon' THEN now() ELSE cancelled_at END
      WHERE id = $1`,
    [appointmentId, to],
  );
  await writeAudit(client, {
    organizationId: ctx.organizationId,
    userId: ctx.actor.userId,
    action: 'appointment.status',
    objectType: 'appointment',
    objectId: appointmentId,
    oldValue: { status: row.status },
    newValue: { status: to },
  });
}

const CREATE_ERRORS = {
  not_found: 'Lokacija, usluga ili radnik ne postoje.',
  slot_unavailable: 'Termin više nije slobodan. Izaberite drugi.',
  slot_taken: 'Termin je upravo zauzet. Izaberite drugi.',
} as const;

/**
 * Termin koji unosi salon (telefonom/licno): odmah potvrdjen. Zaposleni sa "samo svoje"
 * moze da zakaze samo sebi; "bilo koji radnik" trazi dozvolu nad celom lokacijom.
 */
export async function createAppointmentByStaff(
  client: PoolClient,
  ctx: PanelContext,
  input: BookingInput,
  nowMs: number,
): Promise<{ id: string; staffId: string; startsAt: string }> {
  ctx.require('appointments.manage', { locationId: input.locationId, staffId: input.staffId });
  const result = await createAppointment(client, ctx.organizationId, input, nowMs, {
    kind: 'staff',
    createdByUserId: ctx.actor.userId,
  });
  if (!result.ok) throw new PanelError(CREATE_ERRORS[result.error]);

  const a = result.appointment;
  // Dodeljeni radnik (kod "bilo koji") mora takodje biti u dozvoli
  ctx.require('appointments.manage', { locationId: input.locationId, staffId: a.staff.id });
  await writeAudit(client, {
    organizationId: ctx.organizationId,
    userId: ctx.actor.userId,
    action: 'appointment.create',
    objectType: 'appointment',
    objectId: a.id,
    newValue: {
      staffId: a.staff.id,
      serviceId: a.service.id,
      startsAt: a.startsAt,
      price: a.service.price,
      status: a.status,
    },
  });
  return { id: a.id, staffId: a.staff.id, startsAt: a.startsAt };
}
