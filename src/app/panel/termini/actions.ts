'use server';

import { refresh } from 'next/cache';
import { getAvailability, isBookableDate } from '@/lib/availability/load';
import { isPanelStatusAction } from '@/lib/appointments/status';
import { parseStaffBooking } from '@/lib/appointments/validate';
import { PanelError, runPanelAction, type ActionResult } from '@/lib/panel/context';
import { createAppointmentByStaff, setAppointmentStatus } from '@/lib/panel/appointments';
import { formatTime } from '@/lib/panel/format';
import { isId } from '@/lib/ids';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function changeAppointmentStatus(appointmentId: string, to: string): Promise<ActionResult> {
  if (typeof appointmentId !== 'string' || !isId(appointmentId) || !isPanelStatusAction(to)) {
    return { ok: false, error: 'Neispravan zahtev.' };
  }
  const result = await runPanelAction(async (client, ctx) => {
    await setAppointmentStatus(client, ctx, appointmentId, to, Date.now());
    return undefined;
  });
  if (result.ok) refresh();
  return result;
}

export interface SlotOption {
  start: string;
  label: string;
}

/** Slobodni termini za formu "Novi termin" (bez minimalnog vremena unapred). */
export async function loadPanelSlots(
  locationId: string,
  serviceId: string,
  staffId: string | null,
  date: string,
): Promise<ActionResult<SlotOption[]>> {
  if (
    !isId(locationId) || !isId(serviceId) ||
    (staffId !== null && !isId(staffId)) || !DATE.test(date)
  ) {
    return { ok: false, error: 'Neispravan zahtev.' };
  }
  return runPanelAction(async (client, ctx) => {
    ctx.require('appointments.manage', { locationId, staffId });
    const location = ctx.locations.find((l) => l.id === locationId);
    if (!location) throw new PanelError('Lokacija ne postoji.');
    const nowMs = Date.now();
    if (!isBookableDate(date, nowMs, location.timezone)) return [];
    const availability = await getAvailability(client, {
      organizationId: ctx.organizationId,
      locationId,
      serviceId,
      staffId,
      date,
      nowMs,
      minNoticeMin: 0,
    });
    if (!availability) throw new PanelError('Usluga se ne radi na ovoj lokaciji.');
    return availability.slots.map((s) => ({
      start: s.start,
      label: formatTime(new Date(s.start), location.timezone),
    }));
  });
}

const BOOKING_ERRORS: Record<string, string> = {
  invalid_id: 'Izaberite uslugu.',
  invalid_start: 'Izaberite termin.',
  invalid_name: 'Unesite ime klijenta.',
  invalid_phone: 'Unesite ispravan broj telefona.',
  invalid_email: 'Email nije ispravan.',
  invalid_note: 'Napomena je predugačka.',
};

export type BookingFormState = ActionResult<{ message: string }> | null;

export async function bookAppointment(_prev: BookingFormState, formData: FormData): Promise<BookingFormState> {
  const parsed = parseStaffBooking(Object.fromEntries(formData));
  if (!parsed.ok) return { ok: false, error: BOOKING_ERRORS[parsed.error] ?? 'Proverite podatke.' };

  const result = await runPanelAction((client, ctx) => createAppointmentByStaff(client, ctx, parsed.value, Date.now()));
  if (!result.ok) return result;
  refresh();
  return { ok: true, data: { message: 'Termin je zakazan.' } };
}
