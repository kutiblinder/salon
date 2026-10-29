import { getPool } from '@/lib/db';
import { loginDeniedReason } from '@/lib/auth/access';
import { getAuth, refreshCustomAuthHosts } from '@/lib/auth/auth';
import { resolveRealmByHost, runInRealm } from '@/lib/auth/realm';

export const dynamic = 'force-dynamic';

/** Better Auth rute (/api/auth/sign-in/email, /sign-up/email, /sign-out, ...), u prostoru iz Host headera. */
async function handle(request: Request): Promise<Response> {
  const realm = await resolveRealmByHost(request.headers.get('host'));
  if (!realm) return Response.json({ error: 'tenant_not_found' }, { status: 404 });
  if (realm.kind === 'salon' && realm.tenant.status === 'inactive') {
    return Response.json({ error: 'site_unavailable', message: 'Sajt nije dostupan.' }, { status: 404 });
  }
  if (realm.kind === 'salon' && request.method === 'POST' && new URL(request.url).pathname.endsWith('/sign-in/email')) {
    const body = (await request.clone().json().catch(() => null)) as { email?: unknown } | null;
    if (typeof body?.email === 'string') {
      const client = await getPool().connect();
      try {
        const denied = await loginDeniedReason(client, { organizationId: realm.organizationId, email: body.email });
        if (denied) return Response.json({ message: denied, code: 'FORBIDDEN' }, { status: 403 });
      } finally {
        client.release();
      }
    }
  }
  await refreshCustomAuthHosts();
  return runInRealm(realm, () => getAuth().handler(request));
}

export const GET = handle;
export const POST = handle;
