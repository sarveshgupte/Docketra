const { envSchema } = require('./env');

const validateEnv = ({ exitOnError = true, logger = console } = {}) => {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((issue) => ({
      field: issue.path.join('.') || 'unknown',
      reason: issue.message,
    }));
    (logger.error || logger.log)('Environment validation failed', { errors });
    if (exitOnError) process.exit(1);
    return { valid: false, errors };
  }
  return { valid: true, errors: [] };
};

module.exports = {
  validateEnv,
};
