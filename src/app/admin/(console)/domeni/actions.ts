'use server';

import { refresh } from 'next/cache';
import { runAdminAction, type ActionResult } from '@/lib/admin/context';
import { addDomain, deleteDomain, parseCustomDomain, setDomainVerified } from '@/lib/admin/domains';

export type FormState = ActionResult<{ message: string }> | null;

export async function addDomainAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const domain = parseCustomDomain(formData.get('domain'), process.env.BASE_DOMAIN ?? 'localhost');
  if (!domain) {
    return { ok: false, error: 'Unesite ispravan domen (npr. frizer-ana.rs), ne poddomen platforme.' };
  }
  const result = await runAdminAction(async (client, ctx) => {
    await addDomain(client, ctx, domain);
    return { message: 'Domen je dodat. Označite ga kao proveren kad DNS pokazuje na server.' };
  });
  if (result.ok) refresh();
  return result;
}

export async function verifyDomainAction(formData: FormData): Promise<void> {
  const domain = parseCustomDomain(formData.get('domain'), process.env.BASE_DOMAIN ?? 'localhost');
  const verified = formData.get('verified') === '1';
  if (!domain) return;
  const result = await runAdminAction(async (client, ctx) => {
    await setDomainVerified(client, ctx, domain, verified);
  });
  if (result.ok) refresh();
}

export async function deleteDomainAction(formData: FormData): Promise<void> {
  const domain = parseCustomDomain(formData.get('domain'), process.env.BASE_DOMAIN ?? 'localhost');
  if (!domain) return;
  const result = await runAdminAction(async (client, ctx) => {
    await deleteDomain(client, ctx, domain);
  });
  if (result.ok) refresh();
}
