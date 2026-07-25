// Hermes/React Native n'a pas de atob/btoa ni de Buffer par défaut : petites
// implémentations manuelles, suffisantes pour les identifiants/jetons ASCII
// manipulés par le pipeline PoToken.
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function base64Encode(bytes: number[]): string {
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    result += ALPHABET[b0 >> 2];
    result += ALPHABET[((b0 & 0x03) << 4) | (b1 === undefined ? 0 : b1 >> 4)];
    result += b1 === undefined ? '=' : ALPHABET[((b1 & 0x0f) << 2) | (b2 === undefined ? 0 : b2 >> 6)];
    result += b2 === undefined ? '=' : ALPHABET[b2 & 0x3f];
  }
  return result;
}

export function base64Decode(input: string): number[] {
  const clean = input.replace(/=+$/, '');
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of clean) {
    const value = ALPHABET.indexOf(char);
    if (value === -1) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
      buffer &= (1 << bits) - 1;
    }
  }
  return bytes;
}

/** Convertit une chaîne base64 "façon YouTube" (variante URL-safe, point comme padding) en octets. */
export function youtubeBase64ToBytes(input: string): number[] {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/').replace(/\./g, '=');
  return base64Decode(normalized);
}

/** Encode en base64 URL-safe (comme les poTokens YouTube : +/ remplacés, padding conservé). */
export function bytesToUrlSafeBase64(bytes: number[]): string {
  return base64Encode(bytes).replace(/\+/g, '-').replace(/\//g, '_');
}

export function asciiStringToBytes(s: string): number[] {
  return Array.from(s).map((c) => c.charCodeAt(0));
}
