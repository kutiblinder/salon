'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { runAdminAction, type ActionResult } from '@/lib/admin/context';
import { createLocation, deleteLocation, updateLocation } from '@/lib/admin/locations';
import {
  parseHoursForm,
  parseLocationName,
  parseOptionalEmail,
  parseOptionalLine,
  parseSlotStep,
  parseSortOrder,
  type LocationHour,
} from '@/lib/admin/locations-types';
import { isId } from '@/lib/ids';

export type FormState = ActionResult<{ message: string; id?: string }> | null;

type ParsedLocationForm =
  | { error: string }
  | {
      name: string;
      address: string | null;
      city: string | null;
      phone: string | null;
      email: string | null;
      slotStepMin: number;
      sortOrder: number;
      hours: LocationHour[];
    };

function parseLocationForm(formData: FormData): ParsedLocationForm {
  const name = parseLocationName(formData.get('name'));
  if (!name) return { error: 'Naziv objekta mora imati 2–80 karaktera.' };
  const address = parseOptionalLine(formData.get('address'), 120);
  if (address === undefined) return { error: 'Adresa je predugačka.' };
  const city = parseOptionalLine(formData.get('city'), 80);
  if (city === undefined) return { error: 'Grad je predugačak.' };
  const phone = parseOptionalLine(formData.get('phone'), 40);
  if (phone === undefined) return { error: 'Telefon je predugačak.' };
  const email = parseOptionalEmail(formData.get('email'));
  if (email === undefined) return { error: 'Unesite ispravan email ili ostavite prazno.' };
  const slotStepMin = parseSlotStep(formData.get('slotStepMin'));
  if (slotStepMin === null) return { error: 'Korak termina je 5–60 minuta.' };
  const sortOrder = parseSortOrder(formData.get('sortOrder'));
  if (sortOrder === null) return { error: 'Redosled mora biti nula ili pozitivan broj.' };
  const hours = parseHoursForm(formData);
  if ('error' in hours) return { error: hours.error };
  return { name, address, city, phone, email, slotStepMin, sortOrder, hours };
}

export async function createLocationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseLocationForm(formData);
  if ('error' in parsed) return { ok: false, error: parsed.error };
  const result = await runAdminAction((client, ctx) => createLocation(client, ctx, parsed));
  if (!result.ok) return result;
  const extra =
    result.data.copiedOffers > 0
      ? ` Cene su kopirane sa postojećeg objekta (${result.data.copiedOffers}). Zaposlene dodelite u panelu.`
      : '';
  refresh();
  return { ok: true, data: { message: `Objekat je dodat.${extra}`, id: result.data.id } };
}

export async function updateLocationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locationId = String(formData.get('locationId') ?? '');
  if (!isId(locationId)) return { ok: false, error: 'Objekat ne postoji.' };
  const parsed = parseLocationForm(formData);
  if ('error' in parsed) return { ok: false, error: parsed.error };
  const result = await runAdminAction((client, ctx) =>
    updateLocation(client, ctx, {
      locationId,
      ...parsed,
      isActive: formData.get('isActive') === 'on',
    }),
  );
  if (result.ok) refresh();
  if (!result.ok) return result;
  return { ok: true, data: { message: 'Objekat je sačuvan.' } };
}

export async function deleteLocationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locationId = String(formData.get('locationId') ?? '');
  if (!isId(locationId)) return { ok: false, error: 'Objekat ne postoji.' };
  const result = await runAdminAction((client, ctx) => deleteLocation(client, ctx, locationId));
  if (!result.ok) return result;
  redirect('/admin/objekti');
}
