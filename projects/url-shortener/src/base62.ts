/**
 * Base62 encoding for short codes.
 *
 * Encoding a counter rather than hashing the URL means codes are unique **by
 * construction** — there is no collision to detect, retry, or lose a race on.
 * The trade-off is that codes are sequential and therefore guessable, which is
 * why `createLink` offsets and why enumeration is called out in the README.
 */
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const BASE = ALPHABET.length;

export function encodeBase62(value: number): string {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError('encodeBase62 expects a non-negative integer');
  }

  if (value === 0) return ALPHABET[0] as string;

  let remaining = value;
  let out = '';

  while (remaining > 0) {
    out = ALPHABET[remaining % BASE] + out;
    remaining = Math.floor(remaining / BASE);
  }

  return out;
}

export function decodeBase62(code: string): number {
  if (code.length === 0) {
    throw new RangeError('decodeBase62 expects a non-empty string');
  }

  let out = 0;

  for (const char of code) {
    const digit = ALPHABET.indexOf(char);
    if (digit === -1) {
      throw new RangeError(`"${char}" is not a base62 character`);
    }
    out = out * BASE + digit;
  }

  return out;
}
