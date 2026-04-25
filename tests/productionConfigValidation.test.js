#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { envSchema } = require('../src/config/env');

const BASE_ENV = {
  NODE_ENV: 'production',
  PORT: '5000',
  MONGO_URI: 'mongodb://127.0.0.1:27017/docketra-test',
  JWT_SECRET: '0123456789abcdef0123456789abcdef',
  SUPERADMIN_PASSWORD_HASH: '$2b$10$abcdefghijklmnopqrstuv123456789012345678901234567890',
  SUPERADMIN_XID: 'X123456',
  SUPERADMIN_EMAIL: 'superadmin@example.com',
  SUPERADMIN_OBJECT_ID: '000000000000000000000001',
  ENCRYPTION_PROVIDER: 'local',
  MASTER_ENCRYPTION_KEY: '12345678901234567890123456789012',
  METRICS_TOKEN: 'metrics-token-123',
  BREVO_API_KEY: 'brevo-key-123',
  MAIL_FROM: 'support@example.com',
  GOOGLE_CLIENT_ID: 'gid',
  GOOGLE_CLIENT_SECRET: 'gsecret',
  GOOGLE_OAUTH_REDIRECT_URI: 'https://example.com/oauth/callback',
  STORAGE_TOKEN_SECRET: 'storage-secret',
};

function testUnsupportedEncryptionProviderRejected() {
  const parsed = envSchema.safeParse({ ...BASE_ENV, ENCRYPTION_PROVIDER: 'kms' });
  assert.strictEqual(parsed.success, false, 'KMS encryption provider must fail closed during startup validation');
  assert(parsed.error.issues.some((issue) => issue.path?.[0] === 'ENCRYPTION_PROVIDER'));
  console.log('✓ env validation rejects unsupported encryption providers in production');
}

function testUnsupportedAiProviderRejected() {
  const parsed = envSchema.safeParse({ ...BASE_ENV, AI_PROVIDER: 'gemini' });
  assert.strictEqual(parsed.success, false, 'Unsupported AI provider must fail startup validation');
  assert(parsed.error.issues.some((issue) => issue.path?.[0] === 'AI_PROVIDER'));
  console.log('✓ env validation rejects unsupported AI_PROVIDER values');
}

function testProductionMetricsTokenRequired() {
  const parsed = envSchema.safeParse({ ...BASE_ENV, METRICS_TOKEN: '' });
  assert.strictEqual(parsed.success, false, 'METRICS_TOKEN is required in production');
  assert(parsed.error.issues.some((issue) => issue.path?.[0] === 'METRICS_TOKEN'));
  console.log('✓ env validation requires metrics token in production');
}

function run() {
  testUnsupportedEncryptionProviderRejected();
  testUnsupportedAiProviderRejected();
  testProductionMetricsTokenRequired();
  console.log('productionConfigValidation tests passed');
}

run();
