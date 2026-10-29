import type { PoolClient } from 'pg';
import { writeAudit } from '../audit';
import { invalidateAuthCache } from '../auth/cache';
import { normalizeHost } from '../tenant-key';
import { AdminError, type AdminContext } from './core';

export interface OrgDomain {
  domain: string;
  verifiedAt: string | null;
  createdAt: string;
}

const UNIQUE_VIOLATION = '23505';

/** Hostname custom domena: lowercase, bez protokola/porta/putanje, nije subdomen platforme. */
export function parseCustomDomain(raw: unknown, baseDomain: string): string | null {
  if (typeof raw !== 'string') return null;
  let host = raw.trim().toLowerCase();
  host = host.replace(/^https?:\/\//, '');
  const slash = host.indexOf('/');
  if (slash >= 0) host = host.slice(0, slash);
  host = host.replace(/:\d+$/, '').replace(/\.$/, '');
  if (host.length < 4 || host.length > 253) return null;
  if (host === 'localhost' || host.endsWith('.localhost')) return null;
  if (/^\d+(\.\d+){3}$/.test(host)) return null;
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(host)) return null;

  const base = normalizeHost(baseDomain);
  if (!base) return null;
  if (host === base || host === `www.${base}` || host.endsWith(`.${base}`)) return null;
  return host;
}

export async function listDomains(client: PoolClient, ctx: AdminContext): Promise<OrgDomain[]> {
  ctx.require('content.edit');
  const res = await client.query<{ domain: string; verified_at: Date | null; created_at: Date }>(
    `SELECT domain, verified_at, created_at
       FROM organization_domains
      WHERE organization_id = $1
      ORDER BY created_at, domain`,
    [ctx.organizationId],
  );
  return res.rows.map((r) => ({
    domain: r.domain,
    verifiedAt: r.verified_at ? r.verified_at.toISOString() : null,
    createdAt: r.created_at.toISOString(),
  }));
}

export async function addDomain(client: PoolClient, ctx: AdminContext, domain: string): Promise<void> {
  ctx.require('content.edit');
  try {
    await client.query(
      `INSERT INTO organization_domains (domain, organization_id) VALUES ($1, $2)`,
      [domain, ctx.organizationId],
    );
  } catch (error) {
    if (typeof error === 'object' && error && 'code' in error && (error as { code: string }).code === UNIQUE_VIOLATION) {
      throw new AdminError('Ovaj domen je već dodat (ovom ili drugom salonu).');
    }
    throw error;
  }
  await writeAudit(client, {
    organizationId: ctx.organizationId,
    userId: ctx.session.user.id,
    action: 'domains.add',
    objectType: 'organization_domain',
    objectId: domain,
    newValue: { domain, verified: false },
  });
}

export async function setDomainVerified(
  client: PoolClient,
  ctx: AdminContext,
  domain: string,
  verified: boolean,
): Promise<void> {
  ctx.require('content.edit');
  const res = await client.query<{ verified_at: Date | null }>(
    `UPDATE organization_domains
        SET verified_at = CASE WHEN $3 THEN now() ELSE NULL END
      WHERE domain = $1 AND organization_id = $2
      RETURNING verified_at`,
    [domain, ctx.organizationId, verified],
  );
  if (!res.rows[0]) throw new AdminError('Domen nije pronađen.');
  await writeAudit(client, {
    organizationId: ctx.organizationId,
    userId: ctx.session.user.id,
    action: verified ? 'domains.verify' : 'domains.unverify',
    objectType: 'organization_domain',
    objectId: domain,
    newValue: { domain, verified },
  });
  invalidateAuthCache();
}

export async function deleteDomain(client: PoolClient, ctx: AdminContext, domain: string): Promise<void> {
  ctx.require('content.edit');
  const res = await client.query(`DELETE FROM organization_domains WHERE domain = $1 AND organization_id = $2`, [
    domain,
    ctx.organizationId,
  ]);
  if ((res.rowCount ?? 0) === 0) throw new AdminError('Domen nije pronađen.');
  await writeAudit(client, {
    organizationId: ctx.organizationId,
    userId: ctx.session.user.id,
    action: 'domains.delete',
    objectType: 'organization_domain',
    objectId: domain,
    oldValue: { domain },
  });
  invalidateAuthCache();
}
