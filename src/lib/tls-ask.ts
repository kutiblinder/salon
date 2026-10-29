import { getPool } from './db';
import { tenantKeyFromHost } from './tenant-key';

/**
 * Da li Caddy sme da izda TLS sertifikat za ovaj Host.
 * Platforma, postojeci slug salona, ili proveren custom domen.
 */
export async function isTlsIssuanceAllowed(rawDomain: string | null | undefined): Promise<boolean> {
  const base = process.env.BASE_DOMAIN ?? 'localhost';
  const key = tenantKeyFromHost(rawDomain, base);
  if (!key) return false;
  if (key.kind === 'platform') return true;

  const pool = getPool();
  if (key.kind === 'slug') {
    const res = await pool.query(`SELECT 1 FROM organizations WHERE slug = $1 LIMIT 1`, [key.slug]);
    return (res.rowCount ?? 0) > 0;
  }

  const aliases = domainAliases(key.domain);
  const res = await pool.query(
    `SELECT 1 FROM organization_domains WHERE domain = ANY($1::text[]) AND verified_at IS NOT NULL LIMIT 1`,
    [aliases],
  );
  return (res.rowCount ?? 0) > 0;
}

export function domainAliases(host: string): string[] {
  if (host.startsWith('www.') && host.length > 4) return [host, host.slice(4)];
  return [host, `www.${host}`];
}
