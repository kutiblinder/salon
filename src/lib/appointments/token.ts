import { createHash, randomBytes } from 'node:crypto';

/** Token iz linka za otkazivanje (256 bita, base64url). */
export function newManageToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashManageToken(token) };
}

/** U bazi se cuva samo hash; token zna samo klijent (iz emaila). */
export function hashManageToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Odbacuje ocigledno neispravne tokene pre upita u bazu. */
export function isWellFormedToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}
