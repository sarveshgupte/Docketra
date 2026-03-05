/**
 * Application configuration
 * Centralized configuration management
 */

const config = {
  port: process.env.PORT || 5000,
  env: process.env.NODE_ENV || 'development',
  appName: process.env.APP_NAME || 'Docketra',
  mongodbUri: process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/caseflow',
  
  // Pagination defaults
  pagination: {
    defaultLimit: 20,
    maxLimit: 100,
  },
  
  // Audit trail settings
  audit: {
    enableDetailedLogs: true,
  },

  security: {
    rateLimit: {
      global: Number(process.env.SECURITY_RATE_LIMIT_GLOBAL || 100),
      auth: Number(process.env.SECURITY_RATE_LIMIT_AUTH || 5),
      tenantPerMinute: Number(process.env.SECURITY_RATE_LIMIT_TENANT_PER_MINUTE || 1000),
      sensitivePerWindow: Number(process.env.SECURITY_RATE_LIMIT_SENSITIVE || 30),
      sensitiveWindowSeconds: Number(process.env.SECURITY_RATE_LIMIT_SENSITIVE_WINDOW_SECONDS || 300),
      authWindowSeconds: Number(process.env.SECURITY_RATE_LIMIT_AUTH_WINDOW_SECONDS || 900),
      globalWindowSeconds: Number(process.env.SECURITY_RATE_LIMIT_GLOBAL_WINDOW_SECONDS || 900),
      authBlockSeconds: Number(process.env.SECURITY_RATE_LIMIT_AUTH_BLOCK_SECONDS || 1800),
      signupPerHour: Number(process.env.SECURITY_RATE_LIMIT_SIGNUP_PER_HOUR || 5),
      signupWindowSeconds: Number(process.env.SECURITY_RATE_LIMIT_SIGNUP_WINDOW_SECONDS || 3600),
      accountLockAttempts: Number(process.env.SECURITY_ACCOUNT_LOCK_ATTEMPTS || 5),
      accountLockSeconds: Number(process.env.SECURITY_ACCOUNT_LOCK_SECONDS || 1800),
    },
    upload: {
      maxSizeMB: Number(process.env.SECURITY_UPLOAD_MAX_SIZE_MB || 5),
      allowedMimeTypes: (process.env.SECURITY_UPLOAD_ALLOWED_MIME_TYPES || 'application/pdf,image/jpeg,image/png')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    },
  },
};

/**
 * Helper function to check if running in production environment
 * Used by guardrails to determine when to log warnings
 */
const isProduction = () => {
  return config.env === 'production';
};

module.exports = {
  ...config,
  isProduction,
};
