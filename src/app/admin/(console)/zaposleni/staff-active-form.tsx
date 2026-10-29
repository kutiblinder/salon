'use client';

import { startTransition, useActionState } from 'react';
import { setStaffActiveAction, type StaffActiveState } from './actions';

export function StaffActiveForm({
  staffId,
  isActive,
  name,
}: {
  staffId: string;
  isActive: boolean;
  name: string;
}) {
  const [state, formAction, pending] = useActionState<StaffActiveState, FormData>(setStaffActiveAction, null);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (
          isActive &&
          !confirm(`Deaktivirati „${name}“? Profil i podaci ostaju, neće moći da se prijavi.`)
        ) {
          return;
        }
        startTransition(() => formAction(new FormData(e.currentTarget)));
      }}
    >
      <input type="hidden" name="staffId" value={staffId} />
      <input type="hidden" name="isActive" value={isActive ? '0' : '1'} />
      <button
        type="submit"
        disabled={pending}
        className="min-h-10 rounded-md border border-neutral-300 px-3 text-sm disabled:opacity-50"
      >
        {pending ? 'Čuvanje…' : isActive ? 'Deaktiviraj' : 'Aktiviraj'}
      </button>
      {state && !state.ok && <p className="mt-2 text-sm text-rose-700">{state.error}</p>}
    </form>
  );
}
