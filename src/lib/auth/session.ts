import { APIError } from 'better-auth/api';
import { getPool } from '../db';
import { getAuth, refreshCustomAuthHosts } from './auth';
import { loginDeniedReason } from './access';
import { resolveRealmByHost, runInRealm, type Realm } from './realm';

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  /** null = nalog platforme */
  organizationId: string | null;
}

export interface CurrentSession {
  realm: Realm;
  user: CurrentUser;
  sessionId: string;
  /** Samo nalog platforme: salon u koji je admin usao */
  activeOrganizationId: string | null;
}

/**
 * Prijavljeni korisnik za zahtev (Server Component ili route handler).
 * Vraca null ako niko nije prijavljen ili sesija ne pripada prostoru ovog domena.
 */
export async function getCurrentSession(headers: Headers): Promise<CurrentSession | null> {
  const realm = await resolveRealmByHost(headers.get('host'));
  if (!realm) return null;
  await refreshCustomAuthHosts();
  try {
    const result = await runInRealm(realm, () => getAuth().api.getSession({ headers }));
    if (!result) return null;

    const { user, session } = result;
    const organizationId = (user.organizationId as string | null | undefined) ?? null;
    // Dodatna provera pored filtera u adapteru
    if (organizationId !== (realm.kind === 'salon' ? realm.organizationId : null)) return null;

    if (realm.kind === 'salon') {
      const client = await getPool().connect();
      try {
        const denied = await loginDeniedReason(client, {
          organizationId: realm.organizationId,
          userId: String(user.id),
        });
        if (denied) return null;
      } finally {
        client.release();
      }
    }

    return {
      realm,
      sessionId: session.id,
      activeOrganizationId: (session.activeOrganizationId as string | null | undefined) ?? null,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: (user.phone as string | null | undefined) ?? null,
        organizationId,
      },
    };
  } catch (error) {
    if (error instanceof APIError) return null;
    throw error;
  }
}
