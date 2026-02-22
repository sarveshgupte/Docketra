const Case = require('../models/Case.model');
const mongoose = require('mongoose');
const { softDelete } = require('../services/softDelete.service');
const { decrypt, ensureTenantKey, ForbiddenError } = require('../security/encryption.service');
const { looksEncrypted } = require('../security/encryption.utils');

/**
 * ⚠️ SECURITY: Case Repository - Firm-Scoped Data Access Layer ⚠️
 * 
 * This repository enforces firm isolation by design.
 * ALL case queries MUST include firmId to prevent cross-tenant data access.
 * 
 * MANDATORY RULES:
 * 1. firmId MUST be the first parameter of every method
 * 2. firmId MUST come from req.user.firmId, NEVER from request params/body
 * 3. Controllers MUST NOT query Case model directly
 * 4. All queries MUST include { firmId, ... } filter
 * 5. Internal lookups MUST use caseInternalId (NOT caseNumber or caseId)
 * 
 * PR: Case Identifier Semantics - Added internal ID methods and guardrails
 * 
 * This prevents IDOR (Insecure Direct Object Reference) attacks where:
 * - A user from Firm A guesses/enumerates caseId from Firm B
 * - Attempts to view, clone, update, or delete that case
 * 
 * Expected result: System behaves as if the case does not exist.
 */

// ── Encryption helpers ──────────────────────────────────────────────────────

/**
 * Case fields that contain encrypted data at rest.
 * Decryption is performed at the repository layer — never at the model or
 * controller layer — so that the superadmin block can be enforced before
 * any plaintext is handed back to the caller.
 */
const CASE_ENCRYPTED_FIELDS = ['description'];

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
 * Decrypt sensitive fields on a single Case document (in-place).
 * No-op when encryption is not configured or doc is null.
 *
 * @param {Object|null} doc
 * @param {string} firmId
 * @returns {Promise<Object|null>}
 */
async function _decryptCaseDoc(doc, firmId) {
  if (!doc || !process.env.MASTER_ENCRYPTION_KEY || !firmId) return doc;
  const tenantId = String(firmId);
  for (const field of CASE_ENCRYPTED_FIELDS) {
    if (doc[field] != null && looksEncrypted(doc[field])) {
      doc[field] = await decrypt(doc[field], tenantId);
    }
  }
  return doc;
}

/**
 * Decrypt sensitive fields on an array of Case documents (in-place).
 * No-op when encryption is not configured or array is empty.
 *
 * @param {Array} docs
 * @param {string} firmId
 * @returns {Promise<Array>}
 */
async function _decryptCaseDocs(docs, firmId) {
  if (!docs || !docs.length || !process.env.MASTER_ENCRYPTION_KEY || !firmId) return docs;
  const tenantId = String(firmId);
  await Promise.all(docs.map(async (doc) => {
    if (!doc) return;
    for (const field of CASE_ENCRYPTED_FIELDS) {
      if (doc[field] != null && looksEncrypted(doc[field])) {
        doc[field] = await decrypt(doc[field], tenantId);
      }
    }
  }));
  return docs;
}

// ── Query validation ────────────────────────────────────────────────────────

/**
 * Guardrail: Prevent misuse of display identifiers in queries
 * Throws error if caseNumber or caseId is used in query object
 *
 * @param {Object} query - Query object to validate
 * @throws {Error} If caseNumber or caseId is found in query
 */
const validateQuery = (query) => {
  if (query.caseNumber) {
    throw new Error('SECURITY: caseNumber must never be used for internal lookup. Use caseInternalId or findByCaseNumber with explicit conversion.');
  }

  // Allow caseId during transition period but log warning
  if (query.caseId && process.env.NODE_ENV !== 'production') {
    console.warn('[CaseRepository] WARNING: caseId usage detected. This is deprecated. Use caseInternalId for internal lookups.');
  }
};

