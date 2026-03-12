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

function resolveDecryptFields(decryptFields) {
  if (!Array.isArray(decryptFields) || !decryptFields.length) {
    return CLIENT_ENCRYPTED_FIELDS;
  }
  const allowed = new Set(CLIENT_ENCRYPTED_FIELDS);
  return decryptFields.filter((field) => allowed.has(field));
}


function normalizeClientDisplay(client) {
  if (!client) return client;

  const normalizeValue = (value) => {
    if (!value || value === '') return 'Not Available';
    return value;
  };

  client.businessEmail = normalizeValue(client.businessEmail);
  client.primaryContactNumber = normalizeValue(client.primaryContactNumber);

  return client;
}

/**
 * Enforce role presence and block superadmin from accessing tenant data.
 * Superadmin must never receive decrypted tenant data, regardless of
 * whether encryption is currently configured.
 *
 * @param {string|undefined} role
 * @throws {Error} If role is not provided
 * @throws {ForbiddenError} If the caller is a superadmin
 */
function _guardSuperadmin(role) {
  if (!role) {
    throw new Error('SECURITY: role is required for repository access');
  }
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
async function _decryptClientDoc(doc, firmId, { logContext, decryptFields } = {}) {
  if (!doc || !process.env.MASTER_ENCRYPTION_KEY) return doc;
  const tenantId = doc.firmId || firmId;
  if (!tenantId) return doc;

  const fieldsToDecrypt = resolveDecryptFields(decryptFields);
  for (const field of fieldsToDecrypt) {
    if (doc[field] != null && looksEncrypted(doc[field])) {
      const decrypted = await decrypt(doc[field], String(tenantId), undefined, {
        logContext: {
          ...logContext,
          field,
          model: 'Client',
        },
      });
      doc[field] = decrypted == null ? doc[field] : decrypted;
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
async function _decryptClientDocs(docs, firmId, { logContext, decryptFields } = {}) {
  if (!docs || !docs.length || !process.env.MASTER_ENCRYPTION_KEY) return docs;

  const fieldsToDecrypt = resolveDecryptFields(decryptFields);
  await Promise.all(docs.map(async (doc) => {
    if (!doc) return;
    const tenantId = doc.firmId || firmId;
    if (!tenantId) return;

    for (const field of fieldsToDecrypt) {
      if (doc[field] != null && looksEncrypted(doc[field])) {
        const decrypted = await decrypt(doc[field], String(tenantId), undefined, {
          logContext: {
            ...logContext,
            field,
            model: 'Client',
          },
        });
        doc[field] = decrypted == null ? doc[field] : decrypted;
      }
    }
  }));
  return docs;
}

const assertTenantId = (firmId) => {
  if (!firmId) {
    throw new Error('TenantId required');
  }
};

const applyQueryOptions = (query, options = {}) => {
  if (options.select) query.select(options.select);
  if (options.sort) query.sort(options.sort);
  if (options.limit !== undefined) query.limit(options.limit);
  if (options.skip !== undefined) query.skip(options.skip);
  if (options.populate) query.populate(options.populate);
  if (options.lean) query.lean();
  return query;
};

// ── Repository ──────────────────────────────────────────────────────────────

const ClientRepository = {
  /**
   * Find client by clientId with firm scoping
   * @param {string|ObjectId} firmId - Firm ID from req.user.firmId
   * @param {string} clientId - Client identifier (C000001, etc.)
   * @param {string} role - Caller's role (required); superadmin triggers ForbiddenError
   * @returns {Promise<Object|null>} Client document or null
   */
  async findByClientId(firmId, clientId, role, options = {}) {
    assertTenantId(firmId);
    if (!clientId) {
      return null;
    }
    _guardSuperadmin(role);
    const doc = await applyQueryOptions(Client.findOne({ firmId, clientId }), options);
    await _decryptClientDoc(doc, firmId, options);
    return normalizeClientDisplay(doc);
  },

  /**
   * Find client by MongoDB _id with firm scoping
   * @param {string|ObjectId} firmId - Firm ID from req.user.firmId
   * @param {string|ObjectId} _id - MongoDB document ID
   * @param {string} role - Caller's role (required); superadmin triggers ForbiddenError
   * @returns {Promise<Object|null>} Client document or null
   */
  async findById(firmId, _id, role, options = {}) {
    assertTenantId(firmId);
    if (!_id) {
      return null;
    }
    _guardSuperadmin(role);
    const doc = await applyQueryOptions(Client.findOne({ firmId, _id }), options);
    await _decryptClientDoc(doc, firmId, options);
    return normalizeClientDisplay(doc);
  },

  /**
   * Find clients with query and firm scoping
   * @param {string|ObjectId} firmId - Firm ID from req.user.firmId
   * @param {Object} query - Additional query filters
   * @param {string} role - Caller's role (required); superadmin triggers ForbiddenError
   * @returns {Promise<Array>} Array of client documents
   */
  async find(firmId, query = {}, role, options = {}) {
    assertTenantId(firmId);
    _guardSuperadmin(role);
    const docs = await applyQueryOptions(Client.find({ firmId, ...query }), options);
    await _decryptClientDocs(docs, firmId, options);
    return Array.isArray(docs) ? docs.map(normalizeClientDisplay) : docs;
  },

  /**
   * Find one client with query and firm scoping
   * @param {string|ObjectId} firmId - Firm ID from req.user.firmId
   * @param {Object} query - Additional query filters
   * @param {string} role - Caller's role (required); superadmin triggers ForbiddenError
   * @returns {Promise<Object|null>} Client document or null
   */
  async findOne(firmId, query = {}, role, options = {}) {
    assertTenantId(firmId);
    _guardSuperadmin(role);
    const doc = await applyQueryOptions(Client.findOne({ firmId, ...query }), options);
    await _decryptClientDoc(doc, firmId, options);
    return normalizeClientDisplay(doc);
  },

  /**
   * Update client by clientId with firm scoping
   * @param {string|ObjectId} firmId - Firm ID from req.user.firmId
   * @param {string} clientId - Client identifier
   * @param {Object} update - Update object
   * @returns {Promise<Object|null>} Updated client document or null
   */
  updateByClientId(firmId, clientId, update) {
    assertTenantId(firmId);
    if (!clientId) {
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
    assertTenantId(firmId);
    if (!_id) {
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
    assertTenantId(firmId);
    return Client.countDocuments({ firmId, ...query });
  },

  countClients(firmId, query = {}) {
    return this.count(firmId, query);
  },

  /**
   * Create a new client
   * NOTE: firmId MUST be included in clientData
   * Sensitive fields (primaryContactNumber, businessEmail) are encrypted by
   * the Client model pre-save hook.  The repository decrypts the returned
   * document so callers receive plaintext.
   * Superadmin is blocked from creating (and receiving) tenant client data.
   * @param {Object} clientData - Client data including firmId
   * @param {string} role - Caller's role (required); superadmin triggers ForbiddenError
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
    await _decryptClientDoc(doc, clientData.firmId);
    return normalizeClientDisplay(doc);
  },
};

Object.freeze(ClientRepository);

module.exports = ClientRepository;
