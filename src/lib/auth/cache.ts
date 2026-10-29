declare global {
  var __salonAuthHostsKey: string | undefined;
}

/** Posle izmene organization_domains: sledeći getAuth pravi novu instancu sa novim hostovima. */
export function invalidateAuthCache(): void {
  globalThis.__salonAuth = undefined;
  globalThis.__salonAuthHostsKey = undefined;
}
