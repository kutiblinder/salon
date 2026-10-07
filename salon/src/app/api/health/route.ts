import { getPool } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await getPool().query('SELECT 1');
    return Response.json({ status: 'ok', db: 'up' });
  } catch (error) {
    console.error('Health check failed', error);
    return Response.json({ status: 'error', db: 'down' }, { status: 503 });
  }
}
