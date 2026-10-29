'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { runPanelAction, type ActionResult } from '@/lib/panel/context';
import { isUuid } from '@/lib/panel/schedule';
import {
  createStaff,
  createStaffLogin,
  parseEmail,
  parseStaffProfileForm,
  updateStaff,
  deleteStaff,
} from '@/lib/panel/staff';
import type { CreateLoginResult } from '@/lib/panel/staff-types';

export type FormState = ActionResult<{ message: string; id?: string }> | null;
export type LoginFormState = ActionResult<CreateLoginResult> | null;

export async function createStaffAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseStaffProfileForm(formData);
  if ('error' in parsed) return { ok: false, error: parsed.error };

  const result = await runPanelAction(async (client, ctx) =>
    createStaff(client, ctx, {
      name: parsed.name,
      title: parsed.title,
      bio: parsed.bio,
      sortOrder: parsed.sortOrder,
      locationIds: parsed.locationIds,
      services: parsed.services,
    }),
  );
  if (!result.ok) return result;
  return { ok: true, data: { message: 'Zaposleni je dodat.', id: result.data.id } };
}

export async function updateStaffAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staffId = String(formData.get('staffId') ?? '');
  if (!isUuid(staffId)) return { ok: false, error: 'Neispravan zahtev.' };
  const parsed = parseStaffProfileForm(formData);
  if ('error' in parsed) return { ok: false, error: parsed.error };

  const result = await runPanelAction(async (client, ctx) => {
    await updateStaff(client, ctx, {
      staffId,
      name: parsed.name,
      title: parsed.title,
      bio: parsed.bio,
      isActive: formData.get('isActive') === 'on',
      sortOrder: parsed.sortOrder,
      locationIds: parsed.locationIds,
      services: parsed.services,
    });
    return { message: 'Profil je sačuvan.' };
  });
  if (result.ok) refresh();
  return result;
}

export async function createLoginAction(_prev: LoginFormState, formData: FormData): Promise<LoginFormState> {
  const staffId = String(formData.get('staffId') ?? '');
  const email = parseEmail(formData.get('email'));
  if (!isUuid(staffId) || !email) return { ok: false, error: 'Unesite ispravan email.' };
  const rawPassword = formData.get('password');
  let password: string | null = null;
  if (typeof rawPassword === 'string' && rawPassword.length > 0) {
    if (rawPassword.length < 8 || rawPassword.length > 72) {
      return { ok: false, error: 'Lozinka mora imati između 8 i 72 znaka, ili ostavite prazno.' };
    }
    password = rawPassword;
  }

  return runPanelAction(async (client, ctx) => createStaffLogin(client, ctx, { staffId, email, password }));
}

export async function deleteStaffAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staffId = String(formData.get('staffId') ?? '');
  if (!isUuid(staffId)) return { ok: false, error: 'Neispravan zahtev.' };
  const result = await runPanelAction(async (client, ctx) => {
    await deleteStaff(client, ctx, staffId);
    return { message: 'Zaposleni je obrisan.' };
  });
  if (!result.ok) return result;
  redirect('/panel/zaposleni');
}
