import { Pool, type PoolClient } from 'pg';

declare global {
  // Cuva pool izmedju hot-reload-a u razvoju
  var __salonPgPool: Pool | undefined;
}

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set (vidi .env.example)');
  return new Pool({ connectionString, max: 10 });
}

export function getPool(): Pool {
  return (globalThis.__salonPgPool ??= createPool());
}

/**
 * Izvrsava funkciju u transakciji sa postavljenim tenantom za Row Level Security
 * (app.organization_id). Sve upite vezane za jedan salon pozivaj kroz ovu funkciju.
 *
 * Napomena: RLS se primenjuje tek kad se aplikacija konektuje ulogom koja nije
 * superuser/vlasnik tabela. Lokalni docker korisnik `salon` je superuser, pa RLS tamo
 * ne filtrira; zato svaki upit ipak mora eksplicitno da filtrira po organization_id.
 */
export async function withTenant<T>(
  organizationId: string,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.organization_id', $1, true)", [organizationId]);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
