const HEX6 = /^#([0-9a-f]{6})$/i;
const HEX3 = /^#([0-9a-f]{3})$/i;

/** '#abc' / '#aabbcc' -> '#aabbcc', inace null. */
export function parseHexColor(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  const six = HEX6.exec(value);
  if (six) return `#${six[1].toLowerCase()}`;
  const three = HEX3.exec(value);
  if (!three) return null;
  const [r, g, b] = three[1].toLowerCase();
  return `#${r}${r}${g}${g}${b}${b}`;
}

function channel(n: number): number {
  const s = n / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = channel((n >> 16) & 255);
  const g = channel((n >> 8) & 255);
  const b = channel(n & 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(l1: number, l2: number): number {
  const [a, b] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (a + 0.05) / (b + 0.05);
}

/** Boja teksta na primarnoj: bela ili crna, koja ima veci kontrast. */
export function textOnPrimary(hex: string): 'white' | 'black' {
  const l = luminance(hex);
  return contrast(1, l) >= contrast(l, 0) ? 'white' : 'black';
}

/** WCAG kontrast belog teksta na datoj boji. */
export function whiteTextContrast(hex: string): number {
  return contrast(1, luminance(hex));
}
