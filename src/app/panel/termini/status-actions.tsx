'use client';

import { useState, useTransition } from 'react';
import type { PanelStatusAction } from '@/lib/appointments/status';
import { changeAppointmentStatus } from './actions';

const LABELS: Record<PanelStatusAction, string> = {
  confirmed: 'Potvrdi rezervaciju',
  cancelled_by_salon: 'Otkaži',
  completed: 'Završen',
  no_show: 'Nije došao',
};

const STYLES: Record<PanelStatusAction, string> = {
  confirmed: 'bg-emerald-700 text-white',
  cancelled_by_salon: 'border border-neutral-300 text-neutral-800',
  completed: 'bg-neutral-900 text-white',
  no_show: 'border border-rose-300 text-rose-800',
};

export function StatusActions({ appointmentId, actions }: { appointmentId: string; actions: PanelStatusAction[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (actions.length === 0) return null;

  function run(to: PanelStatusAction) {
    if (to === 'cancelled_by_salon' && !window.confirm('Otkazati ovaj termin?')) return;
    setError(null);
    startTransition(async () => {
      const result = await changeAppointmentStatus(appointmentId, to);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">
        {actions.map((to) => (
          <button
            key={to}
            type="button"
            disabled={pending}
            onClick={() => run(to)}
            className={`min-h-10 rounded-md px-3 text-sm font-medium disabled:opacity-50 ${STYLES[to]}`}
          >
            {LABELS[to]}
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-sm text-rose-700">{error}</p>}
    </div>
  );
}
