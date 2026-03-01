const crypto = require('crypto');

/**
 * Generate a unique XID for public self-serve signup admin users.
 * Format: DX- + 8 uppercase alphanumeric characters
 * Example: DX-A3B7K9M2
 *
 * Uses crypto.randomBytes for cryptographic randomness.
 *
 * @returns {string} XID in format DX-XXXXXXXX
 */
const generateXid = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const charsLen = chars.length;
  let result = '';
  while (result.length < 8) {
    const byte = crypto.randomBytes(1)[0];
    // Rejection sampling: discard values that would cause modulo bias
    if (byte < Math.floor(256 / charsLen) * charsLen) {
      result += chars[byte % charsLen];
    }
  }
  return `DX-${result}`;
};

module.exports = { generateXid };
