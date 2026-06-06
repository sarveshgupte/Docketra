const { validateEnv } = require('../src/config/validateEnv');

function makeTestSecret(label, length = 72) {
  const seed = `validation-only-${label}-`;
  return seed + 'x'.repeat(Math.max(0, length - seed.length));
}

function makeTestBcryptHash() {
  // Validation-only deterministic placeholder matching bcrypt hash format.
  return `$2b$10$${'a'.repeat(53)}`;
}

process.env.NODE_ENV = 'production';
process.env.PORT = '5000';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/test';
process.env.REDIS_URL = 'redis://127.0.0.1:6379';
process.env.JWT_SECRET = makeTestSecret('jwt');
process.env.JWT_PASSWORD_SETUP_SECRET = makeTestSecret('jwt-password-setup');
process.env.SUPERADMIN_PASSWORD_HASH = makeTestBcryptHash();
process.env.SUPERADMIN_XID = 'X000001';
process.env.SUPERADMIN_EMAIL = 'superadmin@example.com';
process.env.SUPERADMIN_OBJECT_ID = '000000000000000000000001';
process.env.ENCRYPTION_PROVIDER = 'local';
process.env.MASTER_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString('base64');
process.env.METRICS_TOKEN = makeTestSecret('metrics-token');
process.env.STORAGE_TOKEN_SECRET = makeTestSecret('storage-token');
process.env.UPLOAD_SCAN_STRICT = 'true';
process.env.AUTH_DEBUG_DIAGNOSTICS = 'false';
process.env.DISABLE_GOOGLE_AUTH = 'true';
process.env.ENABLE_EXTERNAL_STORAGE = 'false';
process.env.BREVO_API_KEY = '<dummy-api-key>';
process.env.MAIL_FROM = 'no-reply@example.com';

validateEnv();
