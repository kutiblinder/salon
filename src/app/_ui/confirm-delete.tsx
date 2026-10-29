'use client';

import { startTransition, useActionState, type ReactNode } from 'react';

type State = { ok: true; data: { message: string } } | { ok: false; error: string } | null;

export function ConfirmDelete({
  action,
  message,
  label,
  children,
}: {
  action: (prev: State, formData: FormData) => Promise<State>;
  message: string;
  label: string;
  children?: ReactNode;
}) {
  const [state, formAction, pending] = useActionState<State, FormData>(action, null);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!confirm(message)) return;
        startTransition(() => formAction(new FormData(e.currentTarget)));
      }}
    >
      {children}
      <button
        type="submit"
        disabled={pending}
        className="min-h-10 rounded-md border border-rose-300 px-3 text-sm text-rose-800 disabled:opacity-50"
      >
        {pending ? 'Brisanje…' : label}
      </button>
      {state && !state.ok && <p className="mt-2 text-sm text-rose-700">{state.error}</p>}
      {state?.ok && <p className="mt-2 text-sm text-green-800">{state.data.message}</p>}
    </form>
  );
}
