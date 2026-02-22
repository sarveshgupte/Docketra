const Client = require('../models/Client.model');
const { decrypt, ensureTenantKey, ForbiddenError } = require('../security/encryption.service');
const { looksEncrypted } = require('../security/encryption.utils');

/**
 * ⚠️ SECURITY: Client Repository - Firm-Scoped Data Access Layer ⚠️
 *
 * This repository enforces firm isolation by design.
 * ALL client queries MUST include firmId to prevent cross-tenant data access.
 *
 * MANDATORY RULES:
 * 1. firmId MUST be the first parameter of every method
 * 2. firmId MUST come from req.user.firmId, NEVER from request params/body
 * 3. Controllers MUST NOT query Client model directly
 * 4. All queries MUST include { firmId, ... } filter
 *
 * This prevents IDOR (Insecure Direct Object Reference) attacks where:
 * - A user from Firm A guesses/enumerates clientId from Firm B
 * - Attempts to view, update, or access that client
 *
 * Expected result: System behaves as if the client does not exist.
 */

// ── Encryption helpers ──────────────────────────────────────────────────────

/**
 * Client fields that contain encrypted data at rest.
 * Decryption is performed at the repository layer — never at the model or
 * controller layer — so that the superadmin block can be enforced before
 * any plaintext is handed back to the caller.
 */
const CLIENT_ENCRYPTED_FIELDS = ['primaryContactNumber', 'businessEmail'];

/**
 * Throw ForbiddenError when the caller is a superadmin AND encryption is active.
 * Superadmin must never receive decrypted tenant data.
 *
 * Guard is a no-op when MASTER_ENCRYPTION_KEY is not configured (encryption off).
 *
 * @param {string|undefined} role
 * @throws {ForbiddenError}
 */
function _guardSuperadmin(role) {
  if (!role || !process.env.MASTER_ENCRYPTION_KEY) return;
  const normalizedRole = role.toLowerCase().replace('_', '');
  if (normalizedRole === 'superadmin') {
    throw new ForbiddenError('Superadmin cannot access decrypted tenant data');
  }
}

/**
 * Decrypt sensitive fields on a single Client document (in-place).
 * No-op when encryption is not configured or doc is null.
 *
 * @param {Object|null} doc
 * @param {string} firmId
 * @returns {Promise<Object|null>}
 */
async function _decryptClientDoc(doc, firmId) {
  if (!doc || !process.env.MASTER_ENCRYPTION_KEY || !firmId) return doc;
  const tenantId = String(firmId);
  for (const field of CLIENT_ENCRYPTED_FIELDS) {
    if (doc[field] != null && looksEncrypted(doc[field])) {
      doc[field] = await decrypt(doc[field], tenantId);
    }
  }
  return doc;
}

/**
 * Decrypt sensitive fields on an array of Client documents (in-place).
 * No-op when encryption is not configured or array is empty.
 *
 * @param {Array} docs
 * @param {string} firmId
 * @returns {Promise<Array>}
 */
async function _decryptClientDocs(docs, firmId) {
  if (!docs || !docs.length || !process.env.MASTER_ENCRYPTION_KEY || !firmId) return docs;
  const tenantId = String(firmId);
  await Promise.all(docs.map(async (doc) => {
    if (!doc) return;
    for (const field of CLIENT_ENCRYPTED_FIELDS) {
      if (doc[field] != null && looksEncrypted(doc[field])) {
        doc[field] = await decrypt(doc[field], tenantId);
      }
    }
  }));
  return docs;
}

// ── Repository ──────────────────────────────────────────────────────────────

