import { getPool } from '@/lib/db';
import { expirePendingAppointments } from '@/lib/appointments/expire';

export const dynamic = 'force-dynamic';

/** POST /api/jobs/expire-pending  Authorization: Bearer $CRON_SECRET */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  const client = await getPool().connect();
  try {
    const count = await expirePendingAppointments(client, null);
    return Response.json({ cancelled: count });
  } finally {
    client.release();
  }
}
