/**
 * Shared encryption utility helpers.
 *
 * Centralises the `looksEncrypted` heuristic so it can be reused across:
 *  - encryption.service.js   (plaintext compatibility fallback)
 *  - Case.model.js           (pre-save: skip already-encrypted values)
 *  - Client.model.js         (pre-save: skip already-encrypted values)
 *  - CaseRepository.js       (post-fetch: detect values that need decryption)
 *  - ClientRepository.js     (post-fetch: detect values that need decryption)
 */

/**
 * Heuristic check: does `value` look like an AES-256-GCM encrypted payload?
 *
 * Encrypted payloads are stored as three base64 segments separated by ':':
 *   <iv_b64>:<authTag_b64>:<ciphertext_b64>
 *
 * @param {*} value
 * @returns {boolean}
 */
function looksEncrypted(value) {
  if (typeof value !== 'string') return false;
  const parts = value.split(':');
  if (parts.length !== 3) return false;
  // Each segment must be non-empty and contain only base64 characters
  return parts.every(p => p.length > 0 && /^[A-Za-z0-9+/=]+$/.test(p));
}

module.exports = { looksEncrypted };
