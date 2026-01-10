const mongoose = require('mongoose');
const CaseRepository = require('../repositories/CaseRepository');

/**
 * Case Identifier Resolution Utility
 * 
 * PR: Case Identifier Semantics - Provides dual resolution for backward compatibility
 * 
 * This utility handles the transition from human-readable case IDs (CASE-YYYYMMDD-XXXXX)
 * to opaque internal IDs (ObjectId). It enables backward compatibility while enforcing
 * security best practices.
 * 
 * USAGE:
 * - Controllers accept identifiers from URL params (:caseId)
 * - This utility determines if it's an internal ID or display ID
 * - Returns the internal ID for use in all subsequent operations
 * - Throws NotFoundError if case doesn't exist
 */

/**
 * Check if a string is a valid MongoDB ObjectId
 * 
 * @param {string} id - Identifier to check
 * @returns {boolean} True if valid ObjectId format
 */
const isValidObjectId = (id) => {
  if (!id) return false;
  return mongoose.Types.ObjectId.isValid(id) && /^[0-9a-fA-F]{24}$/.test(id);
};

/**
 * Check if a string is a valid case number format
 * 
 * @param {string} id - Identifier to check
 * @returns {boolean} True if valid case number format (CASE-YYYYMMDD-XXXXX)
 */
const isValidCaseNumberFormat = (id) => {
  if (!id) return false;
  return /^CASE-\d{8}-\d{5}$/i.test(id);
};

/**
 * Resolve case identifier to internal ID
 * 
 * Accepts either:
 * - Internal ID (ObjectId) - returned directly
 * - Case number (CASE-YYYYMMDD-XXXXX) - resolved to internal ID
 * 
 * @param {string|ObjectId} firmId - Firm ID from req.user.firmId
 * @param {string} identifier - Case identifier from URL or request
 * @returns {Promise<string>} Internal case ID (ObjectId as string)
 * @throws {Error} If case not found or identifier invalid
 */
const resolveCaseIdentifier = async (firmId, identifier) => {
  if (!firmId) {
    throw new Error('Firm ID is required for case resolution');
  }
  
  if (!identifier) {
    throw new Error('Case identifier is required');
  }
  
  // Case 1: Already an internal ID (ObjectId)
  if (isValidObjectId(identifier)) {
    // Verify case exists with this internal ID
    const caseDoc = await CaseRepository.findByInternalId(firmId, identifier);
    if (!caseDoc) {
      throw new Error('Case not found');
    }
    return caseDoc.caseInternalId.toString();
  }
  
  // Case 2: Case number (CASE-YYYYMMDD-XXXXX) - resolve to internal ID
  if (isValidCaseNumberFormat(identifier)) {
    const caseDoc = await CaseRepository.findByCaseNumber(firmId, identifier);
    if (!caseDoc) {
      throw new Error('Case not found');
    }
    return caseDoc.caseInternalId.toString();
  }
  
  // Case 3: Invalid format
  throw new Error('Invalid case identifier format. Expected ObjectId or CASE-YYYYMMDD-XXXXX format.');
};

/**
 * Resolve case identifier and return full case document
 * 
 * Convenience method that resolves identifier and fetches the case in one call
 * 
 * @param {string|ObjectId} firmId - Firm ID from req.user.firmId
 * @param {string} identifier - Case identifier from URL or request
 * @returns {Promise<Object>} Case document
 * @throws {Error} If case not found or identifier invalid
 */
const resolveCaseDocument = async (firmId, identifier) => {
  const internalId = await resolveCaseIdentifier(firmId, identifier);
  const caseDoc = await CaseRepository.findByInternalId(firmId, internalId);
  
  if (!caseDoc) {
    throw new Error('Case not found');
  }
  
  return caseDoc;
};

module.exports = {
  isValidObjectId,
  isValidCaseNumberFormat,
  resolveCaseIdentifier,
  resolveCaseDocument,
};
