import { headers } from 'next/headers';
import { resolveTenantByHost } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const host = (await headers()).get('host');
  const tenant = await resolveTenantByHost(host);

  if (!tenant) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <h1 className="text-3xl font-semibold">Salon platforma</h1>
        <p className="mt-4 text-neutral-600">
          Nijedan salon nije izabran za ovaj domen. Za razvoj otvori <code>http://demo.localhost:3000</code> (posle{' '}
          <code>npm run db:seed</code>).
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-3xl font-semibold">{tenant.name}</h1>
      <p className="mt-4 text-neutral-600">
        Ovde dolazi javni sajt salona (početna, o nama, cenovnik, kontakt, zakazivanje). Salon:{' '}
        <code>{tenant.slug}</code>, status: <code>{tenant.status}</code>.
      </p>
    </main>
  );
}
