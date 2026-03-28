const { loadEnv } = require('./env');

const validateEnv = ({ exitOnError = true, logger = console } = {}) => {
  const env = loadEnv({ exitOnError, logger });
  if (!env) {
    return { valid: false, errors: ['Environment validation failed'] };
  }
  return { valid: true };
};

module.exports = {
  validateEnv,
};
