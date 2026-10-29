'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { runAdminAction, type ActionResult } from '@/lib/admin/context';
import { deleteStaffProfile, loadStaffLocations, setStaffActive, staffAccess } from '@/lib/admin/staff';
import { isId } from '@/lib/ids';
import {
  createStaff,
  createStaffLogin,
  parseEmail,
  parseStaffProfileForm,
  updateStaff,
} from '@/lib/panel/staff';
import type { CreateLoginResult } from '@/lib/panel/staff-types';

export type FormState = ActionResult<{ message: string; id?: string }> | null;
export type LoginFormState = ActionResult<CreateLoginResult> | null;
export type DeleteStaffState = ActionResult<{ message: string }> | null;
export type StaffActiveState = ActionResult<{ message: string }> | null;

export async function createStaffAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseStaffProfileForm(formData);
  if ('error' in parsed) return { ok: false, error: parsed.error };
  const result = await runAdminAction(async (client, ctx) => {
    const locations = await loadStaffLocations(client, ctx);
    return createStaff(client, staffAccess(ctx, locations), parsed);
  });
  if (!result.ok) return result;
  return { ok: true, data: { message: 'Zaposleni je dodat.', id: result.data.id } };
}

export async function updateStaffAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staffId = String(formData.get('staffId') ?? '');
  if (!isId(staffId)) return { ok: false, error: 'Zaposleni ne postoji.' };
  const parsed = parseStaffProfileForm(formData);
  if ('error' in parsed) return { ok: false, error: parsed.error };
  const result = await runAdminAction(async (client, ctx) => {
    const locations = await loadStaffLocations(client, ctx);
    await updateStaff(client, staffAccess(ctx, locations), {
      staffId,
      ...parsed,
      isActive: formData.get('isActive') === 'on',
    });
    return { message: 'Profil je sačuvan.' };
  });
  if (result.ok) refresh();
  return result;
}

export async function createLoginAction(_prev: LoginFormState, formData: FormData): Promise<LoginFormState> {
  const staffId = String(formData.get('staffId') ?? '');
  const email = parseEmail(formData.get('email'));
  if (!isId(staffId) || !email) return { ok: false, error: 'Unesite ispravan email.' };
  const rawPassword = formData.get('password');
  let password: string | null = null;
  if (typeof rawPassword === 'string' && rawPassword.length > 0) {
    if (rawPassword.length < 8 || rawPassword.length > 72) {
      return { ok: false, error: 'Lozinka mora imati između 8 i 72 znaka, ili ostavite prazno.' };
    }
    password = rawPassword;
  }
  return runAdminAction(async (client, ctx) => {
    const locations = await loadStaffLocations(client, ctx);
    return createStaffLogin(client, staffAccess(ctx, locations), { staffId, email, password });
  });
}

export async function deleteStaffAction(_prev: DeleteStaffState, formData: FormData): Promise<DeleteStaffState> {
  const staffId = String(formData.get('staffId') ?? '');
  if (!isId(staffId)) return { ok: false, error: 'Zaposleni ne postoji.' };
  const result = await runAdminAction((client, ctx) => deleteStaffProfile(client, ctx, staffId));
  if (!result.ok) return result;
  redirect('/admin/zaposleni');
}

export async function setStaffActiveAction(_prev: StaffActiveState, formData: FormData): Promise<StaffActiveState> {
  const staffId = String(formData.get('staffId') ?? '');
  if (!isId(staffId)) return { ok: false, error: 'Zaposleni ne postoji.' };
  const isActive = formData.get('isActive') === '1';
  const result = await runAdminAction((client, ctx) => setStaffActive(client, ctx, staffId, isActive));
  if (!result.ok) return result;
  refresh();
  return { ok: true, data: { message: isActive ? 'Zaposleni je aktivan.' : 'Zaposleni je deaktiviran.' } };
}
