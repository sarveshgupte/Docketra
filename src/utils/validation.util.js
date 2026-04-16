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

module.exports = {
  getMissingRequiredFields,
  hasRequiredFields,
  getValidationDetails,
};
