const SLUG_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
const RESERVED_SLUGS = new Set([
  'www',
  'admin',
  'api',
  'app',
  'mail',
  'ftp',
  'static',
  'assets',
  'panel',
  'prijava',
  'localhost',
]);

export function parseSlug(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const slug = raw.trim().toLowerCase();
  if (slug.length < 2 || slug.length > 50) return null;
  if (!SLUG_RE.test(slug)) return null;
  if (RESERVED_SLUGS.has(slug)) return null;
  return slug;
}

/** Predlog sluga iz naziva (latinica, đ→dj). Prazan string ako ne može. */
export function slugFromName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/đ/g, 'dj')
    .replace(/[čć]/g, 'c')
    .replace(/š/g, 's')
    .replace(/ž/g, 'z')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/g, '');
  return parseSlug(slug) ?? '';
}

export function parseLocationName(raw: unknown, fallback: string): string | null {
  if (raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '')) {
    return fallback;
  }
  if (typeof raw !== 'string') return null;
  const name = raw.trim().replace(/\s+/g, ' ');
  return name.length >= 2 && name.length <= 80 ? name : null;
}
