import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { PoolClient } from 'pg';
import { cache } from 'react';
import { withTenant } from '../db';
import { isSalonUnavailable } from '../auth/access';
import { getCurrentSession } from '../auth/session';
import { resolveTenantByHost } from '../tenant';
import { UserFacingError } from '../user-error';
import { PanelError, loadPanelContext, type ActionResult, type PanelContext, type SalonSession } from './core';

export { PanelError, type ActionResult, type PanelContext, type PanelLocation } from './core';

async function salonSession(): Promise<SalonSession | null> {
  const session = await getCurrentSession(await headers());
  if (!session || session.realm.kind !== 'salon') return null;
  return session as SalonSession;
}

/**
 * Za stranice panela: prijavljen nalog salona sa bar jednim clanstvom.
 * Kesirano po zahtevu (layout i stranica dele isti rezultat).
 */
export const requirePanel = cache(async (): Promise<PanelContext> => {
  const h = await headers();
  const tenant = await resolveTenantByHost(h.get('host'));
  if (tenant && isSalonUnavailable(tenant.status)) redirect('/');
  const session = await salonSession();
  if (!session) redirect('/prijava');
  const ctx = await withTenant(session.realm.organizationId, (client) => loadPanelContext(client, session));
  if (ctx.actor.memberships.length === 0) redirect('/nalog');
  return ctx;
});

/** Citanje podataka za stranicu panela u transakciji salona (RLS). */
export function panelQuery<T>(ctx: PanelContext, fn: (client: PoolClient) => Promise<T>): Promise<T> {
  return withTenant(ctx.organizationId, fn);
}

/**
 * Omotac za Server Actions panela: sesija sa ovog domena, dozvole ucitane iznova,
 * sve u jednoj transakciji (izmena + audit log). PanelError postaje poruka korisniku.
 */
export async function runPanelAction<T>(
  fn: (client: PoolClient, ctx: PanelContext) => Promise<T>,
): Promise<ActionResult<T>> {
  const session = await salonSession();
  if (!session) return { ok: false, error: 'Niste prijavljeni.' };
  if (isSalonUnavailable(session.realm.tenant.status)) return { ok: false, error: 'Sajt nije dostupan.' };
  try {
    const data = await withTenant(session.realm.organizationId, async (client) => {
      const ctx = await loadPanelContext(client, session);
      if (ctx.actor.memberships.length === 0) throw new PanelError('Nemate pristup panelu.');
      return fn(client, ctx);
    });
    return { ok: true, data };
  } catch (error) {
    if (error instanceof UserFacingError) return { ok: false, error: error.message };
    throw error;
  }
}
