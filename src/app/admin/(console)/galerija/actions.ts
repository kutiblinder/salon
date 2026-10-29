'use server';

import { refresh } from 'next/cache';
import { runAdminAction, type ActionResult } from '@/lib/admin/context';
import {
  addGalleryImage,
  deleteGalleryItem,
  moveGalleryItem,
  parseAltText,
  parseCaption,
  parseOptionalLocationId,
  updateGalleryItem,
  GALLERY_MAX_UPLOAD_BYTES,
} from '@/lib/admin/gallery';
import { isUuid } from '@/lib/panel/schedule';

export type FormState = ActionResult<{ message: string }> | null;

async function fileBytes(file: File): Promise<Buffer | { error: string }> {
  if (file.size <= 0) return { error: 'Izaberite sliku.' };
  if (file.size > GALLERY_MAX_UPLOAD_BYTES) return { error: 'Slika mora biti do 5 MB.' };
  return Buffer.from(await file.arrayBuffer());
}

export async function addImageAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const file = formData.get('file');
  if (!(file instanceof File)) return { ok: false, error: 'Izaberite sliku.' };
  const bytes = await fileBytes(file);
  if ('error' in bytes) return { ok: false, error: bytes.error };
  const altText = parseAltText(formData.get('altText'));
  const caption = parseCaption(formData.get('caption'));
  const locationId = parseOptionalLocationId(formData.get('locationId'));
  if (!altText) return { ok: false, error: 'Unesite kratak opis slike (alt tekst, do 120 karaktera).' };
  if (caption === undefined) return { ok: false, error: 'Natpis je predugačak.' };
  if (locationId === undefined) return { ok: false, error: 'Neispravan objekat.' };

  const result = await runAdminAction(async (client, ctx) => {
    await addGalleryImage(client, ctx, { bytes, altText, caption, locationId });
    return { message: 'Slika je dodata.' };
  });
  if (result.ok) refresh();
  return result;
}

export async function updateImageAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get('id') ?? '');
  if (!isUuid(id)) return { ok: false, error: 'Neispravan zahtev.' };
  const altText = parseAltText(formData.get('altText'));
  const caption = parseCaption(formData.get('caption'));
  const locationId = parseOptionalLocationId(formData.get('locationId'));
  if (!altText) return { ok: false, error: 'Unesite kratak opis slike (alt tekst, do 120 karaktera).' };
  if (caption === undefined) return { ok: false, error: 'Natpis je predugačak.' };
  if (locationId === undefined) return { ok: false, error: 'Neispravan objekat.' };

  const result = await runAdminAction(async (client, ctx) => {
    await updateGalleryItem(client, ctx, { id, altText, caption, locationId });
    return { message: 'Slika je sačuvana.' };
  });
  if (result.ok) refresh();
  return result;
}

export async function deleteImageAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  if (!isUuid(id)) return;
  const result = await runAdminAction(async (client, ctx) => {
    await deleteGalleryItem(client, ctx, id);
  });
  if (result.ok) refresh();
}

export async function moveImageAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  const direction = formData.get('direction');
  if (!isUuid(id) || (direction !== 'up' && direction !== 'down')) return;
  const result = await runAdminAction(async (client, ctx) => {
    await moveGalleryItem(client, ctx, id, direction);
  });
  if (result.ok) refresh();
}
