import { handleTokenAction } from '@/lib/appointments/handle-token-action';
import { confirmByToken } from '@/lib/appointments/manage';

export const dynamic = 'force-dynamic';

/** POST /api/appointments/confirm { token }: gost potvrdjuje termin. */
export async function POST(request: Request) {
  return handleTokenAction(request, confirmByToken);
}
