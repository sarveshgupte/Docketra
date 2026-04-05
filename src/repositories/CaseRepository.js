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
 * Decrypt sensitive fields on a single Case document (in-place).
 * No-op when encryption is not configured or doc is null.
 *
 * @param {Object|null} doc
 * @param {string} firmId
 * @returns {Promise<Object|null>}
 */
async function _decryptCaseDoc(doc, firmId, { logContext } = {}) {
  if (!doc || !process.env.MASTER_ENCRYPTION_KEY || !firmId) return doc;
  const tenantId = String(firmId);
  for (const field of CASE_ENCRYPTED_FIELDS) {
    if (doc[field] != null && looksEncrypted(doc[field])) {
      const encryptedValue = doc[field];
      try {
        const decrypted = await decrypt(encryptedValue, tenantId, undefined, {
          logContext: {
            ...logContext,
            field,
            model: 'Case',
          },
        });

        if (decrypted == null) {
          console.error('[CaseRepository] DECRYPTION_FAILED - FALLBACK', {
            field,
            firmId: tenantId,
            encryptedValueLength: String(encryptedValue).length,
            encryptedValueStart: String(encryptedValue).substring(0, 50),
            logContext,
          });
          doc[field] = encryptedValue;
        } else {
          doc[field] = decrypted;
        }
      } catch (err) {
        console.error('[CaseRepository] DECRYPTION_ERROR', {
          field,
          firmId: tenantId,
          error: err.message,
          errorStack: err.stack,
          encryptedValueLength: String(encryptedValue).length,
          encryptedValueStart: String(encryptedValue).substring(0, 50),
          logContext,
        });
        doc[field] = encryptedValue;
      }
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
async function _decryptCaseDocs(docs, firmId, { logContext } = {}) {
  if (!docs || !docs.length || !process.env.MASTER_ENCRYPTION_KEY || !firmId) return docs;
  const tenantId = String(firmId);

  for (const doc of docs) {
    if (!doc) continue;

    for (const field of CASE_ENCRYPTED_FIELDS) {
      if (doc[field] != null && looksEncrypted(doc[field])) {
        const encryptedValue = doc[field];
        try {
          const decrypted = await decrypt(encryptedValue, tenantId, undefined, {
            logContext: {
              ...logContext,
              field,
              model: 'Case',
              docId: doc._id,
            },
          });

          if (decrypted == null) {
            console.error('[CaseRepository] DECRYPTION_FAILED_IN_BATCH', {
              field,
              firmId: tenantId,
              docId: doc._id,
              encryptedValueLength: String(encryptedValue).length,
              encryptedValueStart: String(encryptedValue).substring(0, 50),
              logContext,
            });
            doc[field] = encryptedValue;
          } else {
            doc[field] = decrypted;
          }
        } catch (err) {
          console.error('[CaseRepository] DECRYPTION_ERROR_IN_BATCH', {
            field,
            firmId: tenantId,
            docId: doc._id,
            error: err.message,
            errorStack: err.stack,
            encryptedValueLength: String(encryptedValue).length,
            encryptedValueStart: String(encryptedValue).substring(0, 50),
            logContext,
          });
          doc[field] = encryptedValue;
        }
      }
    }
  }

  return docs;
}


/**
 * Diagnose decryption issues for a specific case description.
 * Intended for support/debug workflows.
 *
 * @param {string|ObjectId} firmId
 * @param {string|ObjectId} caseId - Case internal ID
 * @returns {Promise<Object>}
 */
async function diagnoseDescriptionDecryption(firmId, caseId) {
  const tenantId = String(firmId);
  const report = {
    timestamp: new Date().toISOString(),
    firmId: tenantId,
    caseId: String(caseId),
    checks: {},
  };

  report.checks.masterKeyConfigured = !!process.env.MASTER_ENCRYPTION_KEY;

  try {
    const TenantKey = require('../models/tenantKey.model');
    const tenantKey = await TenantKey.findOne({ tenantId });
    report.checks.tenantKeyExists = !!tenantKey;
    report.checks.tenantKeyFormat = tenantKey
      ? (/^[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/.test(tenantKey.encryptedDek)
        ? 'VALID'
        : 'INVALID_FORMAT')
      : 'N/A';
  } catch (err) {
    report.checks.tenantKeyError = err.message;
  }

  try {
    const doc = await Case.findOne({ firmId, caseInternalId: caseId });
    report.checks.caseExists = !!doc;
    if (doc) {
      const description = doc.description;
      report.checks.descriptionExists = description != null;
      report.checks.descriptionLength = description?.length;
      report.checks.descriptionLooksEncrypted = looksEncrypted(description);
      report.checks.descriptionStart = description?.substring(0, 50);
      report.checks.descriptionEnd = description?.substring(Math.max(0, description.length - 20));
    }
  } catch (err) {
    report.checks.caseQueryError = err.message;
  }

  try {
    const doc = await Case.findOne({ firmId, caseInternalId: caseId });
    if (doc && looksEncrypted(doc.description)) {
      const plaintext = await decrypt(doc.description, tenantId, undefined, {
        logContext: {
          operation: 'diagnoseDescriptionDecryption',
          model: 'Case',
          field: 'description',
          caseId: String(caseId),
        },
      });
      report.checks.decryptionSuccessful = !!plaintext;
      report.checks.decryptedLength = plaintext?.length;
      report.checks.decryptedPreview = plaintext?.substring(0, 100);
    }
  } catch (err) {
    report.checks.decryptionError = err.message;
    report.checks.decryptionErrorStack = err.stack;
  }

  console.log('[CaseRepository] DIAGNOSTIC_REPORT', report);
  return report;
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

const assertTenantId = (firmId) => {
  if (!firmId) {
    throw new Error('TenantId required');
  }
};

const CaseRepository = {

  async _findWithClient(matchQuery, firmId, role) {
    const pipeline = [
      { $match: matchQuery },
      { $limit: 1 },
      {
        $lookup: {
          from: 'clients',
          let: { caseClientId: '$clientId', caseFirmId: '$firmId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$clientId', '$caseClientId'] },
                    { $eq: ['$firmId', { $toObjectId: '$caseFirmId' }] },
                  ],
                },
              },
            },
          ],
          as: 'clientData',
        },
      },
      {
        $addFields: {
          client: { $arrayElemAt: ['$clientData', 0] },
        },
      },
      {
        $project: {
          clientData: 0,
        },
      },
    ];

    const results = await Case.aggregate(pipeline, { role });
    if (!results || results.length === 0) return null;

    // Use the public decryptDocs method on the Repository to handle POJOs
    const decrypted = await this.decryptDocs(results, firmId, { role });
    const doc = decrypted[0];

    if (doc.client) {
      const ClientRepository = require('./ClientRepository');
      await ClientRepository.decryptDocs([doc.client], firmId, { role });
    }

    return doc;
  },

  /**
   * Find case by internal ID (PREFERRED METHOD)

   * Uses opaque caseInternalId for secure, non-guessable lookups
   *
   * @param {string|ObjectId} firmId - Firm ID from req.user.firmId
   * @param {string|ObjectId} caseInternalId - Internal case identifier (ObjectId)
   * @param {string} role - Caller's role (required); superadmin triggers ForbiddenError
   * @returns {Promise<Object|null>} Case document or null
   */
  async findByInternalId(firmId, caseInternalId, role, options = {}) {
    assertTenantId(firmId);
    if (!caseInternalId) {
      return null;
    }
    _guardSuperadmin(role);

    // Convert string to ObjectId if needed
    const internalId = mongoose.Types.ObjectId.isValid(caseInternalId)
      ? new mongoose.Types.ObjectId(caseInternalId)
      : null;

    if (!internalId) {
      return null;
    }

    if (options.includeClient) {
      return this._findWithClient({ firmId: String(firmId), caseInternalId: internalId }, firmId, role);
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
   * @param {string} role - Caller's role (required); superadmin triggers ForbiddenError
   * @returns {Promise<Object|null>} Case document or null
   */
  async findByCaseNumber(firmId, caseNumber, role) {
    assertTenantId(firmId);
    if (!caseNumber) {
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
   * @param {string} role - Caller's role (required); superadmin triggers ForbiddenError
   * @returns {Promise<Object|null>} Case document or null
   * @deprecated Use findByInternalId or findByCaseNumber instead
   */
  async findByCaseId(firmId, caseId, role, options = {}) {
    assertTenantId(firmId);
    if (!caseId) {
      return null;
    }
    _guardSuperadmin(role);

    if (options.includeClient) {
      return this._findWithClient({ firmId: String(firmId), caseId: String(caseId) }, firmId, role);
    }

    // During transition, caseId = caseNumber
    const doc = await Case.findOne({ firmId, caseId });
    return _decryptCaseDoc(doc, firmId);
  },

  /**
   * Find case by MongoDB _id with firm scoping
   * @param {string|ObjectId} firmId - Firm ID from req.user.firmId
   * @param {string|ObjectId} _id - MongoDB document ID
   * @param {string} role - Caller's role (required); superadmin triggers ForbiddenError
   * @returns {Promise<Object|null>} Case document or null
   */
  async findById(firmId, _id, role) {
    assertTenantId(firmId);
    if (!_id) {
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
   * @param {string} role - Caller's role (required); superadmin triggers ForbiddenError
   * @returns {Promise<Array>} Array of case documents
   */
  async find(firmId, query = {}, role) {
    assertTenantId(firmId);
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
   * @param {string} role - Caller's role (required); superadmin triggers ForbiddenError
   * @returns {Promise<Object|null>} Case document or null
   */
  async findOne(firmId, query = {}, role) {
    assertTenantId(firmId);
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
    assertTenantId(firmId);
    if (!caseInternalId) {
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
    assertTenantId(firmId);
    if (!caseId) {
      return null;
    }
    return Case.updateOne({ firmId, caseId }, update);
  },

  /**
   * Update only case status with tenant boundary enforcement
   * @param {string} caseId - Case identifier
   * @param {string|ObjectId} firmId - Firm ID from tenant context
   * @param {string} status - New status value
   * @param {Object} extraFields - Additional fields to set with status update (must include `lifecycle`, e.g. from case.service)
   * @returns {Promise<Object>} Mongoose update result
   */
   async updateStatus(
    caseId,
    firmId,
    status,
    extraFields = {},
    session = null,
    expectedCurrentStatus = null,
    expectedTatLastStartedAt = undefined
  ) {
    assertTenantId(firmId);
    if (!caseId) {
      throw new Error('Case ID required');
    }

    const filter = { caseId, firmId };
    if (expectedCurrentStatus) {
      filter.status = expectedCurrentStatus;
    }
    if (expectedTatLastStartedAt !== undefined) {
      filter.tatLastStartedAt = expectedTatLastStartedAt;
    }

    const result = await Case.updateOne(
      filter,
      {
        $set: {
          status,
          ...extraFields,
        },
      },
      session ? { session } : {}
    );

    const matched = result?.matchedCount ?? result?.n ?? 0;
    if (matched === 0) {
      throw (expectedCurrentStatus || expectedTatLastStartedAt !== undefined)
        ? new Error('Case state changed concurrently')
        : new Error('Case not found');
    }

    return result;
  },

  /**
   * Update case by MongoDB _id with firm scoping
   * @param {string|ObjectId} firmId - Firm ID from req.user.firmId
   * @param {string|ObjectId} _id - MongoDB document ID
   * @param {Object} update - Update object
   * @returns {Promise<Object|null>} Updated case document or null
   */
  updateById(firmId, _id, update) {
    assertTenantId(firmId);
    if (!_id) {
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
    assertTenantId(firmId);
    if (!caseInternalId) {
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
    assertTenantId(firmId);
    if (!caseId) {
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
    assertTenantId(firmId);
    return Case.countDocuments({ firmId, ...query });
  },

  /**
   * Decrypt an array of case documents.
   * Useful for aggregation results.
   * @param {Array} docs - Array of case objects
   * @param {string} firmId - Tenant ID
   * @param {Object} options - Decryption options
   * @returns {Promise<Array>} Decrypted cases
   */
  async decryptDocs(docs, firmId, options = {}) {
    if (!docs || !docs.length) return docs;
    return _decryptCaseDocs(docs, firmId, options);
  },

  /**
   * Create a new case
   * NOTE: firmId MUST be included in caseData
   * Sensitive fields (description) are encrypted by the Case model pre-save hook.
   * The repository decrypts the returned document so callers receive plaintext.
   * Superadmin is blocked from creating (and receiving) tenant case data.
   * @param {Object} caseData - Case data including firmId
   * @param {string} role - Caller's role (required); superadmin triggers ForbiddenError
   * @returns {Promise<Object>} Created case document (decrypted)
   */
  async create(caseData, role) {
    if (!caseData.firmId) {
      throw new Error('firmId is required to create a case');
    }
    _guardSuperadmin(role);

    const tenantId = String(caseData.firmId);

    try {
      await ensureTenantKey(tenantId);
      console.info('[CaseRepository.create] Tenant key ensured', { tenantId });
    } catch (err) {
      console.error('[CaseRepository.create] TENANT_KEY_BOOTSTRAP_FAILED', {
        tenantId,
        error: err.message,
        errorStack: err.stack,
      });
      throw new Error(`Cannot create case: Encryption key bootstrap failed for firm ${tenantId}. Contact support.`);
    }

    if (!process.env.MASTER_ENCRYPTION_KEY) {
      console.error('[CaseRepository.create] MASTER_ENCRYPTION_KEY_MISSING', { tenantId });
      throw new Error('System is not properly configured for case creation. Contact support.');
    }

    try {
      const doc = await Case.create(caseData);
      console.info('[CaseRepository.create] Case created with encrypted description', {
        tenantId,
        caseId: doc._id,
        descriptionEncrypted: !!doc.description && looksEncrypted(doc.description),
        descriptionLength: doc.description?.length,
      });
      return await _decryptCaseDoc(doc, tenantId, {
        logContext: { operation: 'create', caseId: doc._id },
      });
    } catch (err) {
      console.error('[CaseRepository.create] CASE_CREATION_FAILED', {
        tenantId,
        error: err.message,
        errorStack: err.stack,
      });
      throw err;
    }
  },

  diagnoseDescriptionDecryption,
};

Object.freeze(CaseRepository);

module.exports = CaseRepository;
