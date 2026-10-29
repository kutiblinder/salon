import { isTlsIssuanceAllowed } from '@/lib/tls-ask';

export const dynamic = 'force-dynamic';

/**
 * Caddy on_demand TLS: GET /api/tls-ask?domain=frizer.rs
 * 200 = sme sertifikat, 404 = ne.
 */
export async function GET(request: Request) {
  const domain = new URL(request.url).searchParams.get('domain');
  if (await isTlsIssuanceAllowed(domain)) return new Response('ok');
  return new Response(null, { status: 404 });
}
