const Case = require('../models/Case.model');
const mongoose = require('mongoose');

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
   * @returns {Promise<Object|null>} Case document or null
   */
  findByInternalId(firmId, caseInternalId) {
    if (!firmId || !caseInternalId) {
      return null;
    }
    
    // Convert string to ObjectId if needed
    const internalId = mongoose.Types.ObjectId.isValid(caseInternalId) 
      ? caseInternalId 
      : null;
    
    if (!internalId) {
      return null;
    }
    
    return Case.findOne({ firmId, caseInternalId: internalId });
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
   * @returns {Promise<Object|null>} Case document or null
   */
  findByCaseNumber(firmId, caseNumber) {
    if (!firmId || !caseNumber) {
      return null;
    }
    return Case.findOne({ firmId, caseNumber });
  },

  /**
   * Find case by caseId (DEPRECATED - BACKWARD COMPATIBILITY ONLY)
   * @param {string|ObjectId} firmId - Firm ID from req.user.firmId
   * @param {string} caseId - Case identifier (legacy field)
   * @returns {Promise<Object|null>} Case document or null
   * @deprecated Use findByInternalId or findByCaseNumber instead
   */
  findByCaseId(firmId, caseId) {
    if (!firmId || !caseId) {
      return null;
    }
    // During transition, caseId = caseNumber
    return Case.findOne({ firmId, caseId });
  },

  /**
   * Find case by MongoDB _id with firm scoping
   * @param {string|ObjectId} firmId - Firm ID from req.user.firmId
   * @param {string|ObjectId} _id - MongoDB document ID
   * @returns {Promise<Object|null>} Case document or null
   */
  findById(firmId, _id) {
    if (!firmId || !_id) {
      return null;
    }
    return Case.findOne({ firmId, _id });
  },

  /**
   * Find cases with query and firm scoping
   * @param {string|ObjectId} firmId - Firm ID from req.user.firmId
   * @param {Object} query - Additional query filters
   * @returns {Promise<Array>} Array of case documents
   */
  find(firmId, query = {}) {
    if (!firmId) {
      return Promise.resolve([]);
    }
    
    // Validate query doesn't misuse display identifiers
    validateQuery(query);
    
    return Case.find({ firmId, ...query });
  },

  /**
   * Find one case with query and firm scoping
   * @param {string|ObjectId} firmId - Firm ID from req.user.firmId
   * @param {Object} query - Additional query filters
   * @returns {Promise<Object|null>} Case document or null
   */
  findOne(firmId, query = {}) {
    if (!firmId) {
      return null;
    }
    
    // Validate query doesn't misuse display identifiers
    validateQuery(query);
    
    return Case.findOne({ firmId, ...query });
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
      return Promise.resolve({ deletedCount: 0 });
    }
    
    const internalId = mongoose.Types.ObjectId.isValid(caseInternalId) 
      ? caseInternalId 
      : null;
    
    if (!internalId) {
      return Promise.resolve({ deletedCount: 0 });
    }
    
    return Case.deleteOne({ firmId, caseInternalId: internalId });
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
      return Promise.resolve({ deletedCount: 0 });
    }
    return Case.deleteOne({ firmId, caseId });
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
   * @param {Object} caseData - Case data including firmId
   * @returns {Promise<Object>} Created case document
   */
  create(caseData) {
    if (!caseData.firmId) {
      throw new Error('firmId is required to create a case');
    }
    return Case.create(caseData);
  },
};

module.exports = CaseRepository;
