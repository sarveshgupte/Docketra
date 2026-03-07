'use strict';

const { createCipheriv, createDecipheriv, createHash, randomBytes } = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const ENCRYPTED_PREFIX = 'enc::';

function resolveKeyMaterial() {
  const rawKey = process.env.SECURITY_ENCRYPTION_KEY || process.env.MASTER_ENCRYPTION_KEY;
  if (!rawKey) {
    throw new Error('SECURITY_ENCRYPTION_KEY must be configured before encrypting protected values');
  }

  return createHash('sha256').update(String(rawKey)).digest();
}

function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(ENCRYPTED_PREFIX);
}

function encrypt(value) {
  if (value === null || value === undefined || value === '') return value;
  if (isEncrypted(value)) return value;

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, resolveKeyMaterial(), iv, { authTagLength: AUTH_TAG_LENGTH });
  const ciphertext = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${ENCRYPTED_PREFIX}${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext.toString('base64')}`;
}

function decrypt(value) {
  if (value === null || value === undefined || value === '') return value;
  if (!isEncrypted(value)) return value;

  const encoded = value.slice(ENCRYPTED_PREFIX.length);
  const [ivRaw, authTagRaw, ciphertextRaw] = encoded.split(':');
  if (!ivRaw || !authTagRaw || !ciphertextRaw) {
    throw new Error('Encrypted value is malformed');
  }

  const decipher = createDecipheriv(
    ALGORITHM,
    resolveKeyMaterial(),
    Buffer.from(ivRaw, 'base64'),
    { authTagLength: AUTH_TAG_LENGTH }
  );
  decipher.setAuthTag(Buffer.from(authTagRaw, 'base64'));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextRaw, 'base64')),
    decipher.final(),
  ]);

  return plaintext.toString('utf8');
}

module.exports = {
  encrypt,
  decrypt,
  isEncrypted,
};
