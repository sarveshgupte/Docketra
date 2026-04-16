const getMissingRequiredFields = (payload = {}, requiredFields = []) => requiredFields
  .filter((field) => {
    const value = payload?.[field];
    if (typeof value === 'string') return value.trim() === '';
    return value === undefined || value === null;
  });

const hasRequiredFields = (payload = {}, requiredFields = []) => getMissingRequiredFields(payload, requiredFields).length === 0;

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
