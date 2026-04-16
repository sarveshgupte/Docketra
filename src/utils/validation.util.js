const getMissingRequiredFields = (payload = {}, requiredFields = [], options = {}) => requiredFields
  .filter((field) => {
    const trimStrings = options?.trimStrings === true;
    const value = payload?.[field];
    if (typeof value === 'string') return trimStrings ? value.trim() === '' : value === '';
    return value === undefined || value === null;
  });

const hasRequiredFields = (payload = {}, requiredFields = [], options = {}) => getMissingRequiredFields(payload, requiredFields, options).length === 0;

const getValidationDetails = (error) => {
  if (!error?.errors) return undefined;
  return Object.values(error.errors)
    .map((validationError) => validationError?.message)
    .filter(Boolean)
    .join('; ');
};

const getRequiredFieldValidation = (payload = {}, requiredFields = [], options = {}) => {
  const missingFields = getMissingRequiredFields(payload, requiredFields, options);
  return {
    isValid: missingFields.length === 0,
    missingFields,
  };
};

const buildMissingFieldsMessage = (missingFields = [], { suffix = 'are required' } = {}) => {
  if (!Array.isArray(missingFields) || missingFields.length === 0) return '';
  return `${missingFields.join(', ')} ${suffix}`;
};

module.exports = {
  getMissingRequiredFields,
  hasRequiredFields,
  getValidationDetails,
  getRequiredFieldValidation,
  buildMissingFieldsMessage,
};
