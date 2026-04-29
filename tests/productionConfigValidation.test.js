#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { envSchema } = require('../src/config/env');

const BASE_ENV = {
  NODE_ENV: 'production',
  PORT: '5000',
  MONGO_URI: 'mongodb://127.0.0.1:27017/test',
  REDIS_URL: 'redis://127.0.0.1:6379',
  JWT_SECRET: 'A'.repeat(64),
  JWT_PASSWORD_SETUP_SECRET: 'B'.repeat(64),
  SUPERADMIN_PASSWORD_HASH: '$2b$10$wioLOkqqceK.iu9MZavNOua7yV2AzOpqlR4fuMWHf2.YeYpV4mEFC',
  SUPERADMIN_XID: 'X123456',
  SUPERADMIN_EMAIL: 'superadmin@example.com',
  SUPERADMIN_OBJECT_ID: '000000000000000000000001',
  ENCRYPTION_PROVIDER: 'local',
  MASTER_ENCRYPTION_KEY: 'a'.repeat(64),
  METRICS_TOKEN: 'D'.repeat(64),
  BREVO_API_KEY: 'brevo_live_'.padEnd(64, 'x'),
  MAIL_FROM: 'support@example.com',
  AUTH_DEBUG_DIAGNOSTICS: 'false',
  UPLOAD_SCAN_STRICT: 'true',
  DISABLE_GOOGLE_AUTH: 'true',
  ENABLE_EXTERNAL_STORAGE: 'false',
  STORAGE_TOKEN_SECRET: 'F'.repeat(64),
};

function expectFail(overrides, field) {
  const parsed = envSchema.safeParse({ ...BASE_ENV, ...overrides });
  assert.strictEqual(parsed.success, false, `Expected ${field} to fail`);
  assert(parsed.error.issues.some((issue) => issue.path?.[0] === field), `Expected issue for ${field}`);
}

function testProductionGuards() {
  expectFail({ AUTH_DEBUG_DIAGNOSTICS: 'true' }, 'AUTH_DEBUG_DIAGNOSTICS');
  expectFail({ UPLOAD_SCAN_STRICT: 'false' }, 'UPLOAD_SCAN_STRICT');
  expectFail({ UPLOAD_SCAN_STRICT: undefined }, 'UPLOAD_SCAN_STRICT');
  expectFail({ JWT_SECRET: 'short-secret' }, 'JWT_SECRET');
  expectFail({ JWT_PASSWORD_SETUP_SECRET: 'short-setup-secret' }, 'JWT_PASSWORD_SETUP_SECRET');
  expectFail({ STORAGE_TOKEN_SECRET: 'weak' }, 'STORAGE_TOKEN_SECRET');
  expectFail({ METRICS_TOKEN: 'metrics-token-123' }, 'METRICS_TOKEN');
  expectFail({ SUPERADMIN_PASSWORD_HASH: 'PlaintextPassword#123' }, 'SUPERADMIN_PASSWORD_HASH');
  expectFail({ SUPERADMIN_OBJECT_ID: 'not-an-object-id' }, 'SUPERADMIN_OBJECT_ID');
  expectFail({ ENCRYPTION_PROVIDER: 'kms' }, 'ENCRYPTION_PROVIDER');
  expectFail({ AI_PROVIDER: 'gemini' }, 'AI_PROVIDER');
  console.log('✓ production rejects weak/unsafe auth and upload env settings');
}

