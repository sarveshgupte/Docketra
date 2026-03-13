const { getNextSequence } = require('./counter.service');

/**
 * Case ID Generator Service
 *
 * Generates unique, deterministic case IDs.
 *
 * Legacy format (used when no work-type prefix is available):
 *   CASE-YYYYMMDD-XXXXX   e.g. CASE-20260108-00012
 *
 * Docket ID format (used when a work-type prefix is set):
 *   PREFIXYYYYMMDDNNNN    e.g. CO202603084821
 *   where NNNN is a 4-digit random number retried on collision.
 *
 * PR 2: Atomic Counter Implementation
 * - Uses MongoDB atomic counters to eliminate race conditions (legacy path)
 * - Firm-scoped for multi-tenancy
 * - Daily sequences via date-specific counter names
 *
 * Rules:
 * - No hyphens in docket ID format
 * - Must be unique (unique DB index enforced)
 * - Generated when docket is created
 * - Cloned dockets generate new IDs
 * - Work type prefixes must be unique per firm
 */

/**
 * Generate a docket ID in the new human-readable format.
 * Format: WORKTYPEPREFIX + YYYYMMDD + RANDOM4DIGIT
 * Example: CO202603084821
 *
 * Uniqueness is guaranteed by the database unique index on caseNumber.
 * The caller (pre-save hook) must handle E11000 duplicate-key errors
 * by retrying with a fresh random suffix.
 *
 * @param {string} firmId           - Firm ID for tenant scoping (REQUIRED)
 * @param {string} workTypePrefix   - 2-4 char work type prefix (REQUIRED)
 * @returns {string} Generated docket ID (not yet persisted)
 * @throws {Error} If firmId or workTypePrefix is missing
 */
function generateDocketId(firmId, workTypePrefix) {
  if (!firmId) throw new Error('Firm ID is required for docket ID generation');
  if (!workTypePrefix) throw new Error('Work type prefix is required for docket ID generation');

  const prefix = String(workTypePrefix).trim().toUpperCase();
  if (!/^[A-Z]{2,4}$/.test(prefix)) {
    throw new Error('Work type prefix must be 2-4 uppercase letters');
  }

  const now = new Date();
  const year  = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day   = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;

  // 4-digit random suffix: 1000–9999 (always 4 digits)
  const randomSuffix = String(Math.floor(1000 + Math.random() * 9000));

  return `${prefix}${dateStr}${randomSuffix}`;
}

/**
 * Generate case ID for current date (legacy format).
 * Format: CASE-YYYYMMDD-XXXXX
 *
 * @param {string} firmId - Firm ID for tenant scoping (REQUIRED)
 * @returns {Promise<string>} Generated case ID
 * @throws {Error} If firmId is missing or generation fails
 */
async function generateCaseId(firmId, options = {}) {
  try {
    // Validate firmId
    if (!firmId) {
      throw new Error('Firm ID is required for case ID generation');
    }
    
    // Get current date components
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    
    // Create date prefix: YYYYMMDD
    const datePrefix = `${year}${month}${day}`;
    const casePrefix = `CASE-${datePrefix}-`;
    
    // Counter name includes date for daily reset
    // Format: case-YYYYMMDD (e.g., case-20260108)
    const counterName = `case-${datePrefix}`;
    
    // Get next sequence atomically - this is thread-safe and eliminates race conditions
    const sequenceNumber = await getNextSequence(counterName, firmId, options);
    
    // Format as 5-digit zero-padded number
    const paddedSequence = String(sequenceNumber).padStart(5, '0');
    
    // Generate final case ID
    const caseId = `${casePrefix}${paddedSequence}`;
    
    return caseId;
  } catch (error) {
    throw new Error(`Error generating case ID: ${error.message}`);
  }
}

/**
 * Validate legacy case ID format (CASE-YYYYMMDD-XXXXX).
 *
 * @param {string} caseId - Case ID to validate
 * @returns {boolean} True if valid legacy format
 */
function isValidCaseIdFormat(caseId) {
  // Format: CASE-YYYYMMDD-XXXXX (e.g., CASE-20260108-00012)
  const pattern = /^CASE-\d{8}-\d{5}$/;
  return pattern.test(caseId);
}

/**
 * Validate docket ID format (PREFIXYYYYMMDDNNNN).
 *
 * @param {string} docketId - Docket ID to validate
 * @returns {boolean} True if valid docket ID format
 */
function isValidDocketIdFormat(docketId) {
  // Format: 2-4 uppercase letters + 8 digits (YYYYMMDD) + 4 digits (random)
  const pattern = /^[A-Z]{2,4}\d{12}$/;
  return pattern.test(docketId);
}

/**
 * Extract date from legacy case ID.
 *
 * @param {string} caseId - Case ID
 * @returns {Date|null} Extracted date or null if invalid
 */
function extractDateFromCaseId(caseId) {
  if (!isValidCaseIdFormat(caseId)) {
    return null;
  }
  
  // Extract YYYYMMDD from case ID (after "CASE-")
  const dateStr = caseId.substring(5, 13);
  const year = parseInt(dateStr.substring(0, 4), 10);
  const month = parseInt(dateStr.substring(4, 6), 10) - 1; // JS months are 0-indexed
  const day = parseInt(dateStr.substring(6, 8), 10);
  
  return new Date(year, month, day);
}

module.exports = {
  generateDocketId,
  generateCaseId,
  isValidCaseIdFormat,
  isValidDocketIdFormat,
  extractDateFromCaseId,
};
