'use server';

import { refresh } from 'next/cache';
import { PanelError, runPanelAction, type ActionResult } from '@/lib/panel/context';
import { isDate, isUuid } from '@/lib/panel/schedule';
import { breakRange, createTimeOff, deleteTimeOff, fullDayRange, parseNote } from '@/lib/panel/time-off';
import { isTimeOffKind } from '@/lib/panel/time-off-types';

export type FormState = ActionResult<{ message: string }> | null;

function refreshed<T>(result: ActionResult<T>): ActionResult<T> {
  if (result.ok) refresh();
  return result;
}

function timezoneOf(locations: { timezone: string }[]): string {
  return locations[0]?.timezone ?? 'Europe/Belgrade';
}

export async function saveTimeOff(_prev: FormState, formData: FormData): Promise<FormState> {
  const staffId = String(formData.get('staffId') ?? '');
  const kind = String(formData.get('kind') ?? '');
  if (!isUuid(staffId) || !isTimeOffKind(kind)) return { ok: false, error: 'Izaberite radnika i vrstu odsustva.' };
  const note = parseNote(formData.get('note'));
  if (note === undefined) return { ok: false, error: 'Napomena je predugačka.' };

  const result = await runPanelAction(async (client, ctx) => {
    const tz = timezoneOf(ctx.locations);
    let range: { startMs: number; endMs: number } | null;
    if (kind === 'break') {
      range = breakRange(String(formData.get('date') ?? ''), formData.get('startsAt'), formData.get('endsAt'), tz);
      if (!range) throw new PanelError('Za pauzu unesite datum i vreme u istom danu.');
    } else {
      const from = String(formData.get('fromDate') ?? '');
      const to = String(formData.get('toDate') ?? '');
      if (!isDate(from) || !isDate(to)) throw new PanelError('Unesite početni i završni datum.');
      range = fullDayRange(from, to, tz);
      if (!range) throw new PanelError('Završni datum ne može biti pre početnog.');
    }
    await createTimeOff(client, ctx, { staffId, kind, startMs: range.startMs, endMs: range.endMs, note });
    return { message: 'Odsustvo je sačuvano.' };
  });
  return refreshed(result);
}

export async function removeTimeOff(id: string): Promise<ActionResult> {
  if (!isUuid(id)) return { ok: false, error: 'Neispravan zahtev.' };
  return refreshed(
    await runPanelAction(async (client, ctx) => {
      await deleteTimeOff(client, ctx, id);
      return undefined;
    }),
  );
}