const CaseRepository = {
  /**
   * Find case by internal ID (PREFERRED METHOD)
   * Uses opaque caseInternalId for secure, non-guessable lookups
   *
   * @param {string|ObjectId} firmId - Firm ID from req.user.firmId
   * @param {string|ObjectId} caseInternalId - Internal case identifier (ObjectId)
   * @param {string} [role] - Caller's role; superadmin triggers ForbiddenError
   * @returns {Promise<Object|null>} Case document or null
   */
  async findByInternalId(firmId, caseInternalId, role) {
    if (!firmId || !caseInternalId) {
      return null;
    }
    _guardSuperadmin(role);

    // Convert string to ObjectId if needed
    const internalId = mongoose.Types.ObjectId.isValid(caseInternalId)
      ? caseInternalId
      : null;

    if (!internalId) {
      return null;
    }

    const doc = await Case.findOne({ firmId, caseInternalId: internalId });
    return _decryptCaseDoc(doc, firmId);
  },

  /**
   * Find case by case number (DISPLAY ID - USE WITH CAUTION)
   * This method should only be used for:
   * - User-initiated searches by case number
   * - Backward compatibility during transition
   * - Converting display ID to internal ID
   *
   * NEVER use this for internal authorization or lookup logic
   *
   * @param {string|ObjectId} firmId - Firm ID from req.user.firmId
   * @param {string} caseNumber - Human-readable case number (CASE-YYYYMMDD-XXXXX)
   * @param {string} [role] - Caller's role; superadmin triggers ForbiddenError
   * @returns {Promise<Object|null>} Case document or null
   */
  async findByCaseNumber(firmId, caseNumber, role) {
    if (!firmId || !caseNumber) {
      return null;
    }
    _guardSuperadmin(role);
    const doc = await Case.findOne({ firmId, caseNumber });
    return _decryptCaseDoc(doc, firmId);
  },

  /**
   * Find case by caseId (DEPRECATED - BACKWARD COMPATIBILITY ONLY)
   * @param {string|ObjectId} firmId - Firm ID from req.user.firmId
   * @param {string} caseId - Case identifier (legacy field)
   * @param {string} [role] - Caller's role; superadmin triggers ForbiddenError
   * @returns {Promise<Object|null>} Case document or null
   * @deprecated Use findByInternalId or findByCaseNumber instead
   */
  async findByCaseId(firmId, caseId, role) {
    if (!firmId || !caseId) {
      return null;
    }
    _guardSuperadmin(role);
    // During transition, caseId = caseNumber
    const doc = await Case.findOne({ firmId, caseId });
    return _decryptCaseDoc(doc, firmId);
  },

  /**
   * Find case by MongoDB _id with firm scoping
   * @param {string|ObjectId} firmId - Firm ID from req.user.firmId
   * @param {string|ObjectId} _id - MongoDB document ID
   * @param {string} [role] - Caller's role; superadmin triggers ForbiddenError
   * @returns {Promise<Object|null>} Case document or null
   */
  async findById(firmId, _id, role) {
    if (!firmId || !_id) {
      return null;
    }
    _guardSuperadmin(role);
    const doc = await Case.findOne({ firmId, _id });
    return _decryptCaseDoc(doc, firmId);
  },

  /**
   * Find cases with query and firm scoping
   * @param {string|ObjectId} firmId - Firm ID from req.user.firmId
   * @param {Object} query - Additional query filters
   * @param {string} [role] - Caller's role; superadmin triggers ForbiddenError
   * @returns {Promise<Array>} Array of case documents
   */
  async find(firmId, query = {}, role) {
    if (!firmId) {
      return [];
    }
    _guardSuperadmin(role);

    // Validate query doesn't misuse display identifiers
    validateQuery(query);

    const docs = await Case.find({ firmId, ...query });
    return _decryptCaseDocs(docs, firmId);
  },

  /**
   * Find one case with query and firm scoping
   * @param {string|ObjectId} firmId - Firm ID from req.user.firmId
   * @param {Object} query - Additional query filters
   * @param {string} [role] - Caller's role; superadmin triggers ForbiddenError
   * @returns {Promise<Object|null>} Case document or null
   */
  async findOne(firmId, query = {}, role) {
    if (!firmId) {
      return null;
    }
    _guardSuperadmin(role);

    // Validate query doesn't misuse display identifiers
    validateQuery(query);

    const doc = await Case.findOne({ firmId, ...query });
    return _decryptCaseDoc(doc, firmId);
  },

  /**
   * Update case by internal ID (PREFERRED METHOD)
   * @param {string|ObjectId} firmId - Firm ID from req.user.firmId
   * @param {string|ObjectId} caseInternalId - Internal case identifier
   * @param {Object} update - Update object
   * @returns {Promise<Object|null>} Updated case document or null
   */
  updateByInternalId(firmId, caseInternalId, update) {
    if (!firmId || !caseInternalId) {
      return null;
    }
    
    const internalId = mongoose.Types.ObjectId.isValid(caseInternalId) 
      ? caseInternalId 
      : null;
    
    if (!internalId) {
      return null;
    }
    
    return Case.updateOne({ firmId, caseInternalId: internalId }, update);
  },

  /**
   * Update case by caseId (DEPRECATED - BACKWARD COMPATIBILITY ONLY)
   * @param {string|ObjectId} firmId - Firm ID from req.user.firmId
   * @param {string} caseId - Case identifier
   * @param {Object} update - Update object
   * @returns {Promise<Object|null>} Updated case document or null
   * @deprecated Use updateByInternalId instead
   */
  updateByCaseId(firmId, caseId, update) {
    if (!firmId || !caseId) {
      return null;
    }
    return Case.updateOne({ firmId, caseId }, update);
  },

  /**
   * Update case by MongoDB _id with firm scoping
   * @param {string|ObjectId} firmId - Firm ID from req.user.firmId
   * @param {string|ObjectId} _id - MongoDB document ID
   * @param {Object} update - Update object
   * @returns {Promise<Object|null>} Updated case document or null
   */
  updateById(firmId, _id, update) {
    if (!firmId || !_id) {
      return null;
    }
    return Case.updateOne({ firmId, _id }, update);
  },

  /**
   * Delete case by internal ID (PREFERRED METHOD)
   * NOTE: Soft deletes are preferred in production systems
   * @param {string|ObjectId} firmId - Firm ID from req.user.firmId
   * @param {string|ObjectId} caseInternalId - Internal case identifier
   * @returns {Promise<Object>} Delete result
   */
  deleteByInternalId(firmId, caseInternalId) {
    if (!firmId || !caseInternalId) {
      return Promise.resolve(null);
    }
    
    const internalId = mongoose.Types.ObjectId.isValid(caseInternalId) 
      ? caseInternalId 
      : null;
    
    if (!internalId) {
      return Promise.resolve(null);
    }
    
    return softDelete({
      model: Case,
      filter: { firmId, caseInternalId: internalId },
      reason: 'Repository deleteByInternalId',
    });
  },

  /**
   * Delete case by caseId (DEPRECATED - BACKWARD COMPATIBILITY ONLY)
   * NOTE: Soft deletes are preferred in production systems
   * @param {string|ObjectId} firmId - Firm ID from req.user.firmId
   * @param {string} caseId - Case identifier
   * @returns {Promise<Object>} Delete result
   * @deprecated Use deleteByInternalId instead
   */
  deleteByCaseId(firmId, caseId) {
    if (!firmId || !caseId) {
      return Promise.resolve(null);
    }
    return softDelete({
      model: Case,
      filter: { firmId, caseId },
      reason: 'Repository deleteByCaseId',
    });
  },

  /**
   * Count cases with query and firm scoping
   * @param {string|ObjectId} firmId - Firm ID from req.user.firmId
   * @param {Object} query - Additional query filters
   * @returns {Promise<number>} Count of cases
   */
  count(firmId, query = {}) {
    if (!firmId) {
      return Promise.resolve(0);
    }
    return Case.countDocuments({ firmId, ...query });
  },

  /**
   * Create a new case
   * NOTE: firmId MUST be included in caseData
   * Sensitive fields (description) are encrypted by the Case model pre-save hook.
   * The repository decrypts the returned document so callers receive plaintext.
   * Superadmin is blocked from creating (and receiving) tenant case data.
   * @param {Object} caseData - Case data including firmId
   * @param {string} [role] - Caller's role; superadmin triggers ForbiddenError
   * @returns {Promise<Object>} Created case document (decrypted)
   */
  async create(caseData, role) {
    if (!caseData.firmId) {
      throw new Error('firmId is required to create a case');
    }
    _guardSuperadmin(role);
    // Ensure the per-tenant DEK exists before the model pre-save hook needs it.
    await ensureTenantKey(String(caseData.firmId));
    const doc = await Case.create(caseData);
    // The pre-save hook encrypted sensitive fields; decrypt them for the caller.
    return _decryptCaseDoc(doc, caseData.firmId);
  },
};

module.exports = CaseRepository;
