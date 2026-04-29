const { z } = require('zod');

const SUPERADMIN_XID_REGEX = /^X\d{6}$/i;
const MONGODB_OBJECTID_REGEX = /^[a-f\d]{24}$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BCRYPT_HASH_REGEX = /^\$2[abxy]?\$\d{2}\$.+/;
const BCRYPT_HASH_STRICT_REGEX = /^\$2[abxy]\$\d{2}\$[./A-Za-z0-9]{53}$/;
const BASE64_32_BYTE_KEY_REGEX = /^(?:[A-Za-z0-9+/]{43}=|[A-Za-z0-9+/]{44})$/;
const HEX_32_BYTE_KEY_REGEX = /^[a-fA-F0-9]{64}$/;

const SENSITIVE_ENV_KEY_PATTERN = /(SECRET|PASSWORD|TOKEN|KEY|PRIVATE|CREDENTIAL|AUTH)/i;
const SUPPORTED_ENCRYPTION_PROVIDERS = ['local', 'disabled'];
const SUPPORTED_AI_PROVIDERS = ['openai'];
const PLACEHOLDER_PATTERN = /(replace-with|your-secret|change-me|example-secret|dummy|test-secret|placeholder|sample|changethis)/i;
const MIN_SECRET_LENGTH = 64;

const boolFromEnv = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((value) => {
    if (typeof value === 'boolean') return value;
    if (typeof value !== 'string') return false;
    const normalized = value.trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
  });

const isWeakSecret = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) return true;
  if (PLACEHOLDER_PATTERN.test(normalized)) return true;
  if (normalized.length < MIN_SECRET_LENGTH) return true;
  if (/^[a-zA-Z0-9_-]{1,32}$/.test(normalized)) return true;
  return false;
};

const isValidMasterEncryptionKey = (value) => {
  const normalized = String(value || '').trim();
  return HEX_32_BYTE_KEY_REGEX.test(normalized) || BASE64_32_BYTE_KEY_REGEX.test(normalized);
};

