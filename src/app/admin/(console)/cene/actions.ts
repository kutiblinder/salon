'use server';

import { refresh } from 'next/cache';
import { runAdminAction, type ActionResult } from '@/lib/admin/context';
import {
  createService,
  parseDescription,
  parseOffers,
  parseServiceName,
  parseSortOrder,
  updateService,
  type ServiceOffer,
} from '@/lib/admin/prices';
import { isUuid } from '@/lib/panel/schedule';

export type FormState = ActionResult<{ message: string; id?: string }> | null;

type ParsedServiceForm =
  | { error: string }
  | { name: string; description: string | null; sortOrder: number; offers: ServiceOffer[] };

function parseServiceForm(formData: FormData): ParsedServiceForm {
  const name = parseServiceName(formData.get('name'));
  const description = parseDescription(formData.get('description'));
  const sortOrder = parseSortOrder(formData.get('sortOrder'));
  if (!name) return { error: 'Unesite naziv usluge (do 80 karaktera).' };
  if (description === undefined) return { error: 'Opis je predugačak.' };
  if (sortOrder === null) return { error: 'Redosled mora biti nula ili pozitivan broj.' };
  const offers = parseOffers(formData.getAll('locationId'), (locationId, field) =>
    formData.get(`${field}_${locationId}`),
  );
  if ('error' in offers) return { error: offers.error };
  if (offers.length === 0) return { error: 'Izaberite bar jedan objekat sa cenom i trajanjem.' };
  return { name, description, sortOrder, offers };
}

export async function createServiceAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseServiceForm(formData);
  if ('error' in parsed) return { ok: false, error: parsed.error };
  const result = await runAdminAction(async (client, ctx) =>
    createService(client, ctx, {
      name: parsed.name,
      description: parsed.description,
      sortOrder: parsed.sortOrder,
      offers: parsed.offers,
    }),
  );
  if (!result.ok) return result;
  return { ok: true, data: { message: 'Usluga je dodata.', id: result.data.id } };
}

export async function updateServiceAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const serviceId = String(formData.get('serviceId') ?? '');
  if (!isUuid(serviceId)) return { ok: false, error: 'Neispravan zahtev.' };
  const parsed = parseServiceForm(formData);
  if ('error' in parsed) return { ok: false, error: parsed.error };
  const result = await runAdminAction(async (client, ctx) => {
    await updateService(client, ctx, {
      serviceId,
      name: parsed.name,
      description: parsed.description,
      isActive: formData.get('isActive') === 'on',
      sortOrder: parsed.sortOrder,
      offers: parsed.offers,
    });
    return { message: 'Cenovnik je sačuvan.' };
  });
  if (result.ok) refresh();
  return result;
}
