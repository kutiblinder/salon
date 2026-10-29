import { getPool } from './db';
import { tenantKeyFromHost } from './tenant-key';
import { domainAliases } from './tls-ask';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: 'draft' | 'published' | 'inactive';
  theme: Record<string, unknown>;
}

interface TenantRow extends Tenant {}

const SELECT_BY_SLUG = `SELECT id, name, slug, status, theme FROM organizations WHERE slug = $1`;
const SELECT_BY_DOMAIN = `
  SELECT o.id, o.name, o.slug, o.status, o.theme
  FROM organization_domains d
  JOIN organizations o ON o.id = d.organization_id
  WHERE d.domain = ANY($1::text[]) AND d.verified_at IS NOT NULL`;

/**
 * Pronalazi salon po Host headeru. Vraca null za pocetnu stranicu platforme ili nepoznat salon.
 * Koristi se samo `Host` header (ne X-Forwarded-Host): reverse proxy (Caddy) prosledjuje Host.
 */
export async function resolveTenantByHost(rawHost: string | null | undefined): Promise<Tenant | null> {
  const key = tenantKeyFromHost(rawHost, process.env.BASE_DOMAIN ?? 'localhost');
  if (!key || key.kind === 'platform') return null;

  const pool = getPool();
  const result =
    key.kind === 'slug'
      ? await pool.query<TenantRow>(SELECT_BY_SLUG, [key.slug])
      : await pool.query<TenantRow>(SELECT_BY_DOMAIN, [domainAliases(key.domain)]);
  return result.rows[0] ?? null;
}
