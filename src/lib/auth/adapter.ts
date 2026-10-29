import type { DBAdapter, DBAdapterInstance, DBTransactionAdapter, Where } from 'better-auth/adapters';
import { currentRealm, realmOrganizationId } from './realm';

/** Better Auth modeli koji pripadaju jednom prostoru (salon ili platforma). */
export const SCOPED_MODELS = new Set(['user', 'session', 'account']);
export const SCOPE_FIELD = 'organizationId';

/** Dodaje uslov "samo ovaj prostor". AND uslov vazi za ceo upit i kad postoje OR uslovi. */
export function scopeWhere(model: string, where: Where[] | undefined, organizationId: string | null): Where[] {
  if (!SCOPED_MODELS.has(model)) return where ?? [];
  const rest = (where ?? []).filter((w) => w.field !== SCOPE_FIELD);
  return [...rest, { field: SCOPE_FIELD, operator: 'eq', value: organizationId, connector: 'AND' }];
}

/** Upis uvek nosi prostor tekuceg zahteva, bez obzira na ulaz. */
export function scopeData<T extends Record<string, unknown>>(model: string, data: T, organizationId: string | null): T {
  return SCOPED_MODELS.has(model) ? { ...data, [SCOPE_FIELD]: organizationId } : data;
}

function wrap<A extends DBTransactionAdapter>(inner: A): A {
  const org = () => realmOrganizationId(currentRealm());
  return {
    ...inner,
    create: (args) => inner.create({ ...args, data: scopeData(args.model, args.data, org()) }),
    findOne: (args) => inner.findOne({ ...args, where: scopeWhere(args.model, args.where, org()) }),
    findMany: (args) => inner.findMany({ ...args, where: scopeWhere(args.model, args.where, org()) }),
    count: (args) => inner.count({ ...args, where: scopeWhere(args.model, args.where, org()) }),
    update: (args) =>
      inner.update({
        ...args,
        where: scopeWhere(args.model, args.where, org()),
        update: omitScope(args.model, args.update),
      }),
    updateMany: (args) =>
      inner.updateMany({
        ...args,
        where: scopeWhere(args.model, args.where, org()),
        update: omitScope(args.model, args.update),
      }),
    delete: (args) => inner.delete({ ...args, where: scopeWhere(args.model, args.where, org()) }),
    deleteMany: (args) => inner.deleteMany({ ...args, where: scopeWhere(args.model, args.where, org()) }),
    consumeOne: (args) => inner.consumeOne({ ...args, where: scopeWhere(args.model, args.where, org()) }),
    incrementOne: (args) => inner.incrementOne({ ...args, where: scopeWhere(args.model, args.where, org()) }),
  };
}

/** Prostor naloga se nikad ne menja izmenom. */
function omitScope(model: string, update: Record<string, unknown>): Record<string, unknown> {
  if (!SCOPED_MODELS.has(model) || !(SCOPE_FIELD in update)) return update;
  const { [SCOPE_FIELD]: _ignored, ...rest } = update;
  return rest;
}

/**
 * Omotac oko Better Auth adaptera: svaki upit nad nalozima, sesijama i lozinkama
 * filtrira se po prostoru iz Host headera (vidi realm.ts). Isti email u dva salona
 * su dva naloga, a sesija jednog salona ne vazi u drugom.
 */
export function realmScopedAdapter(inner: DBAdapterInstance): DBAdapterInstance {
  return (options) => {
    const base: DBAdapter = inner(options);
    return {
      ...base,
      ...wrap(base),
      transaction: (callback) => base.transaction((trx) => callback(wrap(trx))),
    };
  };
}
