/**
 * Generating a first password for a new account.
 *
 * Shown once to the administrator who created it, for them to pass on. The
 * alphabet deliberately omits characters that are misread when someone reads
 * a password aloud or copies it off a screen: O/0, l/1/I.
 */

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

export function generatePassword(
  length = 16,
  random?: (n: number) => Uint8Array,
): string {
  // Web Crypto rather than node:crypto: no import, and the same code path
  // whether this runs on the server or during a test.
  const bytes = random
    ? random(length)
    : globalThis.crypto.getRandomValues(new Uint8Array(length));

  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

/** Characters excluded because they are confused for one another. */
export const AMBIGUOUS = ["O", "0", "l", "1", "I"];
