'use client';

import { startTransition, useActionState, useState } from 'react';
import { createSalonAction, type CreateSalonState } from './actions';
import { slugFromName } from '@/lib/admin/organizations-parse';

const inputClass = 'mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-base';

export function NewSalonForm() {
  const [state, formAction, pending] = useActionState<CreateSalonState, FormData>(createSalonAction, null);
  const [slugTouched, setSlugTouched] = useState(false);

  return (
    <form
      className="mt-4 space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(() => formAction(new FormData(e.currentTarget)));
      }}
    >
      <label className="block text-sm font-medium">
        Naziv
        <input
          name="name"
          className={inputClass}
          maxLength={80}
          required
          onBlur={(e) => {
            if (slugTouched) return;
            const form = e.currentTarget.form;
            if (!form) return;
            const slug = form.elements.namedItem('slug');
            if (slug instanceof HTMLInputElement && slug.value.trim() === '') {
              slug.value = slugFromName(e.currentTarget.value);
            }
          }}
        />
      </label>
      <label className="block text-sm font-medium">
        Slug (poddomen)
        <input
          name="slug"
          className={inputClass}
          maxLength={50}
          required
          pattern="[a-z0-9]([a-z0-9-]*[a-z0-9])?"
          placeholder="frizer-ana"
          onChange={() => setSlugTouched(true)}
        />
      </label>
      <p className="text-sm text-neutral-600">
        Sajt će biti na <code>slug</code>.localhost (lokalno) ili slug.tvojsajt.rs. Status je nacrt dok ga ne
        objavite u Sadržaju.
      </p>
      <label className="block text-sm font-medium">
        Prvi objekat (opciono)
        <input name="locationName" className={inputClass} maxLength={80} placeholder="Isto kao naziv salona" />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded-md bg-neutral-900 px-4 font-medium text-white disabled:opacity-50"
      >
        {pending ? 'Dodavanje…' : 'Dodaj salon'}
      </button>
      {state && !state.ok && <p className="text-sm text-rose-700">{state.error}</p>}
      {state?.ok && (
        <p className="text-sm text-green-800">
          Salon {state.data.name} ({state.data.slug}) je dodat. Ušli ste u njega — dodajte naloge u Nalozi.
        </p>
      )}
    </form>
  );
}
