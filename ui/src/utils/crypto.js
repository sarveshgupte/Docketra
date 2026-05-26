/**
 * Cryptographically secure random ID generation utilities for the frontend.
 * Replaces usage of Math.random() which can trigger SAST warnings.
 */

/**
 * Generates a cryptographically secure UUID v4.
 *
 * @returns {string} A standard UUID.
 */
export const generateUUID = () => {
  if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  // Fallback if randomUUID is not available but getRandomValues is
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    const buffer = new Uint8Array(16);
    window.crypto.getRandomValues(buffer);
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

  // No insecure fallback permitted
  throw new Error('Web Crypto API is not supported in this environment');
};

/**
 * Generates a cryptographically secure random alphanumeric string.
 *
 * @param {number} length - The desired length of the string.
 * @returns {string} Random string.
 */
export const generateSecureRandomString = (length = 8) => {
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    // Generate enough bytes to cover the requested length when hex-encoded
    const buffer = new Uint8Array(Math.ceil(length / 2));
    window.crypto.getRandomValues(buffer);
    return Array.from(buffer).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, length);
  }

  // No insecure fallback permitted
  throw new Error('Web Crypto API is not supported in this environment');
};