const isExternalStorageEnabled = (env) => env.ENABLE_EXTERNAL_STORAGE === true;

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(5000),

    MONGO_URI: z.string().trim().optional(),
    MONGODB_URI: z.string().trim().optional(),
    REDIS_URL: z.string().trim().optional(),

    JWT_SECRET: z.string().min(32),
    JWT_PASSWORD_SETUP_SECRET: z.string().trim().optional(),
    SUPERADMIN_PASSWORD_HASH: z.string().regex(BCRYPT_HASH_REGEX),
    SUPERADMIN_XID: z.string().trim().regex(SUPERADMIN_XID_REGEX),
    SUPERADMIN_EMAIL: z.string().trim().email(),
    SUPERADMIN_OBJECT_ID: z.string().trim().regex(MONGODB_OBJECTID_REGEX),

    GOOGLE_CLIENT_ID: z.string().trim().optional(),
    GOOGLE_CLIENT_SECRET: z.string().trim().optional(),
    GOOGLE_OAUTH_REDIRECT_URI: z.string().trim().optional(),
    DISABLE_GOOGLE_AUTH: boolFromEnv,
    ENABLE_EXTERNAL_STORAGE: boolFromEnv,

    ENCRYPTION_PROVIDER: z.string().trim().optional().default('local'),
    MASTER_ENCRYPTION_KEY: z.string().trim().optional(),

    METRICS_TOKEN: z.string().trim().optional(),
    STORAGE_TOKEN_SECRET: z.string().trim().optional(),
    STRICT_BYOS: boolFromEnv,
    CSP_REPORTING_ENABLED: boolFromEnv,
    AUTH_DEBUG_DIAGNOSTICS: boolFromEnv,
    UPLOAD_SCAN_STRICT: boolFromEnv,

    BREVO_API_KEY: z.string().trim().optional(),
    MAIL_FROM: z.string().trim().optional(),
    SMTP_FROM: z.string().trim().optional(),
    SMTP_PASS: z.string().trim().optional(),

    ENABLE_AI_ANALYSIS: boolFromEnv,
    AI_PROVIDER: z.string().trim().optional(),
    OPENAI_API_KEY: z.string().trim().optional(),
    OPENAI_MODEL: z.string().trim().optional(),
    GEMINI_API_KEY: z.string().trim().optional(),
    GEMINI_MODEL: z.string().trim().optional(),
    CLAUDE_API_KEY: z.string().trim().optional(),
    CLAUDE_MODEL: z.string().trim().optional(),
    CLAMAV_HOST: z.string().trim().optional(),
  })
  .superRefine((env, ctx) => {
    if (!env.MONGO_URI && !env.MONGODB_URI) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['MONGO_URI'], message: 'MONGO_URI or MONGODB_URI is required' });
    }

    const encryptionProvider = String(env.ENCRYPTION_PROVIDER || 'local').toLowerCase();
    if (!SUPPORTED_ENCRYPTION_PROVIDERS.includes(encryptionProvider)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ENCRYPTION_PROVIDER'],
        message: `Unsupported ENCRYPTION_PROVIDER "${env.ENCRYPTION_PROVIDER}". Supported providers: ${SUPPORTED_ENCRYPTION_PROVIDERS.join(', ')}`,
      });
    }

    if (encryptionProvider !== 'disabled' && !env.MASTER_ENCRYPTION_KEY) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['MASTER_ENCRYPTION_KEY'], message: 'required when ENCRYPTION_PROVIDER is not disabled' });
    }

    const aiProvider = String(env.AI_PROVIDER || '').trim().toLowerCase();
    if (aiProvider && !SUPPORTED_AI_PROVIDERS.includes(aiProvider)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['AI_PROVIDER'],
        message: `Unsupported AI_PROVIDER "${env.AI_PROVIDER}". Supported providers: ${SUPPORTED_AI_PROVIDERS.join(', ')}`,
      });
    }

    if (env.NODE_ENV === 'production') {
      if (env.AUTH_DEBUG_DIAGNOSTICS === true) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['AUTH_DEBUG_DIAGNOSTICS'], message: 'must be false in production' });
      }
      if (env.UPLOAD_SCAN_STRICT !== true) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['UPLOAD_SCAN_STRICT'], message: 'must be true in production' });
      }

      ['JWT_SECRET', 'JWT_PASSWORD_SETUP_SECRET', 'STORAGE_TOKEN_SECRET', 'METRICS_TOKEN'].forEach((key) => {
        if (isWeakSecret(env[key])) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: `must be a strong random value (>= ${MIN_SECRET_LENGTH} chars and not a placeholder)` });
        }
      });

      if (!isValidMasterEncryptionKey(env.MASTER_ENCRYPTION_KEY)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['MASTER_ENCRYPTION_KEY'], message: 'must be 32-byte base64 (44 chars) or 64-char hex' });
      }

      if (!BCRYPT_HASH_STRICT_REGEX.test(String(env.SUPERADMIN_PASSWORD_HASH || ''))) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['SUPERADMIN_PASSWORD_HASH'], message: 'must be a valid bcrypt hash (not plaintext)' });
      }

      if (!env.REDIS_URL) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['REDIS_URL'], message: 'required in production for distributed abuse/rate-limit controls' });
      }

      if (!env.BREVO_API_KEY) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['BREVO_API_KEY'], message: 'required in production for auth email/OTP/password-reset delivery' });
      }
      if (!env.MAIL_FROM && !env.SMTP_FROM) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['MAIL_FROM'], message: 'MAIL_FROM or SMTP_FROM required in production for auth email/OTP/password-reset delivery' });
      }
      if (env.SMTP_FROM && !env.SMTP_PASS) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['SMTP_PASS'], message: 'required when SMTP_FROM is configured in production' });
      }

      const googleStorageEnabled = isExternalStorageEnabled(env);
      if (googleStorageEnabled) {
        ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_OAUTH_REDIRECT_URI', 'STORAGE_TOKEN_SECRET'].forEach((key) => {
          if (!env[key]) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: 'required when Google OAuth/BYOS storage is enabled in production' });
          }
        });
      }
    }

    if (env.MONGO_URI && !env.MONGO_URI.startsWith('mongodb')) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['MONGO_URI'], message: 'must be a valid MongoDB URI' });
    }
    if (env.MONGODB_URI && !env.MONGODB_URI.startsWith('mongodb')) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['MONGODB_URI'], message: 'must be a valid MongoDB URI' });
    }
  });

const isSensitiveEnvKey = (key) => SENSITIVE_ENV_KEY_PATTERN.test(String(key || ''));

const maskEnvValue = (key, value) => {
  if (value === undefined || value === null || value === '') return value;
  if (isSensitiveEnvKey(key)) return '***REDACTED***';

  if (String(key).toUpperCase().includes('EMAIL') && EMAIL_REGEX.test(String(value))) {
    const [local, domain] = String(value).split('@');
    return `${local.slice(0, 2)}***@${domain.slice(0, 1)}***`;
  }

  return value;
};

const maskEnvForLog = (raw = process.env) => Object.entries(raw).reduce((acc, [key, value]) => {
  acc[key] = maskEnvValue(key, value);
  return acc;
}, {});

let cachedEnv;

const loadEnv = ({ exitOnError = true, logger = console } = {}) => {
  if (cachedEnv) return cachedEnv;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((issue) => ({
      field: issue.path.join('.') || 'unknown',
      reason: issue.message,
      received: maskEnvValue(issue.path.join('.'), process.env[issue.path[0]]),
    }));

    (logger.error || logger.log)('Environment validation failed', { errors });
    if (exitOnError) process.exit(1);
    return null;
  }

  const env = parsed.data;
  cachedEnv = {
    ...env,
    MONGODB_URI: env.MONGODB_URI || env.MONGO_URI,
    MONGO_URI: env.MONGO_URI || env.MONGODB_URI,
    SUPERADMIN_XID_NORMALIZED: env.SUPERADMIN_XID.toUpperCase(),
    SUPERADMIN_EMAIL_NORMALIZED: env.SUPERADMIN_EMAIL.toLowerCase(),
  };

  return cachedEnv;
};

module.exports = {
  loadEnv,
  envSchema,
  maskEnvForLog,
  isSensitiveEnvKey,
};
