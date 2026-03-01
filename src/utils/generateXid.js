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
  const bytes = crypto.randomBytes(8);
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return `DX-${result}`;
};

module.exports = { generateXid };
