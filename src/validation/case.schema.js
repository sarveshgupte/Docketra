/**
 * Case validation schemas
 * Centralised input validation for case-related endpoints.
 * Extend with Zod/Joi in a future PR; for now provides structural
 * scaffold and basic field-presence checks.
 */

/**
 * Validate the payload required to create a new case.
 * Returns { valid: true } or { valid: false, errors: string[] }.
 */
function validateCreateCase(body = {}) {
  const errors = [];
  if (!body.title || !String(body.title).trim()) {
    errors.push('title is required');
  }
  if (!body.status) {
    errors.push('status is required');
  }
  return errors.length ? { valid: false, errors } : { valid: true };
}

/**
 * Validate the payload required to update an existing case.
 */
function validateUpdateCase(body = {}) {
  const errors = [];
  if (body.title !== undefined && !String(body.title).trim()) {
    errors.push('title must not be blank');
  }
  return errors.length ? { valid: false, errors } : { valid: true };
}

module.exports = { validateCreateCase, validateUpdateCase };
