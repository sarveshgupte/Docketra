/**
 * TokenEncryption Service
 *
 * AES-256-CBC symmetric encryption for OAuth tokens stored in the database.
 *
 * Security rules:
 *   - Encryption key is read from STORAGE_TOKEN_SECRET (required at startup)
 *   - Raw tokens are NEVER logged
 *   - Each encrypt call generates a fresh random IV
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
const KEY_LENGTH = 32; // bytes — AES-256
const IV_LENGTH = 16;  // bytes — AES CBC block size
const SEPARATOR = ':';

let _key = null;

/**
 * Lazily resolves and caches the encryption key.
 * Throws immediately if STORAGE_TOKEN_SECRET is missing.
 *
 * @returns {Buffer}
 */
function getKey() {
  if (_key) return _key;

  const secret = process.env.STORAGE_TOKEN_SECRET;
  if (!secret) {
    throw new Error(
      'STORAGE_TOKEN_SECRET is not set. ' +
      'Token encryption cannot proceed without an encryption key.'
    );
  }

  // Derive a fixed-length key with SHA-256 so any secret length works
  _key = crypto.createHash('sha256').update(secret).digest();
  if (_key.length !== KEY_LENGTH) {
    throw new Error('Derived encryption key has unexpected length');
  }
  return _key;
}

/**
 * Encrypt plain text using AES-256-CBC.
 *
 * @param {string} text
 * @returns {string}  "<hex-iv>:<hex-ciphertext>"
 */
function encrypt(text) {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return iv.toString('hex') + SEPARATOR + encrypted.toString('hex');
}

/**
 * Decrypt a value previously produced by encrypt().
 *
 * @param {string} encryptedText  "<hex-iv>:<hex-ciphertext>"
 * @returns {string}
 */
function decrypt(encryptedText) {
  if (typeof encryptedText !== 'string') {
    throw new Error('Invalid encrypted text: expected a string');
  }
  const key = getKey();
  const [ivHex, ciphertextHex] = encryptedText.split(SEPARATOR);
  if (!ivHex || !ciphertextHex) {
    throw new Error('Invalid encrypted text format');
  }
  // IV must be exactly IV_LENGTH bytes (hex = 2 chars per byte)
  if (ivHex.length !== IV_LENGTH * 2) {
    throw new Error('Invalid encrypted text: malformed IV');
  }
  const iv = Buffer.from(ivHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

module.exports = { encrypt, decrypt };
