/** Pozitivan bigint kao string (node-pg int8 vraca string). */
const ID = /^[1-9]\d{0,18}$/;

export function isId(value: unknown): value is string {
  return typeof value === 'string' && ID.test(value);
}

/** Stari naziv; ID-evi vise nisu UUID. */
export const isUuid = isId;
