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
    return { valid: false, errors, warnings: [] };
  }

  const warnings = [];
  const inProd = process.env.NODE_ENV === 'production';
  const redisUrl = String(process.env.REDIS_URL || '').trim();
  const allowFallback = String(process.env.ALLOW_REDIS_FALLBACK || '').trim().toLowerCase() === 'true';
  if (inProd && !redisUrl && !allowFallback) {
    const warning = 'REDIS_URL is missing in production. Redis is required for production-grade operation. Set REDIS_URL or explicitly set ALLOW_REDIS_FALLBACK=true for degraded startup.';
    warnings.push(warning);
    (logger.warn || logger.log)(warning);
  }

  return { valid: true, errors: [], warnings };
};

module.exports = {
  validateEnv,
};
