const { z } = require('zod');

const SUPERADMIN_XID_REGEX = /^X\d{6}$/i;
const MONGODB_OBJECTID_REGEX = /^[a-f\d]{24}$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BCRYPT_HASH_REGEX = /^\$2[abxy]?\$\d{2}\$.+/;

const SENSITIVE_ENV_KEY_PATTERN = /(SECRET|PASSWORD|TOKEN|KEY|PRIVATE|CREDENTIAL|AUTH)/i;

const boolFromEnv = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((value) => {
    if (typeof value === 'boolean') return value;
    if (typeof value !== 'string') return false;
    const normalized = value.trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
  });

const requiredNonEmpty = z.string().trim().min(1);

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(5000),

    MONGO_URI: z.string().trim().optional(),
    MONGODB_URI: z.string().trim().optional(),

    JWT_SECRET: z.string().min(32),
    SUPERADMIN_PASSWORD_HASH: z.string().regex(BCRYPT_HASH_REGEX),
    SUPERADMIN_XID: z.string().trim().regex(SUPERADMIN_XID_REGEX),
    SUPERADMIN_EMAIL: z.string().trim().email(),
    SUPERADMIN_OBJECT_ID: z.string().trim().regex(MONGODB_OBJECTID_REGEX),

    DISABLE_GOOGLE_AUTH: boolFromEnv,
    GOOGLE_CLIENT_ID: z.string().trim().optional(),
    GOOGLE_CLIENT_SECRET: z.string().trim().optional(),
    GOOGLE_AUTH_REDIRECT_URI: z.string().trim().optional(),
    GOOGLE_CALLBACK_URL: z.string().trim().optional(),
    GOOGLE_OAUTH_REDIRECT_URI: z.string().trim().optional(),

    ENCRYPTION_PROVIDER: z.enum(['local', 'kms', 'disabled']).default('local'),
    MASTER_ENCRYPTION_KEY: z.string().trim().optional(),

    METRICS_TOKEN: z.string().trim().optional(),
    STORAGE_TOKEN_SECRET: z.string().trim().optional(),
    STRICT_BYOS: boolFromEnv,

    BREVO_API_KEY: z.string().trim().optional(),
    MAIL_FROM: z.string().trim().optional(),
    SMTP_FROM: z.string().trim().optional(),
    ENABLE_AI_ANALYSIS: boolFromEnv,
    AI_PROVIDER: z.string().trim().optional(),
    OPENAI_API_KEY: z.string().trim().optional(),
    OPENAI_MODEL: z.string().trim().optional(),
    GEMINI_API_KEY: z.string().trim().optional(),
    GEMINI_MODEL: z.string().trim().optional(),
    CLAUDE_API_KEY: z.string().trim().optional(),
    CLAUDE_MODEL: z.string().trim().optional(),
  })
  .superRefine((env, ctx) => {
    if (!env.MONGO_URI && !env.MONGODB_URI) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['MONGO_URI'], message: 'MONGO_URI or MONGODB_URI is required' });
    }

    if (!env.DISABLE_GOOGLE_AUTH) {
      if (!env.GOOGLE_CLIENT_ID) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['GOOGLE_CLIENT_ID'], message: 'required when Google auth is enabled' });
      }
      if (!env.GOOGLE_CLIENT_SECRET) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['GOOGLE_CLIENT_SECRET'], message: 'required when Google auth is enabled' });
      }
      if (!env.GOOGLE_AUTH_REDIRECT_URI && !env.GOOGLE_CALLBACK_URL && !env.GOOGLE_OAUTH_REDIRECT_URI) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['GOOGLE_AUTH_REDIRECT_URI'], message: 'required when Google auth is enabled (or set GOOGLE_CALLBACK_URL/GOOGLE_OAUTH_REDIRECT_URI)' });
      }
    }

    if (env.ENCRYPTION_PROVIDER !== 'disabled' && !env.MASTER_ENCRYPTION_KEY) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['MASTER_ENCRYPTION_KEY'], message: 'required when ENCRYPTION_PROVIDER is not disabled' });
    }

    if (env.NODE_ENV === 'production') {
      if (!env.METRICS_TOKEN) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['METRICS_TOKEN'], message: 'required in production' });
      }

      if (!env.BREVO_API_KEY) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['BREVO_API_KEY'], message: 'required in production' });
      }
      if (!env.MAIL_FROM && !env.SMTP_FROM) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['MAIL_FROM'], message: 'MAIL_FROM or SMTP_FROM required in production' });
      }

      const byosFields = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_OAUTH_REDIRECT_URI', 'STORAGE_TOKEN_SECRET'];
      byosFields.forEach((key) => {
        if (!env[key]) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: 'required in production for BYOS Google provider' });
        }
      });

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

const maskEnvForLog = (raw = process.env) =>
  Object.entries(raw).reduce((acc, [key, value]) => {
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
    if (exitOnError) {
      process.exit(1);
    }
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