function testMasterKeyFormats() {
  const hexKeyParsed = envSchema.safeParse({ ...BASE_ENV, MASTER_ENCRYPTION_KEY: 'f'.repeat(64) });
  assert.strictEqual(hexKeyParsed.success, true, 'Expected 64-char hex master key to pass');

  const b64KeyParsed = envSchema.safeParse({ ...BASE_ENV, MASTER_ENCRYPTION_KEY: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=' });
  assert.strictEqual(b64KeyParsed.success, true, 'Expected 44-char base64 master key to pass');

  expectFail({ MASTER_ENCRYPTION_KEY: 'short-key' }, 'MASTER_ENCRYPTION_KEY');
  console.log('✓ production accepts valid master key formats and rejects invalid ones');
}

function testMongoTestDbAllowed() {
  const parsed = envSchema.safeParse({ ...BASE_ENV, MONGO_URI: 'mongodb://127.0.0.1:27017/test' });
  assert.strictEqual(parsed.success, true, 'Mongo /test database name should remain allowed during testing phase');
  console.log('✓ production does not fail solely due to MongoDB /test database');
}

function testDoesNotRequireClamavOrGoogleWhenDisabled() {
  const parsed = envSchema.safeParse({
    ...BASE_ENV,
    CLAMAV_HOST: undefined,
    GOOGLE_CLIENT_ID: undefined,
    GOOGLE_CLIENT_SECRET: undefined,
    GOOGLE_OAUTH_REDIRECT_URI: undefined,
    DISABLE_GOOGLE_AUTH: 'true',
    ENABLE_EXTERNAL_STORAGE: 'false',
  });
  assert.strictEqual(parsed.success, true, 'Should not require CLAMAV_HOST or Google OAuth vars when BYOS/external storage is disabled');
  console.log('✓ production startup does not require CLAMAV_HOST and optional Google vars when integration is disabled');
}


function testGoogleByosValidationOnlyWhenExternalStorageEnabled() {
  const passWhenAuthEnabledButExternalStorageDisabled = envSchema.safeParse({
    ...BASE_ENV,
    DISABLE_GOOGLE_AUTH: 'false',
    ENABLE_EXTERNAL_STORAGE: 'false',
    GOOGLE_CLIENT_ID: undefined,
    GOOGLE_CLIENT_SECRET: undefined,
    GOOGLE_OAUTH_REDIRECT_URI: undefined,
  });
  assert.strictEqual(passWhenAuthEnabledButExternalStorageDisabled.success, true, 'Google auth flag must not force BYOS vars when external storage is disabled');

  const failWhenExternalStorageEnabledWithoutByosVars = envSchema.safeParse({
    ...BASE_ENV,
    ENABLE_EXTERNAL_STORAGE: 'true',
    GOOGLE_CLIENT_ID: undefined,
    GOOGLE_CLIENT_SECRET: undefined,
    GOOGLE_OAUTH_REDIRECT_URI: undefined,
    STORAGE_TOKEN_SECRET: undefined,
  });
  assert.strictEqual(failWhenExternalStorageEnabledWithoutByosVars.success, false, 'BYOS vars must be required when external storage is enabled');
  assert(failWhenExternalStorageEnabledWithoutByosVars.error.issues.some((issue) => issue.path?.[0] === 'GOOGLE_CLIENT_ID'));

  const passWhenExternalStorageEnabledWithByosVars = envSchema.safeParse({
    ...BASE_ENV,
    ENABLE_EXTERNAL_STORAGE: 'true',
    GOOGLE_CLIENT_ID: 'google-client-id.apps.googleusercontent.com',
    GOOGLE_CLIENT_SECRET: 'G'.repeat(64),
    GOOGLE_OAUTH_REDIRECT_URI: 'https://api.example.com/api/storage/google/callback',
    STORAGE_TOKEN_SECRET: 'S'.repeat(64),
  });
  assert.strictEqual(passWhenExternalStorageEnabledWithByosVars.success, true, 'BYOS vars should pass when external storage is enabled and configured');
  console.log('✓ BYOS Google vars are enforced only when external storage is enabled');
}

function run() {
  testProductionGuards();
  testMasterKeyFormats();
  testMongoTestDbAllowed();
  testDoesNotRequireClamavOrGoogleWhenDisabled();
  testGoogleByosValidationOnlyWhenExternalStorageEnabled();
  console.log('productionConfigValidation tests passed');
}

run();
