const { validateEnv } = require('../src/config/validateEnv');

function makeTestSecret(label, length = 72) {
  const seed = `validation-only-${label}-`;
  return seed + 'x'.repeat(Math.max(0, length - seed.length));
}

function makeTestBcryptHash() {
  return `$2b$10$${'a'.repeat(53)}`;
}

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || makeTestSecret('jwt');
process.env.JWT_PASSWORD_SETUP_SECRET = process.env.JWT_PASSWORD_SETUP_SECRET || makeTestSecret('jwt-password-setup');
process.env.SUPERADMIN_PASSWORD_HASH = process.env.SUPERADMIN_PASSWORD_HASH || makeTestBcryptHash();
process.env.SUPERADMIN_XID = process.env.SUPERADMIN_XID || 'X000001';
process.env.SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || 'superadmin@example.com';
process.env.SUPERADMIN_OBJECT_ID = process.env.SUPERADMIN_OBJECT_ID || '000000000000000000000001';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/docketra';
process.env.ENCRYPTION_PROVIDER = process.env.ENCRYPTION_PROVIDER || 'disabled';

validateEnv();
