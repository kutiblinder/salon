import { AsyncLocalStorage } from 'node:async_hooks';
import { resolveTenantByHost, type Tenant } from '../tenant';
import { tenantKeyFromHost } from '../tenant-key';

/**
 * Prostor naloga: domen platforme (samo vlasnik projekta) ili domen jednog salona
 * (klijenti, zaposleni, vlasnik salona). Nalog iz jednog prostora ne postoji u drugom.
 */
export type Realm = { kind: 'platform' } | { kind: 'salon'; organizationId: string; tenant: Tenant };

declare global {
  // Next pakuje stranice i API rute odvojeno; instanca Better Auth-a je globalna, pa mora i ovo
  var __salonAuthRealm: AsyncLocalStorage<Realm> | undefined;
}
const store = (globalThis.__salonAuthRealm ??= new AsyncLocalStorage<Realm>());

export function runInRealm<T>(realm: Realm, fn: () => T): T {
  return store.run(realm, fn);
}

/** Prostor tekuceg zahteva. Baca gresku ako nije postavljen: bez prostora nema upita nad nalozima. */
export function currentRealm(): Realm {
  const realm = store.getStore();
  if (!realm) throw new Error('Auth realm is not set (call runInRealm)');
  return realm;
}

/** organization_id koji nose nalozi ovog prostora (null = platforma). */
export function realmOrganizationId(realm: Realm): string | null {
  return realm.kind === 'salon' ? realm.organizationId : null;
}

/** Prostor iz Host headera; null za nepoznat salon. */
export async function resolveRealmByHost(host: string | null | undefined): Promise<Realm | null> {
  const key = tenantKeyFromHost(host, process.env.BASE_DOMAIN ?? 'localhost');
  if (!key) return null;
  if (key.kind === 'platform') return { kind: 'platform' };
  const tenant = await resolveTenantByHost(host);
  return tenant ? { kind: 'salon', organizationId: tenant.id, tenant } : null;
}
