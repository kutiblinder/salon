'use server';

import { refresh } from 'next/cache';
import { runPlatformAction, type ActionResult } from '@/lib/admin/context';
import { parseOrgName } from '@/lib/admin/content';
import { createOrganization, deleteOrganization } from '@/lib/admin/organizations';
import { parseLocationName, parseSlug } from '@/lib/admin/organizations-parse';
import { deleteObject } from '@/lib/storage';
import { isId } from '@/lib/ids';

export type CreateSalonState = ActionResult<{ name: string; slug: string }> | null;

export async function createSalonAction(_prev: CreateSalonState, formData: FormData): Promise<CreateSalonState> {
  const name = parseOrgName(formData.get('name'));
  if (!name) return { ok: false, error: 'Naziv salona mora imati 2–80 karaktera.' };
  const slug = parseSlug(formData.get('slug'));
  if (!slug) {
    return {
      ok: false,
      error: 'Slug: mala slova, brojevi i crtica, 2–50 znakova (npr. frizer-ana). Rezervisane reči (www, admin) nisu dozvoljene.',
    };
  }
  const locationName = parseLocationName(formData.get('locationName'), name);
  if (!locationName) return { ok: false, error: 'Naziv objekta mora imati 2–80 karaktera.' };

  const result = await runPlatformAction(async (client, session) => {
    const created = await createOrganization(client, session, { name, slug, locationName });
    return { name: created.name, slug: created.slug };
  });
  if (result.ok) refresh();
  return result;
}

export type DeleteSalonState = ActionResult<{ message: string }> | null;

export async function deleteSalonAction(_prev: DeleteSalonState, formData: FormData): Promise<DeleteSalonState> {
  const organizationId = String(formData.get('organizationId') ?? '');
  if (!isId(organizationId)) return { ok: false, error: 'Salon ne postoji.' };
  const result = await runPlatformAction(async (client, session) => {
    const keys = await deleteOrganization(client, session, organizationId);
    return keys;
  });
  if (!result.ok) return result;
  for (const key of result.data) {
    await deleteObject(key);
  }
  refresh();
  return { ok: true, data: { message: 'Salon je obrisan.' } };
}
