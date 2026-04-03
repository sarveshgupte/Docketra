/**
 * Payload Validation Utility
 * Extracted from controller layer to reduce complexity.
 */

class PayloadValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PayloadValidationError';
  }
}

/**
 * Removes empty string, null, and undefined values from a payload.
 * @param {Object} payload
 * @returns {Object} Cleaned payload
 */
const sanitizePayload = (payload) => {
  if (!payload || typeof payload !== 'object') return {};

  return Object.fromEntries(
    Object.entries(payload).filter(
      ([, value]) => value !== '' && value !== null && value !== undefined
    )
  );
};

/**
 * Strips forbidden fields and enforces allowed fields.
 * Throws if unallowed fields are present.
 * @param {Object} payload
 * @param {string[]} forbiddenFields
 * @param {string[]} allowedFields
 * @param {string} entityName
 * @returns {Object} Validated and stripped payload
 */
const enforceAllowedFields = (payload, forbiddenFields = [], allowedFields = [], entityName = 'payload') => {
  const result = { ...payload };

  // Strip forbidden fields
  if (Array.isArray(forbiddenFields)) {
    forbiddenFields.forEach((field) => {
      delete result[field];
    });
  }

  if (Array.isArray(allowedFields) && allowedFields.length > 0) {
    const unexpectedFields = Object.keys(result).filter(
      (key) => !allowedFields.includes(key)
    );

    if (unexpectedFields.length > 0) {
      throw new PayloadValidationError(
        `Unexpected field(s) in ${entityName}: ${unexpectedFields.join(', ')}`
      );
    }
  }

  return result;
};

module.exports = {
  sanitizePayload,
  enforceAllowedFields,
  PayloadValidationError,
};
