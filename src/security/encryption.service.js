/**
 * EncryptionService — application-level façade over pluggable encryption providers.
 *
 * Responsibilities:
 *  1. Load the correct provider based on ENCRYPTION_PROVIDER env variable.
 *  2. Expose encrypt / decrypt / ensureTenantKey helpers.
 *  3. Enforce security guards:
 *     - superadmin cannot decrypt tenant data.
 *     - Missing tenant key fails fast (explicit bootstrap requirement).
 *     - Decryption failures are logged and return null (fail-soft).
 *
 * Provider selection:
 *   ENCRYPTION_PROVIDER=local  →  LocalEncryptionProvider  (default)
 *   ENCRYPTION_PROVIDER=kms    →  KmsEncryptionProvider    (stub)
 *
 * Usage in repositories (example):
 *   const { encrypt, decrypt, ensureTenantKey } = require('../security/encryption.service');
 *
 *   // Before save:
 *   doc.description = await encrypt(doc.description, firmId);
 *
 *   // After fetch:
 *   doc.description = await decrypt(doc.description, firmId);
 */

const LocalEncryptionProvider = require('./encryption.local.provider');
const KmsEncryptionProvider = require('./encryption.kms.provider');
const { looksEncrypted } = require('./encryption.utils');

/** Lazy-initialised singleton provider instance. */
let _provider = null;

/**
 * Return (and cache) the provider selected by ENCRYPTION_PROVIDER.
 *
 * @returns {import('./encryption.interface')}
 */
function getProvider() {
  if (_provider) return _provider;

  const name = (process.env.ENCRYPTION_PROVIDER || 'local').toLowerCase();
  if (name === 'kms') {
    _provider = new KmsEncryptionProvider();
  } else {
    _provider = new LocalEncryptionProvider();
  }
  return _provider;
}

/**
 * Custom error class for access-control rejections.
 */
class ForbiddenError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ForbiddenError';
    this.statusCode = 403;
  }
}

/**
 * Ensure the tenant has an encryption key, generating one if absent.
 *
 * @param {string} tenantId
 * @returns {Promise<void>}
 */
async function ensureTenantKey(tenantId, { session } = {}) {
  if (!tenantId) {
    throw new Error('tenantId is required for ensureTenantKey');
  }
  await getProvider().generateTenantKey(tenantId, { session });
}

/**
 * Encrypt a plaintext field value for the given tenant.
 *
 * @param {string} value    - Plaintext to encrypt
 * @param {string} tenantId - Tenant (firm) identifier
 * @param {{ session?: import('mongoose').ClientSession }} [options]
 * @returns {Promise<string>}
 */
async function encrypt(value, tenantId, { session } = {}) {
  if (value == null) return value;          // Preserve null / undefined
  if (!tenantId) {
    throw new Error('tenantId is required for encryption');
  }
  return getProvider().encrypt(String(value), tenantId, { session });
}

/**
 * Decrypt a ciphertext field value for the given tenant.
 *
 * Security guards:
 *  - Throws ForbiddenError if role === 'superadmin' or 'SUPER_ADMIN'.
 *  - Falls back to returning the original value if it does not match the
 *    encrypted payload format (temporary compatibility mode for existing
 *    plaintext records — see TODO below).
 *  - Logs and returns null for decryption failures (fail-soft).
 *
 * TODO: Write migration script to encrypt existing plaintext fields.
 *       Once all records are encrypted, remove the plaintext fallback below.
 *
 * @param {string} value    - Ciphertext (iv:authTag:ciphertext) or plaintext (legacy)
 * @param {string} tenantId - Tenant (firm) identifier
 * @param {string} [role]   - Caller's role (from req.user.role)
 * @param {{ session?: import('mongoose').ClientSession, logContext?: { field?: string, route?: string, model?: string } }} [options]
 * @returns {Promise<string|null|undefined>}
 */
async function decrypt(value, tenantId, role, { session, logContext } = {}) {
  if (value == null) return value;

  // Guard: superadmin must not access tenant-encrypted data.
  // Normalise role before comparison to handle both 'superadmin' and 'SUPER_ADMIN'.
  if (role) {
    const normalizedRole = role.toLowerCase().replace('_', '');
    if (normalizedRole === 'superadmin') {
      throw new ForbiddenError('Superadmin is not permitted to decrypt tenant data');
    }
  }

  try {
    if (!tenantId) {
      throw new Error('tenantId is required for decryption');
    }

    // Detect plaintext (legacy) records — they lack the iv:authTag:ciphertext format.
    // Return as-is to preserve backward compatibility until migration is complete.
    if (!looksEncrypted(value)) {
      return value;
    }

    return await getProvider().decrypt(value, tenantId, { session });
  } catch (err) {
    console.warn('TENANT_DECRYPTION_FAILED', {
      timestamp: new Date().toISOString(),
      tenantId,
      requestId: logContext?.requestId || null,
      field: logContext?.field || null,
      route: logContext?.route || null,
      model: logContext?.model || null,
      error: err.message,
    });
    return null;
  }
}

/**
 * Generate a new encrypted DEK without persisting it to the database.
 * Call this before a transaction to validate the encryption provider is
 * functional and to obtain the encryptedDek for atomic TenantKey creation
 * inside the transaction.
 *
 * Fails fast if MASTER_ENCRYPTION_KEY is missing (local provider) or the
 * provider is otherwise misconfigured.
 *
 * @returns {Promise<string>}  Encrypted DEK as iv:authTag:ciphertext (base64)
 */
async function generateEncryptedDek() {
  const providerName = (process.env.ENCRYPTION_PROVIDER || 'local').toLowerCase();
  if (providerName === 'local') {
    const masterKey = process.env.MASTER_ENCRYPTION_KEY || process.env.MASTER_KEY;
    if (!masterKey) {
      throw new Error('Master encryption key missing for local provider. Set MASTER_ENCRYPTION_KEY.');
    }
  }
  return getProvider().generateEncryptedDek();
}

module.exports = {
  encrypt,
  decrypt,
  ensureTenantKey,
  generateEncryptedDek,
  ForbiddenError,
  looksEncrypted,
  // Exposed for testing only
  _resetProvider: () => { _provider = null; },
};
