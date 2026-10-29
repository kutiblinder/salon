import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getPool } from '../db';
import { isPlatformAdmin, loadActor } from './actor';
import type { Actor } from './permissions';
import { getCurrentSession, type CurrentSession } from './session';

/** Za stranice salona: prijavljen nalog ovog salona, inace na /prijava. */
export async function requireSalonSession(): Promise<CurrentSession & { realm: { kind: 'salon' } }> {
  const session = await getCurrentSession(await headers());
  if (!session) redirect('/prijava');
  if (session.realm.kind !== 'salon') redirect('/admin');
  return session as CurrentSession & { realm: { kind: 'salon' } };
}

/** Za /admin: prijavljen admin platforme, inace na /admin/prijava. */
export async function requirePlatformAdmin(): Promise<{ session: CurrentSession; actor: Actor }> {
  const session = await getCurrentSession(await headers());
  if (!session || session.realm.kind !== 'platform') redirect('/admin/prijava');
  const client = await getPool().connect();
  try {
    const actor = await loadActor(client, session);
    if (!isPlatformAdmin(actor)) redirect('/admin/prijava');
    return { session, actor };
  } finally {
    client.release();
  }
}
