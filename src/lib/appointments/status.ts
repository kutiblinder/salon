export type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'cancelled_by_client'
  | 'cancelled_by_salon'
  | 'completed'
  | 'no_show';

/** Statusi koje salon postavlja iz panela. */
export type PanelStatusAction = 'confirmed' | 'cancelled_by_salon' | 'completed' | 'no_show';

export const PANEL_STATUS_ACTIONS: readonly PanelStatusAction[] = [
  'confirmed',
  'cancelled_by_salon',
  'completed',
  'no_show',
];

export function isPanelStatusAction(value: unknown): value is PanelStatusAction {
  return typeof value === 'string' && (PANEL_STATUS_ACTIONS as readonly string[]).includes(value);
}

/**
 * Dozvoljeni prelazi statusa iz panela:
 * - pending -> confirmed (stari pending redovi; novi gosti su odmah potvrdjeni)
 * - pending/confirmed -> cancelled_by_salon
 * - confirmed -> completed / no_show, tek kad je termin poceo
 * Otkazani, zavrseni i "nije dosao" termini se vise ne menjaju.
 */
export function canTransition(
  from: AppointmentStatus,
  to: PanelStatusAction,
  startsAtMs: number,
  nowMs: number,
): boolean {
  switch (to) {
    case 'confirmed':
      return from === 'pending';
    case 'cancelled_by_salon':
      return from === 'pending' || from === 'confirmed';
    case 'completed':
    case 'no_show':
      return from === 'confirmed' && startsAtMs <= nowMs;
  }
}

/** Akcije koje panel nudi za termin (redosled = redosled dugmadi). */
export function availableActions(
  from: AppointmentStatus,
  startsAtMs: number,
  nowMs: number,
): PanelStatusAction[] {
  return PANEL_STATUS_ACTIONS.filter((to) => canTransition(from, to, startsAtMs, nowMs));
}
