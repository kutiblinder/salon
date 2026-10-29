'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const ERRORS: Record<string, string> = {
  not_found: 'Termin nije pronađen.',
  not_allowed: 'Ova radnja više nije moguća za ovaj termin.',
};

export function ManageActions({
  token,
  canConfirm,
  canCancel,
}: {
  token: string;
  canConfirm: boolean;
  canCancel: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: 'confirm' | 'cancel') {
    if (action === 'cancel' && !window.confirm('Da li sigurno otkazujete termin?')) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/appointments/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(ERRORS[data.error ?? ''] ?? 'Došlo je do greške. Pokušajte ponovo.');
      }
      router.refresh();
    } catch {
      setError('Nema veze sa serverom. Pokušajte ponovo.');
    } finally {
      setBusy(false);
    }
  }

  if (!canConfirm && !canCancel) return error ? <p className="mt-4 text-red-700">{error}</p> : null;

  return (
    <div className="mt-6 space-y-3">
      {canConfirm && (
        <button
          type="button"
          disabled={busy}
          onClick={() => run('confirm')}
          className="w-full rounded-lg bg-neutral-900 px-4 py-3 font-medium text-white disabled:opacity-50"
        >
          Potvrdi termin
        </button>
      )}
      {canCancel && (
        <button
          type="button"
          disabled={busy}
          onClick={() => run('cancel')}
          className="w-full rounded-lg border border-neutral-300 px-4 py-3 font-medium disabled:opacity-50"
        >
          Otkaži termin
        </button>
      )}
      {error && <p className="text-red-700">{error}</p>}
    </div>
  );
}
