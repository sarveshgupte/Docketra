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
  const requiredFields = [
    'businessName',
    'businessEmail',
    'primaryContactNumber',
    'businessAddress',
    'city',
    'state',
    'pincode',
    'contactPersonName',
    'contactPersonEmail',
    'contactPersonPhone',
  ];
  for (const field of requiredFields) {
    if (!body[field] || !String(body[field]).trim()) {
      errors.push(`${field} is required`);
    }
  }
  return errors.length ? { valid: false, errors } : { valid: true };
}

/**
 * Validate the payload required to update an existing client.
 */
function validateUpdateClient(body = {}) {
  const errors = [];
  const nonBlankIfPresent = [
    'businessName',
    'businessEmail',
    'primaryContactNumber',
    'businessAddress',
    'city',
    'state',
    'pincode',
    'contactPersonName',
    'contactPersonEmail',
    'contactPersonPhone',
  ];
  for (const field of nonBlankIfPresent) {
    if (body[field] !== undefined && !String(body[field]).trim()) {
      errors.push(`${field} must not be blank`);
    }
  }
  return errors.length ? { valid: false, errors } : { valid: true };
}

module.exports = { validateCreateClient, validateUpdateClient };
