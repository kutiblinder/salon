import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { PoolClient } from 'pg';
import { cache } from 'react';
import { isPlatformAdmin, loadActor } from '../auth/actor';
import { getCurrentSession } from '../auth/session';
import { getPool, withTenant } from '../db';
import { AdminError, loadAdminContext, type ActionResult, type AdminContext, type PlatformSession } from './core';

export { AdminError, type ActionResult, type AdminContext } from './core';

async function platformSession(): Promise<PlatformSession | null> {
  const session = await getCurrentSession(await headers());
  if (!session || session.realm.kind !== 'platform') return null;
  return session as PlatformSession;
}

/** Prijavljen admin platforme (stranice /admin). */
export const requireAdmin = cache(async (): Promise<PlatformSession> => {
  const session = await platformSession();
  if (!session) redirect('/admin/prijava');
  const client = await getPool().connect();
  try {
    if (!isPlatformAdmin(await loadActor(client, session))) redirect('/admin/prijava');
  } finally {
    client.release();
  }
  return session;
});

/**
 * Admin koji je usao u salon. Salon se uzima iz sesije, nikad iz parametra zahteva.
 */
export const requireAdminSalon = cache(async (): Promise<AdminContext> => {
  const session = await requireAdmin();
  if (!session.activeOrganizationId) redirect('/admin');
  const ctx = await withTenant(session.activeOrganizationId, (client) => loadAdminContext(client, session));
  if (!ctx) redirect('/admin');
  return ctx;
});

export function adminQuery<T>(ctx: AdminContext, fn: (client: PoolClient) => Promise<T>): Promise<T> {
  return withTenant(ctx.organizationId, fn);
}

/**
 * Server Action admina: sesija sa domena platforme, aktivan salon iz sesije,
 * dozvole ucitane iznova, izmena + audit u jednoj transakciji.
 */
export async function runAdminAction<T>(fn: (client: PoolClient, ctx: AdminContext) => Promise<T>): Promise<ActionResult<T>> {
  const session = await platformSession();
  if (!session) return { ok: false, error: 'Niste prijavljeni.' };
  if (!session.activeOrganizationId) return { ok: false, error: 'Izaberite salon.' };
  try {
    const data = await withTenant(session.activeOrganizationId, async (client) => {
      const ctx = await loadAdminContext(client, session);
      if (!ctx) throw new AdminError('Izaberite salon.');
      return fn(client, ctx);
    });
    return { ok: true, data };
  } catch (error) {
    if (error instanceof AdminError) return { ok: false, error: error.message };
    throw error;
  }
}
