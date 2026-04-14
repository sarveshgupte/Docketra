const { loadEnv } = require('./env');

/**
 * Application configuration
 * Centralized configuration management
 */

const env = loadEnv({ exitOnError: false }) || {
  PORT: Number(process.env.PORT || 5000),
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGODB_URI: process.env.MONGODB_URI || process.env.MONGO_URI,
};

const config = {
  port: env.PORT,
  env: env.NODE_ENV,
  appName: process.env.APP_NAME || 'Docketra',
  mongodbUri: env.MONGODB_URI,
  strictByos: Boolean(env.STRICT_BYOS),
  aiAnalysisEnabled: Boolean(env.ENABLE_AI_ANALYSIS),
  
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
      // Temporary development-friendly defaults.
      // Production deployments should override these with much stricter values.
      global: Number(process.env.SECURITY_RATE_LIMIT_GLOBAL || 1000),
      auth: Number(process.env.SECURITY_RATE_LIMIT_AUTH || 100),
      tenantPerMinute: Number(process.env.SECURITY_RATE_LIMIT_TENANT_PER_MINUTE || 1000),
      sensitivePerWindow: Number(process.env.SECURITY_RATE_LIMIT_SENSITIVE || 150),
      sensitiveWindowSeconds: Number(process.env.SECURITY_RATE_LIMIT_SENSITIVE_WINDOW_SECONDS || 60),
      authWindowSeconds: Number(process.env.SECURITY_RATE_LIMIT_AUTH_WINDOW_SECONDS || 60),
      globalWindowSeconds: Number(process.env.SECURITY_RATE_LIMIT_GLOBAL_WINDOW_SECONDS || 60),
      authBlockSeconds: Number(process.env.SECURITY_RATE_LIMIT_AUTH_BLOCK_SECONDS || 300),
      signupPerHour: Number(process.env.SECURITY_RATE_LIMIT_SIGNUP_PER_HOUR || 100),
      signupWindowSeconds: Number(process.env.SECURITY_RATE_LIMIT_SIGNUP_WINDOW_SECONDS || 3600),
      signupPerEmailPerWindow: Number(process.env.SECURITY_RATE_LIMIT_SIGNUP_PER_EMAIL_PER_WINDOW || 20),
      loginPerMinute: Number(process.env.SECURITY_RATE_LIMIT_LOGIN_PER_MINUTE || 75),
      loginWindowSeconds: Number(process.env.SECURITY_RATE_LIMIT_LOGIN_WINDOW_SECONDS || 60),
      forgotPasswordPerMinute: Number(process.env.SECURITY_RATE_LIMIT_FORGOT_PASSWORD_PER_MINUTE || 50),
      forgotPasswordWindowSeconds: Number(process.env.SECURITY_RATE_LIMIT_FORGOT_PASSWORD_WINDOW_SECONDS || 60),
      publicPerMinute: Number(process.env.SECURITY_RATE_LIMIT_PUBLIC_PER_MINUTE || 500),
      publicWindowSeconds: Number(process.env.SECURITY_RATE_LIMIT_PUBLIC_WINDOW_SECONDS || 60),
      otpVerifyPerMinute: Number(process.env.SECURITY_RATE_LIMIT_OTP_VERIFY_PER_MINUTE || 30),
      otpVerifyWindowSeconds: Number(process.env.SECURITY_RATE_LIMIT_OTP_VERIFY_WINDOW_SECONDS || 60),
      otpVerifyBlockSeconds: Number(process.env.SECURITY_RATE_LIMIT_OTP_VERIFY_BLOCK_SECONDS || 60),
      otpResendPerMinute: Number(process.env.SECURITY_RATE_LIMIT_OTP_RESEND_PER_MINUTE || 10),
      otpResendPerEmailPerWindow: Number(process.env.SECURITY_RATE_LIMIT_OTP_RESEND_PER_EMAIL_PER_WINDOW || 10),
      otpResendWindowSeconds: Number(process.env.SECURITY_RATE_LIMIT_OTP_RESEND_WINDOW_SECONDS || 60),
      otpResendCooldownSeconds: Number(process.env.SECURITY_RATE_LIMIT_OTP_RESEND_COOLDOWN_SECONDS || 60),
      signupOtpMaxResends: Number(process.env.SECURITY_RATE_LIMIT_SIGNUP_OTP_MAX_RESENDS || 10),
      userReadPerMinute: Number(process.env.SECURITY_RATE_LIMIT_USER_READ_PER_MINUTE || 300),
      userReadWindowSeconds: Number(process.env.SECURITY_RATE_LIMIT_USER_READ_WINDOW_SECONDS || 60),
      userWritePerMinute: Number(process.env.SECURITY_RATE_LIMIT_USER_WRITE_PER_MINUTE || 150),
      userWriteWindowSeconds: Number(process.env.SECURITY_RATE_LIMIT_USER_WRITE_WINDOW_SECONDS || 60),
      searchPerMinute: Number(process.env.SECURITY_RATE_LIMIT_SEARCH_PER_MINUTE || 150),
      searchWindowSeconds: Number(process.env.SECURITY_RATE_LIMIT_SEARCH_WINDOW_SECONDS || 60),
      profilePerMinute: Number(process.env.SECURITY_RATE_LIMIT_PROFILE_PER_MINUTE || 300),
      profileWindowSeconds: Number(process.env.SECURITY_RATE_LIMIT_PROFILE_WINDOW_SECONDS || 60),
      refreshIpPerMinute: Number(process.env.SECURITY_RATE_LIMIT_REFRESH_IP_PER_MINUTE || 120),
      refreshIpWindowSeconds: Number(process.env.SECURITY_RATE_LIMIT_REFRESH_IP_WINDOW_SECONDS || 60),
      refreshUserPerWindow: Number(process.env.SECURITY_RATE_LIMIT_REFRESH_USER_PER_WINDOW || process.env.SECURITY_RATE_LIMIT_REFRESH_USER_PER_DAY || 1000),
      refreshUserWindowSeconds: Number(process.env.SECURITY_RATE_LIMIT_REFRESH_USER_WINDOW_SECONDS || 86400),
      superadminPerMinute: Number(process.env.SECURITY_RATE_LIMIT_SUPERADMIN_PER_MINUTE || 300),
      superadminWindowSeconds: Number(process.env.SECURITY_RATE_LIMIT_SUPERADMIN_WINDOW_SECONDS || 60),
      internalMetricsPerMinute: Number(process.env.SECURITY_RATE_LIMIT_INTERNAL_METRICS_PER_MINUTE || 300),
      internalMetricsWindowSeconds: Number(process.env.SECURITY_RATE_LIMIT_INTERNAL_METRICS_WINDOW_SECONDS || 60),
      contactPerWindow: Number(process.env.SECURITY_RATE_LIMIT_CONTACT_PER_WINDOW || 20),
      contactWindowSeconds: Number(process.env.SECURITY_RATE_LIMIT_CONTACT_WINDOW_SECONDS || 900),
      formSubmitPerWindow: Number(process.env.SECURITY_RATE_LIMIT_FORM_SUBMIT_PER_WINDOW || 10),
      formSubmitWindowSeconds: Number(process.env.SECURITY_RATE_LIMIT_FORM_SUBMIT_WINDOW_SECONDS || 60),
      commentPerMinute: Number(process.env.SECURITY_RATE_LIMIT_COMMENT_PER_MINUTE || 45),
      commentWindowSeconds: Number(process.env.SECURITY_RATE_LIMIT_COMMENT_WINDOW_SECONDS || 60),
      fileUploadPerMinute: Number(process.env.SECURITY_RATE_LIMIT_FILE_UPLOAD_PER_MINUTE || 20),
      fileUploadWindowSeconds: Number(process.env.SECURITY_RATE_LIMIT_FILE_UPLOAD_WINDOW_SECONDS || 60),
      debugPerMinute: Number(process.env.SECURITY_RATE_LIMIT_DEBUG_PER_MINUTE || 30),
      debugWindowSeconds: Number(process.env.SECURITY_RATE_LIMIT_DEBUG_WINDOW_SECONDS || 60),
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
