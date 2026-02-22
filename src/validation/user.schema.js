/**
 * User validation schemas
 * Centralised input validation for user-related endpoints.
 * Extend with Zod/Joi in a future PR; for now provides structural
 * scaffold and basic field-presence checks.
 */

/**
 * Validate the payload required to create a new user.
 * Returns { valid: true } or { valid: false, errors: string[] }.
 */
function validateCreateUser(body = {}) {
  const errors = [];
  if (!body.email || !String(body.email).trim()) {
    errors.push('email is required');
  }
  if (!body.role) {
    errors.push('role is required');
  }
  return errors.length ? { valid: false, errors } : { valid: true };
}

/**
 * Validate the payload required to update an existing user.
 */
function validateUpdateUser(body = {}) {
  const errors = [];
  const immutable = ['firmId', 'xID'];
  for (const field of immutable) {
    if (body[field] !== undefined) {
      errors.push(`${field} is immutable and cannot be updated`);
    }
  }
  return errors.length ? { valid: false, errors } : { valid: true };
}

module.exports = { validateCreateUser, validateUpdateUser };
