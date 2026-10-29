'use server';

import { refresh } from 'next/cache';
import { runAdminAction, type ActionResult } from '@/lib/admin/context';
import { CONTENT_FIELDS, fieldId, parseContentForm, saveContent } from '@/lib/admin/content';

export type FormState = ActionResult<{ message: string }> | null;

export async function saveContentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values: Record<string, unknown> = {};
  for (const field of CONTENT_FIELDS) {
    values[fieldId(field)] = formData.get(fieldId(field));
  }
  const parsed = parseContentForm({
    name: formData.get('name'),
    status: formData.get('status'),
    primaryColor: formData.get('primaryColor'),
    values,
  });
  if ('error' in parsed) return { ok: false, error: parsed.error };

  const result = await runAdminAction(async (client, ctx) => {
    await saveContent(client, ctx, parsed);
    return { message: 'Sadržaj je sačuvan.' };
  });
  if (result.ok) refresh();
  return result;
}
