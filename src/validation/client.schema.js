/**
 * Client validation schemas
 * Centralised input validation for client-related endpoints.
 * Extend with Zod/Joi in a future PR; for now provides structural
 * scaffold and basic field-presence checks.
 */

/**
 * Validate the payload required to create a new client.
 * Returns { valid: true } or { valid: false, errors: string[] }.
 */
function validateCreateClient(body = {}) {
  const errors = [];
  if (!body.name || !String(body.name).trim()) {
    errors.push('name is required');
  }
  return errors.length ? { valid: false, errors } : { valid: true };
}

/**
 * Validate the payload required to update an existing client.
 */
function validateUpdateClient(body = {}) {
  const errors = [];
  if (body.name !== undefined && !String(body.name).trim()) {
    errors.push('name must not be blank');
  }
  return errors.length ? { valid: false, errors } : { valid: true };
}

module.exports = { validateCreateClient, validateUpdateClient };
