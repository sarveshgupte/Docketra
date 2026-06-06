#!/usr/bin/env node
'use strict';

const assert = require('assert');
const path = require('path');
const { spawnSync } = require('child_process');
const { envSchema } = require('../src/config/env');

const BASE_ENV = {
  NODE_ENV: 'production',
  PORT: '5000',
  MONGO_URI: 'mongodb://127.0.0.1:27017/test',
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

const repoRoot = path.resolve(__dirname, '..');
const productionValidatorPath = path.join(repoRoot, 'scripts', 'validateEnvProduction.js');

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
  console.log('PASS production rejects weak/unsafe auth and upload env settings');
}

function runProductionValidator(args = [], overrides = {}) {
  return spawnSync(process.execPath, [productionValidatorPath, ...args], {
    cwd: repoRoot,
    env: {
      ...process.env,
      ...BASE_ENV,
      ...overrides,
    },
    encoding: 'utf8',
  });
}

function testCurrentEnvValidationCommandRejectsForbiddenDrift() {
  const badDebug = runProductionValidator([], { AUTH_DEBUG_DIAGNOSTICS: 'true' });
  assert.notStrictEqual(
    badDebug.status,
    0,
    'Current production env validator must fail when AUTH_DEBUG_DIAGNOSTICS=true'
  );
  assert.match(
    `${badDebug.stdout}\n${badDebug.stderr}`,
    /AUTH_DEBUG_DIAGNOSTICS/,
    'Current production env validator failure should name AUTH_DEBUG_DIAGNOSTICS'
  );

  const badUploadMode = runProductionValidator([], { UPLOAD_SCAN_STRICT: 'false' });
  assert.notStrictEqual(
    badUploadMode.status,
    0,
    'Current production env validator must fail when UPLOAD_SCAN_STRICT is not true'
  );
  assert.match(
    `${badUploadMode.stdout}\n${badUploadMode.stderr}`,
    /UPLOAD_SCAN_STRICT/,
    'Current production env validator failure should name UPLOAD_SCAN_STRICT'
  );

  const fixtureValidation = runProductionValidator(['--fixture'], {
    AUTH_DEBUG_DIAGNOSTICS: 'true',
    UPLOAD_SCAN_STRICT: 'false',
  });
  assert.strictEqual(
    fixtureValidation.status,
    0,
    'Fixture production env validation should use known safe placeholders instead of current env drift'
  );

  console.log('PASS production current-env validator rejects forbidden auth/upload drift');
}

function testRedisOptionalButValidatedWhenConfiguredInProduction() {
  const missingRedis = envSchema.safeParse({ ...BASE_ENV, REDIS_URL: undefined });
  assert.strictEqual(missingRedis.success, true, 'Expected production env to allow missing REDIS_URL');

  const blankRedis = envSchema.safeParse({ ...BASE_ENV, REDIS_URL: '' });
  assert.strictEqual(blankRedis.success, true, 'Expected production env to allow blank REDIS_URL');

  expectFail({ REDIS_URL: 'http://localhost:6379' }, 'REDIS_URL');

  const parsed = envSchema.safeParse({ ...BASE_ENV, REDIS_URL: 'rediss://redis.example.com:6379' });
  assert.strictEqual(parsed.success, true, 'Expected valid rediss:// REDIS_URL to pass production validation');
  console.log('PASS production treats Redis as optional and validates URL only when configured');
}

function testMasterKeyFormats() {
  const hexKeyParsed = envSchema.safeParse({ ...BASE_ENV, MASTER_ENCRYPTION_KEY: 'f'.repeat(64) });
  assert.strictEqual(hexKeyParsed.success, true, 'Expected 64-char hex master key to pass');

  const validBase64MasterKey = Buffer.alloc(32, 1).toString('base64');
  const b64KeyParsed = envSchema.safeParse({ ...BASE_ENV, MASTER_ENCRYPTION_KEY: validBase64MasterKey });
  assert.strictEqual(b64KeyParsed.success, true, 'Expected 44-char base64 master key to pass');

  expectFail({ MASTER_ENCRYPTION_KEY: 'short-key' }, 'MASTER_ENCRYPTION_KEY');
  console.log('PASS production accepts valid master key formats and rejects invalid ones');
}

function testMongoTestDbAllowed() {
  const parsed = envSchema.safeParse({ ...BASE_ENV, MONGO_URI: 'mongodb://127.0.0.1:27017/test' });
  assert.strictEqual(parsed.success, true, 'Mongo /test database name should remain allowed during testing phase');
  console.log('PASS production does not fail solely due to MongoDB /test database');
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
  console.log('PASS production startup does not require CLAMAV_HOST and optional Google vars when integration is disabled');
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
  console.log('PASS BYOS Google vars are enforced only when external storage is enabled');
}

function run() {
  testProductionGuards();
  testCurrentEnvValidationCommandRejectsForbiddenDrift();
  testRedisOptionalButValidatedWhenConfiguredInProduction();
  testMasterKeyFormats();
  testMongoTestDbAllowed();
  testDoesNotRequireClamavOrGoogleWhenDisabled();
  testGoogleByosValidationOnlyWhenExternalStorageEnabled();
  console.log('productionConfigValidation tests passed');
}

run();