const ClientRepository = {
  /**
   * Find client by clientId with firm scoping
   * @param {string|ObjectId} firmId - Firm ID from req.user.firmId
   * @param {string} clientId - Client identifier (C000001, etc.)
   * @param {string} [role] - Caller's role; superadmin triggers ForbiddenError
   * @returns {Promise<Object|null>} Client document or null
   */
  async findByClientId(firmId, clientId, role) {
    if (!firmId || !clientId) {
      return null;
    }
    _guardSuperadmin(role);
    const doc = await Client.findOne({ firmId, clientId });
    return _decryptClientDoc(doc, firmId);
  },

  /**
   * Find client by MongoDB _id with firm scoping
   * @param {string|ObjectId} firmId - Firm ID from req.user.firmId
   * @param {string|ObjectId} _id - MongoDB document ID
   * @param {string} [role] - Caller's role; superadmin triggers ForbiddenError
   * @returns {Promise<Object|null>} Client document or null
   */
  async findById(firmId, _id, role) {
    if (!firmId || !_id) {
      return null;
    }
    _guardSuperadmin(role);
    const doc = await Client.findOne({ firmId, _id });
    return _decryptClientDoc(doc, firmId);
  },

  /**
   * Find clients with query and firm scoping
   * @param {string|ObjectId} firmId - Firm ID from req.user.firmId
   * @param {Object} query - Additional query filters
   * @param {string} [role] - Caller's role; superadmin triggers ForbiddenError
   * @returns {Promise<Array>} Array of client documents
   */
  async find(firmId, query = {}, role) {
    if (!firmId) {
      return [];
    }
    _guardSuperadmin(role);
    const docs = await Client.find({ firmId, ...query });
    return _decryptClientDocs(docs, firmId);
  },

  /**
   * Find one client with query and firm scoping
   * @param {string|ObjectId} firmId - Firm ID from req.user.firmId
   * @param {Object} query - Additional query filters
   * @param {string} [role] - Caller's role; superadmin triggers ForbiddenError
   * @returns {Promise<Object|null>} Client document or null
   */
  async findOne(firmId, query = {}, role) {
    if (!firmId) {
      return null;
    }
    _guardSuperadmin(role);
    const doc = await Client.findOne({ firmId, ...query });
    return _decryptClientDoc(doc, firmId);
  },

  /**
   * Update client by clientId with firm scoping
   * @param {string|ObjectId} firmId - Firm ID from req.user.firmId
   * @param {string} clientId - Client identifier
   * @param {Object} update - Update object
   * @returns {Promise<Object|null>} Updated client document or null
   */
  updateByClientId(firmId, clientId, update) {
    if (!firmId || !clientId) {
      return null;
    }
    return Client.updateOne({ firmId, clientId }, update);
  },

  /**
   * Update client by MongoDB _id with firm scoping
   * @param {string|ObjectId} firmId - Firm ID from req.user.firmId
   * @param {string|ObjectId} _id - MongoDB document ID
   * @param {Object} update - Update object
   * @returns {Promise<Object|null>} Updated client document or null
   */
  updateById(firmId, _id, update) {
    if (!firmId || !_id) {
      return null;
    }
    return Client.updateOne({ firmId, _id }, update);
  },

  /**
   * Count clients with query and firm scoping
   * @param {string|ObjectId} firmId - Firm ID from req.user.firmId
   * @param {Object} query - Additional query filters
   * @returns {Promise<number>} Count of clients
   */
  count(firmId, query = {}) {
    if (!firmId) {
      return Promise.resolve(0);
    }
    return Client.countDocuments({ firmId, ...query });
  },

  /**
   * Create a new client
   * NOTE: firmId MUST be included in clientData
   * Sensitive fields (primaryContactNumber, businessEmail) are encrypted by
   * the Client model pre-save hook.  The repository decrypts the returned
   * document so callers receive plaintext.
   * Superadmin is blocked from creating (and receiving) tenant client data.
   * @param {Object} clientData - Client data including firmId
   * @param {string} [role] - Caller's role; superadmin triggers ForbiddenError
   * @returns {Promise<Object>} Created client document (decrypted)
   */
  async create(clientData, role) {
    if (!clientData.firmId) {
      throw new Error('firmId is required to create a client');
    }
    _guardSuperadmin(role);
    // Ensure the per-tenant DEK exists before the model pre-save hook needs it.
    await ensureTenantKey(String(clientData.firmId));
    const doc = await Client.create(clientData);
    // The pre-save hook encrypted sensitive fields; decrypt them for the caller.
    return _decryptClientDoc(doc, clientData.firmId);
  },
};

module.exports = ClientRepository;
