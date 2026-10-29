import { getAuth } from '@/lib/auth/auth';
import { resolveRealmByHost, runInRealm } from '@/lib/auth/realm';

export const dynamic = 'force-dynamic';

/** Better Auth rute (/api/auth/sign-in/email, /sign-up/email, /sign-out, ...), u prostoru iz Host headera. */
async function handle(request: Request): Promise<Response> {
  const realm = await resolveRealmByHost(request.headers.get('host'));
  if (!realm) return Response.json({ error: 'tenant_not_found' }, { status: 404 });
  return runInRealm(realm, () => getAuth().handler(request));
}

export const GET = handle;
export const POST = handle;
