'use client';

import { startTransition, useActionState } from 'react';
import type { AdminLocation } from '@/lib/admin/prices-types';
import type { GalleryItem } from '@/lib/admin/gallery-types';
import { GALLERY_MAX_ITEMS } from '@/lib/admin/gallery-types';
import { addImageAction, deleteImageAction, moveImageAction, updateImageAction, type FormState } from './actions';

const inputClass = 'mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-base';

function AddForm({ locations }: { locations: AdminLocation[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(addImageAction, null);
  return (
    <form
      className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(() => formAction(new FormData(e.currentTarget)));
      }}
    >
      <h2 className="font-medium">Nova slika</h2>
      <label className="block text-sm font-medium">
        Fajl (JPEG, PNG ili WebP, do 5 MB)
        <input name="file" type="file" accept="image/jpeg,image/png,image/webp" className={`${inputClass} file:mr-3`} required />
      </label>
      <label className="block text-sm font-medium">
        Alt tekst
        <input name="altText" className={inputClass} maxLength={120} required />
      </label>
      <label className="block text-sm font-medium">
        Natpis (opciono)
        <input name="caption" className={inputClass} maxLength={200} />
      </label>
      {locations.length > 0 && (
        <label className="block text-sm font-medium">
          Objekat (opciono)
          <select name="locationId" className={inputClass} defaultValue="">
            <option value="">Svi objekti</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <button type="submit" disabled={pending} className="min-h-11 rounded-md bg-neutral-900 px-4 font-medium text-white disabled:opacity-50">
        {pending ? 'Otpremanje…' : 'Dodaj sliku'}
      </button>
      {state && !state.ok && <p className="text-sm text-rose-700">{state.error}</p>}
      {state?.ok && <p className="text-sm text-emerald-700">{state.data.message}</p>}
    </form>
  );
}

function ItemForm({ item, locations }: { item: GalleryItem; locations: AdminLocation[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(updateImageAction, null);
  return (
    <li className="rounded-lg border border-neutral-200 bg-white p-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/media/${item.mediaId}`}
          alt={item.altText ?? ''}
          className="h-28 w-full rounded-md object-cover sm:h-28 sm:w-36"
        />
        <form
          className="min-w-0 flex-1 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(() => formAction(new FormData(e.currentTarget)));
          }}
        >
          <input type="hidden" name="id" value={item.id} />
          <label className="block text-sm">
            Alt tekst
            <input name="altText" defaultValue={item.altText ?? ''} className={inputClass} maxLength={120} required />
          </label>
          <label className="block text-sm">
            Natpis
            <input name="caption" defaultValue={item.caption ?? ''} className={inputClass} maxLength={200} />
          </label>
          {locations.length > 0 && (
            <label className="block text-sm">
              Objekat
              <select name="locationId" className={inputClass} defaultValue={item.locationId ?? ''}>
                <option value="">Svi objekti</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={pending} className="min-h-10 rounded-md bg-neutral-900 px-3 text-sm font-medium text-white disabled:opacity-50">
              Sačuvaj
            </button>
            {state && !state.ok && <p className="text-sm text-rose-700">{state.error}</p>}
            {state?.ok && <p className="text-sm text-emerald-700">{state.data.message}</p>}
          </div>
        </form>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <form action={moveImageAction}>
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="direction" value="up" />
          <button type="submit" className="min-h-10 rounded-md border border-neutral-300 px-3 text-sm">
            Gore
          </button>
        </form>
        <form action={moveImageAction}>
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="direction" value="down" />
          <button type="submit" className="min-h-10 rounded-md border border-neutral-300 px-3 text-sm">
            Dole
          </button>
        </form>
        <form action={deleteImageAction}>
          <input type="hidden" name="id" value={item.id} />
          <button type="submit" className="min-h-10 rounded-md border border-rose-300 px-3 text-sm text-rose-800">
            Obriši
          </button>
        </form>
      </div>
    </li>
  );
}

export function GalleryManager({
  items,
  locations,
}: {
  items: GalleryItem[];
  locations: AdminLocation[];
}) {
  return (
    <div className="space-y-8">
      {items.length < GALLERY_MAX_ITEMS && <AddForm locations={locations} />}
      {items.length >= GALLERY_MAX_ITEMS && (
        <p className="text-sm text-neutral-600">Dosegnut je limit od {GALLERY_MAX_ITEMS} slika.</p>
      )}
      {items.length === 0 ? (
        <p className="text-sm text-neutral-600">Još nema slika u galeriji.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <ItemForm key={item.id} item={item} locations={locations} />
          ))}
        </ul>
      )}
    </div>
  );
}
