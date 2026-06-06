/**
 * TokenEncryption Service
 *
 * Versioned authenticated encryption for OAuth tokens stored in the database.
 *
 * Security rules:
 *   - Encryption key is read from STORAGE_TOKEN_SECRET (required at startup)
 *   - Raw tokens are NEVER logged
 *   - Each encrypt call generates a fresh random IV
 *   - New values use AES-256-GCM with an auth tag
 *   - Legacy AES-256-CBC values remain readable during migration
 */

const crypto = require('crypto');

const LEGACY_ALGORITHM = 'aes-256-cbc';
const AUTHENTICATED_ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // bytes - AES-256
const LEGACY_IV_LENGTH = 16; // bytes - AES CBC block size
const GCM_IV_LENGTH = 12;
const GCM_AUTH_TAG_LENGTH = 16;
const SEPARATOR = ':';
const ENCRYPTED_PREFIX = 'storage-token';
const ENCRYPTED_VERSION = 'v2';

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
 * Encrypt plain text using AES-256-GCM.
 *
 * @param {string} text
 * @returns {string}  "storage-token:v2:<base64url-iv>:<base64url-auth-tag>:<base64url-ciphertext>"
 */
function encrypt(text) {
  const key = getKey();
  const iv = crypto.randomBytes(GCM_IV_LENGTH);
  const cipher = crypto.createCipheriv(AUTHENTICATED_ALGORITHM, key, iv, { authTagLength: GCM_AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [
    ENCRYPTED_PREFIX,
    ENCRYPTED_VERSION,
    iv.toString('base64url'),
    authTag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join(SEPARATOR);
}

/**
 * Decrypt a value previously produced by encrypt(), or a legacy CBC blob.
 *
 * @param {string} encryptedText
 * @returns {string}
 */
function decrypt(encryptedText) {
  if (typeof encryptedText !== 'string') {
    throw new Error('Invalid encrypted text: expected a string');
  }

  if (encryptedText.startsWith(`${ENCRYPTED_PREFIX}${SEPARATOR}`)) {
    return decryptAuthenticated(encryptedText);
  }

  return decryptLegacy(encryptedText);
}

function decryptAuthenticated(encryptedText) {
  const key = getKey();
  const parts = encryptedText.split(SEPARATOR);
  if (parts.length !== 5) {
    throw new Error('Invalid encrypted text format');
  }
  const [prefix, version, ivRaw, authTagRaw, ciphertextRaw] = parts;
  if (prefix !== ENCRYPTED_PREFIX || version !== ENCRYPTED_VERSION || !ivRaw || !authTagRaw || !ciphertextRaw) {
    throw new Error('Invalid encrypted text format');
  }
  if (![ivRaw, authTagRaw, ciphertextRaw].every((part) => /^[A-Za-z0-9_-]+$/.test(part))) {
    throw new Error('Invalid encrypted text: malformed authenticated payload');
  }

  const iv = Buffer.from(ivRaw, 'base64url');
  const authTag = Buffer.from(authTagRaw, 'base64url');
  const ciphertext = Buffer.from(ciphertextRaw, 'base64url');
  if (iv.length !== GCM_IV_LENGTH || authTag.length !== GCM_AUTH_TAG_LENGTH || ciphertext.length === 0) {
    throw new Error('Invalid encrypted text: malformed authenticated payload');
  }

  const decipher = crypto.createDecipheriv(AUTHENTICATED_ALGORITHM, key, iv, { authTagLength: GCM_AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

function decryptLegacy(encryptedText) {
  const key = getKey();
  const [ivHex, ciphertextHex, extra] = encryptedText.split(SEPARATOR);
  if (!ivHex || !ciphertextHex) {
    throw new Error('Invalid encrypted text format');
  }
  if (extra !== undefined) {
    throw new Error('Invalid encrypted text format');
  }
  // IV must be exactly LEGACY_IV_LENGTH bytes (hex = 2 chars per byte)
  if (ivHex.length !== LEGACY_IV_LENGTH * 2 || !/^[0-9a-f]+$/i.test(ivHex)) {
    throw new Error('Invalid encrypted text: malformed IV');
  }
  if (ciphertextHex.length === 0 || ciphertextHex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(ciphertextHex)) {
    throw new Error('Invalid encrypted text: malformed ciphertext');
  }
  const iv = Buffer.from(ivHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');
  const decipher = crypto.createDecipheriv(LEGACY_ALGORITHM, key, iv);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

module.exports = { encrypt, decrypt };
