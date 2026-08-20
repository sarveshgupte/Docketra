/**
 * Cryptographically secure random ID generation utilities for the frontend.
 * Centralizes browser crypto usage so callers do not need Math.random().
 */

let fallbackCounter = 0;

const getBrowserCrypto = () => {
  if (typeof globalThis !== 'undefined' && globalThis.crypto) {
    return globalThis.crypto;
  }

  return null;
};

const getFallbackId = (prefix = 'id') => {
  fallbackCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${fallbackCounter.toString(36)}`;
};

/**
 * Generates a cryptographically secure UUID v4 when browser crypto is available.
 * Falls back to a timestamp/counter ID only for non-browser or legacy runtimes.
 *
 * @returns {string} A UUID-compatible random ID where supported.
 */
export const generateUUID = () => {
  const browserCrypto = getBrowserCrypto();

  if (browserCrypto?.randomUUID) {
    return browserCrypto.randomUUID();
  }

  if (browserCrypto?.getRandomValues) {
    const buffer = new Uint8Array(16);
    browserCrypto.getRandomValues(buffer);
    buffer[6] = (buffer[6] & 0x0f) | 0x40;
    buffer[8] = (buffer[8] & 0x3f) | 0x80;
    const segments = [
      Array.from(buffer.slice(0, 4)),
      Array.from(buffer.slice(4, 6)),
      Array.from(buffer.slice(6, 8)),
      Array.from(buffer.slice(8, 10)),
      Array.from(buffer.slice(10)),
    ].map((segment) => segment.map((b) => b.toString(16).padStart(2, '0')).join(''));
    return segments.join('-');
  }

  return getFallbackId('uuid');
};

/**
 * Generates a cryptographically secure random alphanumeric string when browser
 * crypto is available. Falls back to a timestamp/counter string for non-browser
 * or legacy runtimes.
 *
 * @param {number} length - The desired length of the string.
 * @returns {string} Random string.
 */
export const generateSecureRandomString = (length = 8) => {
  const normalizedLength = Math.max(1, Number(length) || 8);
  const browserCrypto = getBrowserCrypto();

  if (browserCrypto?.getRandomValues) {
    const buffer = new Uint8Array(Math.ceil(normalizedLength / 2));
    browserCrypto.getRandomValues(buffer);
    return Array.from(buffer).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, normalizedLength);
  }

  return getFallbackId('random').replace(/[^a-z0-9]/gi, '').slice(0, normalizedLength);
};
