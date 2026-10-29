'use server';

import { refresh } from 'next/cache';
import { PanelError, runPanelAction, type ActionResult } from '@/lib/panel/context';
import {
  createShiftTemplate,
  deleteException,
  deleteShiftTemplate,
  isDate,
  isUuid,
  isWeekday,
  parseShiftWindow,
  parseTemplateName,
  setWeeklyDay,
  updateShiftTemplate,
  upsertException,
} from '@/lib/panel/schedule';

export type FormState = ActionResult<{ message: string }> | null;

function refreshed<T>(result: ActionResult<T>): ActionResult<T> {
  if (result.ok) refresh();
  return result;
}

export async function saveTemplate(_prev: FormState, formData: FormData): Promise<FormState> {
  const locationId = String(formData.get('locationId') ?? '');
  const templateId = String(formData.get('templateId') ?? '');
  const name = parseTemplateName(formData.get('name'));
  const window = parseShiftWindow(formData.get('startsAt'), formData.get('endsAt'));
  if (!isUuid(locationId) || !name) return { ok: false, error: 'Unesite naziv šablona (do 80 karaktera).' };
  if (!window) return { ok: false, error: 'Kraj smene mora biti posle početka, u istom danu.' };

  const result = await runPanelAction(async (client, ctx) => {
    if (templateId) {
      if (!isUuid(templateId)) throw new PanelError('Neispravan zahtev.');
      await updateShiftTemplate(client, ctx, { templateId, name, start: window.start, end: window.end });
      return { message: 'Šablon je sačuvan.' };
    }
    await createShiftTemplate(client, ctx, { locationId, name, start: window.start, end: window.end });
    return { message: 'Šablon je dodat.' };
  });
  return refreshed(result);
}

export async function removeTemplate(templateId: string): Promise<ActionResult> {
  if (!isUuid(templateId)) return { ok: false, error: 'Neispravan zahtev.' };
  return refreshed(
    await runPanelAction(async (client, ctx) => {
      await deleteShiftTemplate(client, ctx, templateId);
      return undefined;
    }),
  );
}

/** Prazan templateId = ne radi na ovoj lokaciji. '__other__' = ne diraj drugi objekat. */
export async function saveWeeklyDay(staffId: string, locationId: string, weekday: number, templateId: string): Promise<ActionResult> {
  if (!isUuid(staffId) || !isUuid(locationId) || !isWeekday(weekday)) {
    return { ok: false, error: 'Neispravan zahtev.' };
  }
  if (templateId === '__other__') return { ok: true, data: undefined };
  if (templateId !== '' && !isUuid(templateId)) return { ok: false, error: 'Neispravan zahtev.' };
  return refreshed(
    await runPanelAction(async (client, ctx) => {
      await setWeeklyDay(client, ctx, {
        staffId,
        locationId,
        weekday,
        templateId: templateId === '' ? null : templateId,
      });
      return undefined;
    }),
  );
}

export async function saveException(_prev: FormState, formData: FormData): Promise<FormState> {
  const locationId = String(formData.get('locationId') ?? '');
  const staffId = String(formData.get('staffId') ?? '');
  const date = String(formData.get('date') ?? '');
  const kind = String(formData.get('kind') ?? '');
  const templateId = String(formData.get('templateId') ?? '');
  if (!isUuid(locationId) || !isUuid(staffId) || !isDate(date)) {
    return { ok: false, error: 'Izaberite radnika i datum.' };
  }
  if (kind !== 'off' && kind !== 'shift') return { ok: false, error: 'Izaberite vrstu izuzetka.' };
  if (kind === 'shift' && !isUuid(templateId)) return { ok: false, error: 'Izaberite šablon smene.' };

  const result = await runPanelAction(async (client, ctx) => {
    if (kind === 'off') {
      await upsertException(client, ctx, { staffId, date, kind: 'off', locationId });
    } else {
      await upsertException(client, ctx, { staffId, date, kind: 'shift', locationId, templateId });
    }
    return { message: 'Izuzetak je sačuvan.' };
  });
  return refreshed(result);
}

export async function removeException(staffId: string, date: string, locationId: string): Promise<ActionResult> {
  if (!isUuid(staffId) || !isDate(date) || !isUuid(locationId)) return { ok: false, error: 'Neispravan zahtev.' };
  return refreshed(
    await runPanelAction(async (client, ctx) => {
      await deleteException(client, ctx, { staffId, date, locationId });
      return undefined;
    }),
  );
}
