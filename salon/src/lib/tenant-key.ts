/**
 * Odredjivanje salona iz Host headera (cista funkcija, bez baze).
 * Tenant se NIKAD ne uzima iz parametra koji salje korisnik.
 */

export type TenantKey =
  | { kind: 'slug'; slug: string } // ana.tvojsajt.rs
  | { kind: 'domain'; domain: string } // frizerka-ana.rs (custom domen)
  | { kind: 'platform' }; // tvojsajt.rs (pocetna platforme)

export function normalizeHost(rawHost: string | null | undefined): string | null {
  if (!rawHost) return null;
  const withoutPort = rawHost.trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
  return withoutPort || null;
}

export function tenantKeyFromHost(rawHost: string | null | undefined, baseDomain: string): TenantKey | null {
  const host = normalizeHost(rawHost);
  const base = normalizeHost(baseDomain);
  if (!host || !base) return null;

  if (host === base || host === `www.${base}`) return { kind: 'platform' };

  const suffix = `.${base}`;
  if (host.endsWith(suffix)) {
    const slug = host.slice(0, -suffix.length);
    // samo jedan nivo subdomena i dozvoljeni znakovi (isto pravilo kao CHECK u bazi)
    if (/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(slug)) return { kind: 'slug', slug };
    return null;
  }

  return { kind: 'domain', domain: host };
}
