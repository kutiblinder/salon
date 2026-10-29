import { handleTokenAction } from '@/lib/appointments/handle-token-action';
import { cancelByToken } from '@/lib/appointments/manage';

export const dynamic = 'force-dynamic';

/** POST /api/appointments/cancel { token }: gost otkazuje termin (do pocetka termina). */
export async function POST(request: Request) {
  return handleTokenAction(request, cancelByToken);
}
