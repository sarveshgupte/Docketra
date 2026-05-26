/**
 * EncryptionService — application-level façade over pluggable encryption providers.
 *
 * Responsibilities:
 *  1. Load the correct provider based on ENCRYPTION_PROVIDER env variable.
 *  2. Expose encrypt / decrypt / ensureTenantKey helpers.
 *  3. Enforce security guards:
 *     - superadmin cannot decrypt tenant data.
 *     - Missing tenant key fails fast (explicit bootstrap requirement).
 *     - Decryption failures are logged with context and re-thrown.
 *
 * Provider selection:
 *   ENCRYPTION_PROVIDER=local    →  LocalEncryptionProvider  (default)
 *   ENCRYPTION_PROVIDER=disabled →  LocalEncryptionProvider (legacy no-op mode at call sites)
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
const TenantKey = require('./tenantKey.model');
const { looksEncrypted } = require('./encryption.utils');
const { resolveCanonicalTenantFromFirmId } = require('../services/tenantIdentity.service');
const log = require('../utils/log');

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
  if (name === 'local' || name === 'disabled') {
    _provider = new LocalEncryptionProvider();
  } else {
    if (name === 'kms') {
      throw new Error('ENCRYPTION_PROVIDER=kms is not available in this deployment. Use ENCRYPTION_PROVIDER=local until KMS is implemented.');
    }
    throw new Error(`Unsupported ENCRYPTION_PROVIDER "${name}". Supported providers: local, disabled`);
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


async function tenantKeyExists(tenantId, { session } = {}) {
  if (!tenantId) return false;
  const query = TenantKey.exists({ tenantId: String(tenantId) });
  if (session) query.session(session);
  const exists = await query;
  return Boolean(exists);
}

async function resolveTenantKeyCandidates(tenantId, { session } = {}) {
  const normalized = tenantId ? String(tenantId) : null;
  if (!normalized) return [];
  const candidates = [normalized];
  const context = await resolveCanonicalTenantFromFirmId(normalized, { session });
  const contextCandidates = [
    context?.tenantId,
    context?.ownershipFirmId,
    context?.legacyFirmId,
    context?.defaultClientId,
  ]
    .filter(Boolean)
    .map(String);
  for (const id of contextCandidates) {
    if (!candidates.includes(id)) candidates.push(id);
  }
  return candidates;
}

async function resolveTenantKeyTenantId(tenantId, { session, logContext } = {}) {
  const candidates = await resolveTenantKeyCandidates(tenantId, { session });
  log.info('CLIENT_ENCRYPTION_KEY_LOOKUP_ATTEMPTED', {
    ...(logContext || {}),
    lookupCandidateCount: candidates.length,
    lookupCandidatesSample: candidates.slice(0, 4),
  });
  for (const candidate of candidates) {
    if (await tenantKeyExists(candidate, { session })) {
      return candidate;
    }
  }
  log.warn('CLIENT_ENCRYPTION_KEY_LOOKUP_FAILED', {
    ...(logContext || {}),
    lookupCandidateCount: candidates.length,
    lookupCandidatesSample: candidates.slice(0, 4),
  });
  return null;
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
 *    plaintext records).
 *  - Logs and re-throws decryption failures (fail-fast at caller boundary).
 *
 * @param {string} value    - Ciphertext (iv:authTag:ciphertext) or plaintext (legacy)
 * @param {string} tenantId - Tenant (firm) identifier
 * @param {string} [role]   - Caller's role (from req.user.role)
 * @param {{ session?: import('mongoose').ClientSession, logContext?: { field?: string, route?: string, model?: string } }} [options]
 * @returns {Promise<string|null|undefined>}
 */
async function decrypt(value, tenantId, role, { session, logContext } = {}) {
  if (value == null) return value;

  if (role) {
    const normalizedRole = role.toLowerCase().replace('_', '');
    if (normalizedRole === 'superadmin') {
      throw new ForbiddenError('Superadmin is not permitted to decrypt tenant data');
    }
  }

  if (!looksEncrypted(value)) {
    return value;
  }

  if (!tenantId) {
    const err = new Error('[EncryptionService] tenantId is required for decryption');
    log.error('DECRYPTION_TENANT_ID_MISSING', {
      error: err.message,
      logContext,
    });
    throw err;
  }

  try {
    const plaintext = await getProvider().decrypt(String(value), tenantId, { session });

    if (plaintext == null) {
      log.warn('[EncryptionService] DECRYPTION_RETURNED_NULL', {
        tenantId,
        valueLength: String(value).length,
          logContext,
      });
      throw new Error('Decryption returned null - possible corrupt encrypted value');
    }

    return plaintext;
  } catch (err) {
    log.error('[EncryptionService] DECRYPTION_ERROR', {
      tenantId,
      requestId: logContext?.requestId || null,
      field: logContext?.field || null,
      route: logContext?.route || null,
      model: logContext?.model || null,
      errorMessage: err.message,
      errorName: err.name,
      valueLength: String(value).length,
      logContext,
      errorStack: err.stack,
    });

    throw new Error(`Decryption failed${logContext?.field ? ` for ${logContext.field}` : ''}: ${err.message}`);
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
    const masterKey = process.env.MASTER_ENCRYPTION_KEY;
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
  tenantKeyExists,
  resolveTenantKeyCandidates,
  resolveTenantKeyTenantId,
  generateEncryptedDek,
  ForbiddenError,
  looksEncrypted,
  // Exposed for testing only
  _resetProvider: () => { _provider = null; },
};
