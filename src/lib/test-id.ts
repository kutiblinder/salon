import { randomInt } from 'node:crypto';

/** Jedinstven id za db testove (deljena baza, bez sudara sa seedom 1–20). */
export function testId(): string {
  return String(randomInt(1_000_000_000, 2_000_000_000));
}
