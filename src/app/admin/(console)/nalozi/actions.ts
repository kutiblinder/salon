'use server';

import { refresh } from 'next/cache';
import { createSalonAccount, parseEmail, parseStaffName, type CreateAccountResult } from '@/lib/admin/accounts';
import { parseOptionalPassword, parseSalonRole } from '@/lib/admin/accounts-types';
import { runAdminAction, type ActionResult } from '@/lib/admin/context';

export type AccountFormState = ActionResult<CreateAccountResult> | null;

export async function createAccountAction(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const name = parseStaffName(formData.get('name'));
  if (!name) return { ok: false, error: 'Unesite ime (do 80 karaktera).' };
  const email = parseEmail(formData.get('email'));
  if (!email) return { ok: false, error: 'Unesite ispravan email.' };
  const role = parseSalonRole(formData.get('role'));
  if (!role) return { ok: false, error: 'Izaberite ulogu: vlasnik, menadžer ili zaposleni.' };
  const password = parseOptionalPassword(formData.get('password'));
  if (password === undefined) return { ok: false, error: 'Lozinka mora imati 8–128 znakova, ili ostavite prazno.' };

  const result = await runAdminAction((client, ctx) =>
    createSalonAccount(client, ctx, { name, email, role, password }),
  );
  if (result.ok) refresh();
  return result;
}
